const express = require("express");
const axios = require("axios");
const path = require("path");

const sipApp = express();
const PORT = 3000;

// This is where all our drink data comes from.
const cocktailApiHome = "https://www.thecocktaildb.com/api/json/v1/1";

// Backup choices just in case the API has a rough moment.
const backupDrinkTypes = [
  "Cocktail",
  "Ordinary Drink",
  "Shot",
  "Punch / Party Drink",
  "Coffee / Tea",
  "Homemade Liqueur"
];

sipApp.set("view engine", "ejs");
sipApp.set("views", path.join(__dirname, "views"));

sipApp.use(express.static(path.join(__dirname, "public")));
sipApp.use(express.urlencoded({ extended: true }));

async function grabDrinkTypes() {
  try {
    const apiReply = await axios.get(`${cocktailApiHome}/list.php?c=list`);
    return apiReply.data.drinks.map((drinkType) => drinkType.strCategory);
  } catch (error) {
    return backupDrinkTypes;
  }
}

function cleanTypeForApi(typeName) {
  // The API likes underscores better than spaces.
  return typeName.trim().replace(/\s+/g, "_");
}

function collectRecipeItems(drinkInfo) {
  const recipeItems = [];

  // The API stores ingredients in numbered spots.
  for (let spot = 1; spot <= 15; spot++) {
    const itemName = drinkInfo[`strIngredient${spot}`];
    const itemAmount = drinkInfo[`strMeasure${spot}`];

    if (itemName) {
      recipeItems.push({
        name: itemName.trim(),
        amount: itemAmount ? itemAmount.trim() : "as needed"
      });
    }
  }

  return recipeItems;
}

sipApp.get("/", async (req, res) => {
  const drinkTypes = await grabDrinkTypes();

  res.render("index", {
    drinkTypes,
    message: null
  });
});

sipApp.post("/find-drinks", async (req, res) => {
  const pickedType = req.body.drinkType;
  const drinkTypes = await grabDrinkTypes();

  if (!pickedType) {
    return res.render("index", {
      drinkTypes,
      message: "Please choose a drink type first."
    });
  }

  try {
    const readyType = cleanTypeForApi(pickedType);

    const apiReply = await axios.get(`${cocktailApiHome}/filter.php`, {
      params: { c: readyType }
    });

    const drinkList = apiReply.data.drinks || [];

    res.render("results", {
      pickedType,
      drinkList,
      message: drinkList.length === 0 ? "No drinks were found for that choice." : null
    });
  } catch (error) {
    res.render("index", {
      drinkTypes,
      message: "The drinks did not load. Please try again."
    });
  }
});

sipApp.get("/recipe/:drinkId", async (req, res) => {
  try {
    const apiReply = await axios.get(`${cocktailApiHome}/lookup.php`, {
      params: { i: req.params.drinkId }
    });

    const drinkInfo = apiReply.data.drinks ? apiReply.data.drinks[0] : null;

    if (!drinkInfo) {
      return res.render("recipe", {
        drinkInfo: null,
        recipeItems: [],
        message: "That recipe could not be found."
      });
    }

    res.render("recipe", {
      drinkInfo,
      recipeItems: collectRecipeItems(drinkInfo),
      message: null
    });
  } catch (error) {
    res.render("recipe", {
      drinkInfo: null,
      recipeItems: [],
      message: "The recipe did not load. Please try again."
    });
  }
});

sipApp.get("/random-pick", async (req, res) => {
  try {
    const apiReply = await axios.get(`${cocktailApiHome}/random.php`);
    const drinkInfo = apiReply.data.drinks[0];

    res.render("recipe", {
      drinkInfo,
      recipeItems: collectRecipeItems(drinkInfo),
      message: null
    });
  } catch (error) {
    const drinkTypes = await grabDrinkTypes();

    res.render("index", {
      drinkTypes,
      message: "The random drink did not load. Try picking a category."
    });
  }
});

sipApp.listen(PORT, () => {
  console.log(`SipScout is running at http://localhost:${PORT}`);
});