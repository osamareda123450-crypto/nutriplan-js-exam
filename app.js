const DAILY_GOALS = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70
};

const STORAGE_KEY = "nutriplan_food_log_v1";

const FALLBACK_PRODUCTS = [
  {
    id: "prod-nutella",
    name: "Nutella Hazelnut Spread (100g)",
    barcode: "3017620422003",
    image: "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.400.jpg",
    calories: 539,
    protein: 6.3,
    carbs: 57.5,
    fat: 30.9
  },
  {
    id: "prod-pepsi",
    name: "Pepsi Cola (330ml)",
    barcode: "012000001417",
    image: "https://images.openfoodfacts.org/images/products/001/200/001/417/front_en.400.jpg",
    calories: 140,
    protein: 0,
    carbs: 38,
    fat: 0
  }
];

class NutriPlanApp {
  constructor() {
    this.meals = [];
    this.filteredMeals = [];
    this.foodLog = this.loadFoodLog();
    this.currentView = "home";

    this.cacheDOM();
    this.bindEvents();
    this.init();
  }

  cacheDOM() {
    this.navButtons = document.querySelectorAll(".nav-btn");
    this.views = document.querySelectorAll(".view");
    this.pageTitle = document.getElementById("page-title");
    this.pageSubtitle = document.getElementById("page-subtitle");

    this.categoryFilter = document.getElementById("category-filter");
    this.areaFilter = document.getElementById("area-filter");
    this.resetFiltersBtn = document.getElementById("reset-filters-btn");
    this.mealsCount = document.getElementById("meals-count");
    this.mealsGrid = document.getElementById("meals-grid");

    this.backToHomeBtn = document.getElementById("back-to-home-btn");
    this.mealDetailsContainer = document.getElementById("meal-details-container");

    this.scannerInput = document.getElementById("scanner-input");
    this.searchProductBtn = document.getElementById("search-product-btn");
    this.scannerResults = document.getElementById("scanner-results");
    this.chipButtons = document.querySelectorAll(".chip-btn");

    this.nutritionSummary = document.getElementById("nutrition-summary");
    this.loggedItemsList = document.getElementById("logged-items-list");
    this.clearLogBtn = document.getElementById("clear-log-btn");
  }

  bindEvents() {
    this.navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.switchView(btn.dataset.view);
      });
    });

    this.categoryFilter.addEventListener("change", () => this.applyFilters());
    this.areaFilter.addEventListener("change", () => this.applyFilters());
    this.resetFiltersBtn.addEventListener("click", () => {
      this.categoryFilter.value = "all";
      this.areaFilter.value = "all";
      this.applyFilters();
    });

    this.backToHomeBtn.addEventListener("click", () => this.switchView("home"));

    this.searchProductBtn.addEventListener("click", () => {
      this.searchProducts(this.scannerInput.value.trim());
    });

    this.scannerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.searchProducts(this.scannerInput.value.trim());
      }
    });

    this.chipButtons.forEach((chip) => {
      chip.addEventListener("click", () => {
        const query = chip.dataset.query;
        this.scannerInput.value = query;
        this.searchProducts(query);
      });
    });

    this.clearLogBtn.addEventListener("click", () => {
      this.foodLog = [];
      this.saveFoodLog();
      this.renderFoodLog();
    });
  }

  async init() {
    this.mealsGrid.innerHTML = `<p class="muted-text">Loading meals...</p>`;
    await this.loadInitialMeals();
    this.populateFilters();
    this.applyFilters();
    this.renderFoodLog();
  }

  estimateMacros(seedText = "") {
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
      hash = (hash * 31 + seedText.charCodeAt(i)) % 10000;
    }
    const calories = 320 + (hash % 360);
    const protein = 18 + (hash % 32);
    const carbs = 25 + (hash % 45);
    const fat = 10 + (hash % 22);
    return { calories, protein, carbs, fat };
  }

  async loadInitialMeals() {
    try {

      const [egyptianRes, pastaRes, seafoodRes, chickenRes] = await Promise.all([
        fetch("https://www.themealdb.com/api/json/v1/1/filter.php?a=Egyptian"),
        fetch("https://www.themealdb.com/api/json/v1/1/filter.php?c=Pasta"),
        fetch("https://www.themealdb.com/api/json/v1/1/filter.php?c=Seafood"),
        fetch("https://www.themealdb.com/api/json/v1/1/filter.php?c=Chicken")
      ]);

      const [egyptianData, pastaData, seafoodData, chickenData] = await Promise.all([
        egyptianRes.json(),
        pastaRes.json(),
        seafoodRes.json(),
        chickenRes.json()
      ]);

      const mapList = (list = [], categoryFallback, areaFallback) =>
        list.map((m) => ({
          id: m.idMeal,
          name: m.strMeal,
          image: m.strMealThumb,
          category: categoryFallback,
          area: areaFallback,
          macros: this.estimateMacros(m.idMeal + m.strMeal)
        }));

      const combined = [
        ...mapList(egyptianData.meals, "Egyptian", "Egyptian"),
        ...mapList(pastaData.meals, "Pasta", "Italian"),
        ...mapList(seafoodData.meals, "Seafood", "Mediterranean"),
        ...mapList(chickenData.meals, "Chicken", "American")
      ];
      const uniqueMap = new Map();
      combined.forEach((item) => {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });

      this.meals = Array.from(uniqueMap.values()).slice(0, 28);
    } catch (error) {
      console.error("Error loading meals:", error);
      this.meals = [
        {
          id: "52975",
          name: "Tamiya (Egyptian Falafel)",
          image: "https://www.themealdb.com/images/media/meals/n3xxd91598732796.jpg",
          category: "Egyptian",
          area: "Egyptian",
          macros: this.estimateMacros("Tamiya")
        },
        {
          id: "52973",
          name: "Koshari",
          image: "https://www.themealdb.com/images/media/meals/4er7mj1598733193.jpg",
          category: "Egyptian",
          area: "Egyptian",
          macros: this.estimateMacros("Koshari")
        }
      ];
    }
  }

  populateFilters() {
    const categories = [...new Set(this.meals.map((m) => m.category))].sort();
    const areas = [...new Set(this.meals.map((m) => m.area))].sort();

    this.categoryFilter.innerHTML =
      `<option value="all">All Categories</option>` +
      categories.map((c) => `<option value="${c}">${c}</option>`).join("");

    this.areaFilter.innerHTML =
      `<option value="all">All Areas</option>` +
      areas.map((a) => `<option value="${a}">${a}</option>`).join("");
  }

  applyFilters() {
    const selectedCategory = this.categoryFilter.value;
    const selectedArea = this.areaFilter.value;

    const matches = this.meals.filter((meal) => {
      const catMatch = selectedCategory === "all" || meal.category === selectedCategory;
      const areaMatch = selectedArea === "all" || meal.area === selectedArea;
      return catMatch && areaMatch;
    });

    this.filteredMeals = matches.slice(0, 25);
    this.renderMealsGrid();
  }

  renderMealsGrid() {
    this.mealsCount.textContent = `Showing ${this.filteredMeals.length} meals`;

    if (this.filteredMeals.length === 0) {
      this.mealsGrid.innerHTML = `<p class="muted-text">No meals match the selected filters.</p>`;
      return;
    }

    this.mealsGrid.innerHTML = this.filteredMeals
      .map(
        (meal) => `
        <article class="meal-card">
          <div>
            <img src="${meal.image}" alt="${meal.name}" loading="lazy" />
            <div class="meal-card-body">
              <div class="meal-meta">
                <span class="badge">${meal.category}</span>
                <span class="badge area">${meal.area}</span>
              </div>
              <h3>${meal.name}</h3>
              <p class="nutrition-mini">
                ${meal.macros.calories} kcal • ${meal.macros.protein}g P • ${meal.macros.carbs}g C • ${meal.macros.fat}g F
              </p>
            </div>
          </div>
          <div class="card-actions">
            <button type="button" class="btn secondary-btn details-btn" data-id="${meal.id}">
              Details
            </button>
            <button type="button" class="btn primary-btn quick-log-btn" data-id="${meal.id}">
              + Log
            </button>
          </div>
        </article>
      `
      )
      .join("");

    this.mealsGrid.querySelectorAll(".details-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.openMealDetails(btn.dataset.id));
    });

    this.mealsGrid.querySelectorAll(".quick-log-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const meal = this.meals.find((m) => m.id === btn.dataset.id);
        if (meal) {
          this.logNutritionItem({
            name: meal.name,
            type: "Meal",
            ...meal.macros
          });
        }
      });
    });
  }

  async openMealDetails(mealId) {
    this.switchView("details");
    this.mealDetailsContainer.innerHTML = `<p class="muted-text">Loading meal details...</p>`;

    const baseMeal = this.meals.find((m) => m.id === mealId) || {
      id: mealId,
      name: "Meal",
      image: "",
      category: "General",
      area: "International",
      macros: this.estimateMacros(mealId)
    };

    try {
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`);
      const data = await res.json();
      const full = data.meals?.[0];

      const ingredients = [];
      if (full) {
        for (let i = 1; i <= 20; i++) {
          const ing = full[`strIngredient${i}`];
          const measure = full[`strMeasure${i}`];
          if (ing && ing.trim()) {
            ingredients.push(`${measure ? measure.trim() + " - " : ""}${ing.trim()}`);
          }
        }
      }

      const title = full?.strMeal || baseMeal.name;
      const thumb = full?.strMealThumb || baseMeal.image;
      const category = full?.strCategory || baseMeal.category;
      const area = full?.strArea || baseMeal.area;
      const instructions = full?.strInstructions || "Instructions not available.";

      let youtubeEmbed = "";
      if (full?.strYoutube) {
        const videoId = full.strYoutube.split("v=")[1]?.split("&")[0];
        if (videoId) {
          youtubeEmbed = `
            <div class="video-box">
              <h3>Recipe Video</h3>
              <iframe
                width="100%"
                height="340"
                style="border-radius:12px; margin-top:10px; border:0;"
                src="https://www.youtube.com/embed/${videoId}"
                title="${title}"
                allowfullscreen>
              </iframe>
            </div>
          `;
        }
      }

      this.mealDetailsContainer.innerHTML = `
        <div class="details-card">
          <div class="details-top">
            <img src="${thumb}" alt="${title}" />
            <div>
              <div class="meal-meta">
                <span class="badge">${category}</span>
                <span class="badge area">${area}</span>
              </div>
              <h2>${title}</h2>

              <div class="macros-row">
                <div class="macro-box">
                  <span>Calories</span>
                  <strong>${baseMeal.macros.calories}</strong>
                </div>
                <div class="macro-box">
                  <span>Protein</span>
                  <strong>${baseMeal.macros.protein}g</strong>
                </div>
                <div class="macro-box">
                  <span>Carbs</span>
                  <strong>${baseMeal.macros.carbs}g</strong>
                </div>
                <div class="macro-box">
                  <span>Fat</span>
                  <strong>${baseMeal.macros.fat}g</strong>
                </div>
              </div>

              <button type="button" id="log-this-meal-btn" class="btn primary-btn">
                <i class="fa-solid fa-plus"></i> Log This Meal
              </button>
            </div>
          </div>

          <div class="details-columns">
            <div>
              <h3>Ingredients</h3>
              <ul class="ingredients-list">
                ${
                  ingredients.length
                    ? ingredients.map((item) => `<li>${item}</li>`).join("")
                    : "<li>Ingredients list unavailable.</li>"
                }
              </ul>
            </div>

            <div>
              <h3>Instructions</h3>
              <p class="instructions-text">${instructions}</p>
            </div>
          </div>

          ${youtubeEmbed}
        </div>
      `;

      document.getElementById("log-this-meal-btn").addEventListener("click", () => {
        this.logNutritionItem({
          name: title,
          type: "Meal",
          ...baseMeal.macros
        });
      });
    } catch (err) {
      console.error(err);
      this.mealDetailsContainer.innerHTML = `<p class="muted-text">Could not load meal details.</p>`;
    }
  }

  async searchProducts(query) {
    if (!query) {
      this.scannerResults.innerHTML = `<p class="muted-text">Please enter a product name or barcode.</p>`;
      return;
    }

    this.scannerResults.innerHTML = `<p class="muted-text">Searching products...</p>`;
    const normalized = query.toLowerCase();

    const localMatches = FALLBACK_PRODUCTS.filter(
      (p) => p.name.toLowerCase().includes(normalized) || p.barcode.includes(normalized)
    );

    try {
      const isBarcode = /^\d{6,}$/.test(query);
      const url = isBarcode
        ? `https://world.openfoodfacts.org/api/v0/product/${query}.json`
        : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8`;

      const res = await fetch(url);
      const data = await res.json();

      let apiProducts = [];
      if (isBarcode && data.status === 1 && data.product) {
        apiProducts = [this.formatOpenFoodFact(data.product)];
      } else if (Array.isArray(data.products)) {
        apiProducts = data.products
          .filter((p) => p.product_name)
          .slice(0, 8)
          .map((p) => this.formatOpenFoodFact(p));
      }

      const finalList = apiProducts.length ? apiProducts : localMatches;
      this.renderScannerResults(finalList);
    } catch (error) {
      console.error(error);
      this.renderScannerResults(localMatches);
    }
  }

  formatOpenFoodFact(product) {
    const nutriments = product.nutriments || {};
    return {
      id: product.code || Math.random().toString(36).slice(2),
      name: product.product_name,
      barcode: product.code || "N/A",
      image:
        product.image_front_small_url ||
        product.image_url ||
        "https://via.placeholder.com/240x160?text=Product",
      calories: Math.round(nutriments["energy-kcal_100g"] || nutriments["energy-kcal"] || 150),
      protein: Number((nutriments.proteins_100g || 0).toFixed(1)),
      carbs: Number((nutriments.carbohydrates_100g || 0).toFixed(1)),
      fat: Number((nutriments.fat_100g || 0).toFixed(1))
    };
  }

  renderScannerResults(products) {
    if (!products || products.length === 0) {
      this.scannerResults.innerHTML = `<p class="muted-text">No products found. Try "Nutella" or "Pepsi".</p>`;
      return;
    }

    this.scannerResults.innerHTML = products
      .map(
        (prod, idx) => `
        <article class="meal-card">
          <div>
            <img src="${prod.image}" alt="${prod.name}" />
            <div class="meal-card-body">
              <div class="meal-meta">
                <span class="badge">Barcode: ${prod.barcode}</span>
              </div>
              <h3>${prod.name}</h3>
              <p class="nutrition-mini">
                ${prod.calories} kcal • ${prod.protein}g P • ${prod.carbs}g C • ${prod.fat}g F
              </p>
            </div>
          </div>
          <div class="card-actions">
            <button type="button" class="btn primary-btn add-prod-btn" data-index="${idx}">
              + Add to Food Log
            </button>
          </div>
        </article>
      `
      )
      .join("");

    this.scannerResults.querySelectorAll(".add-prod-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const chosen = products[Number(btn.dataset.index)];
        if (chosen) {
          this.logNutritionItem({
            name: chosen.name,
            type: "Scanned Product",
            calories: chosen.calories,
            protein: chosen.protein,
            carbs: chosen.carbs,
            fat: chosen.fat
          });
        }
      });
    });
  }

  logNutritionItem(item) {
    this.foodLog.unshift({
      id: Date.now(),
      name: item.name,
      type: item.type,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0
    });

    this.saveFoodLog();
    this.renderFoodLog();
    this.switchView("log");
  }

  loadFoodLog() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveFoodLog() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.foodLog));
  }

  renderFoodLog() {
    const totals = this.foodLog.reduce(
      (acc, entry) => {
        acc.calories += entry.calories;
        acc.protein += entry.protein;
        acc.carbs += entry.carbs;
        acc.fat += entry.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const metrics = [
      { label: "Calories", current: Math.round(totals.calories), goal: DAILY_GOALS.calories, unit: "kcal" },
      { label: "Protein", current: Number(totals.protein.toFixed(1)), goal: DAILY_GOALS.protein, unit: "g" },
      { label: "Carbohydrates", current: Number(totals.carbs.toFixed(1)), goal: DAILY_GOALS.carbs, unit: "g" },
      { label: "Fats", current: Number(totals.fat.toFixed(1)), goal: DAILY_GOALS.fat, unit: "g" }
    ];

    this.nutritionSummary.innerHTML = metrics
      .map((m) => {
        const pct = Math.min(100, Math.round((m.current / m.goal) * 100));
        return `
          <div class="progress-card">
            <div class="progress-card-top">
              <span>${m.label}</span>
              <span>${m.current} / ${m.goal} ${m.unit}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join("");

    if (this.foodLog.length === 0) {
      this.loggedItemsList.innerHTML = `<p class="muted-text">No meals or products logged yet today.</p>`;
      return;
    }

    this.loggedItemsList.innerHTML = this.foodLog
      .map(
        (entry) => `
        <div class="logged-item">
          <div>
            <strong>${entry.name}</strong>
            <div class="muted-text" style="margin:0;">
              ${entry.type} • ${entry.calories} kcal • ${entry.protein}g P • ${entry.carbs}g C • ${entry.fat}g F
            </div>
          </div>
          <button type="button" class="btn danger-btn remove-log-btn" data-id="${entry.id}">
            Remove
          </button>
        </div>
      `
      )
      .join("");

    this.loggedItemsList.querySelectorAll(".remove-log-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        this.foodLog = this.foodLog.filter((item) => item.id !== id);
        this.saveFoodLog();
        this.renderFoodLog();
      });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;

    this.navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });

    this.views.forEach((sec) => {
      sec.classList.toggle("active", sec.id === `view-${viewName}`);
    });

    const headers = {
      home: ["Meals & Recipes", "Discover delicious and nutritious recipes tailored for you"],
      details: ["Meal Details", "Ingredients, instructions, nutrition values, and logging"],
      scanner: ["Product Scanner", "Search packaged products like Nutella or Pepsi by name or barcode"],
      log: ["Food Log", "Track your daily Calories, Protein, Carbohydrates, and Fats"]
    };

    const [title, subtitle] = headers[viewName] || headers.home;
    this.pageTitle.textContent = title;
    this.pageSubtitle.textContent = subtitle;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new NutriPlanApp();
});