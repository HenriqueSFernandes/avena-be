import { inArray } from "drizzle-orm";
import OpenAI from "openai";
import { recipes } from "../db/schema/recipes";
import { db } from "./db";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const CALORIE_MARGIN = 250;

const MEAL_TYPE_TO_CATEGORIES: Record<string, string[]> = {
	Breakfast: ["appetizer", "breakfast", "bread", "snack"],
	Lunch: ["main course", "main dish", "salad", "soup", "baked good"],
	Snacks: ["appetizer", "snack", "dessert", "bread"],
	Dinner: ["main course", "main dish", "salad", "soup", "baked good"],
};

interface UserProfile {
	gender: "male" | "female" | "other";
	height: number; // cm
	weight: number; // kg
	age: number;
	activityLevel: number;
	dietaryRestrictions?: string[]; // e.g., ['vegan', 'gluten-free', 'no-pork']
	healthGoal?: string; // e.g., 'lose weight', 'stay fit', 'build muscle', 'eat healthier'
}

export type Inventory = Ingredient[];

export interface Ingredient {
	name: string;
	quantity: number;
	unit: string;
}

export interface Recipe {
	id: string;
	name: string;
	description: string;
	category: string;
	cuisine: string;
	difficulty: string;
	calories: number;
	totalTime: string;
	activeTime: string;
	yields: string;
	proteinG: number;
	fatG: number;
	carbsG: number;
	fiberG: number;
	isVegetarian: boolean;
	isVegan: boolean;
	isGlutenFree: boolean;
	tags: string[];
	ingredients: Ingredient[];
	coverageScore: number;
}

interface SelectedRecipe extends Recipe {
	aiReason?: string;
	mealType?: string;
}

export function calculateCaloricNeeds(profile: UserProfile): number {
	const { gender, height, weight, age, activityLevel } = profile;

	// Mifflin–St Jeor equation for BMR
	const genderOffset = gender === "male" ? 5 : gender === "female" ? -161 : -78;
	const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;

	let goalOffset = 0; // This can be adjusted based on user's health goal (e.g., -500 for weight loss)
	if (profile.healthGoal === "lose weight") {
		goalOffset = -500;
	} else if (profile.healthGoal === "build muscle") {
		goalOffset = 300;
	}

	return bmr * activityLevel + goalOffset;
}

export function suggestCalorieDistribution(
	totalCalories: number,
	meals: string[],
): Record<string, number> {
	const BREAKFAST_RATIO = 0.15;
	const MORNING_SNACK_RATIO = 0.05;
	const BRUNCH_RATIO = 0.1;
	const LUNCH_RATIO = 0.25;
	const AFTERNOON_SNACK_RATIO = 0.1;
	const DINNER_RATIO = 0.25;
	const MIDNIGHT_SNACK_RATIO = 0.1;

	const distribution: Record<string, number> = {};

	let totalRatio = 0;
	if (meals.includes("breakfast")) {
		distribution["Breakfast"] = BREAKFAST_RATIO;
		totalRatio += BREAKFAST_RATIO;
	}
	if (meals.includes("morning snack")) {
		distribution["Morning Snack"] = MORNING_SNACK_RATIO;
		totalRatio += MORNING_SNACK_RATIO;
	}
	if (meals.includes("brunch")) {
		distribution["Brunch"] = BRUNCH_RATIO;
		totalRatio += BRUNCH_RATIO;
	}
	if (meals.includes("lunch")) {
		distribution["Lunch"] = LUNCH_RATIO;
		totalRatio += LUNCH_RATIO;
	}
	if (meals.includes("afternoon snack")) {
		distribution["Afternoon Snack"] = AFTERNOON_SNACK_RATIO;
		totalRatio += AFTERNOON_SNACK_RATIO;
	}
	if (meals.includes("dinner")) {
		distribution["Dinner"] = DINNER_RATIO;
		totalRatio += DINNER_RATIO;
	}
	if (meals.includes("midnight snack")) {
		distribution["Midnight Snack"] = MIDNIGHT_SNACK_RATIO;
		totalRatio += MIDNIGHT_SNACK_RATIO;
	}

	// Apply calories
	for (const meal in distribution) {
		distribution[meal] = (distribution[meal] / totalRatio) * totalCalories;
	}

	return distribution;
}

function inventoryCoverageScore(
	recipeIngredients: Ingredient[],
	inventory: Inventory,
): number {
	const totalIngredients = recipeIngredients.reduce(
		(sum, ing) => sum + ing.quantity,
		0,
	);

	if (totalIngredients === 0) return 0;

	let availableIngredients = 0;
	for (const recipeIng of recipeIngredients) {
		const ingredientLower = recipeIng.name.toLowerCase();
		const inventoryItem = inventory.find(
			(ing) => ing.name.toLowerCase() === ingredientLower,
		);
		if (inventoryItem) {
			availableIngredients += Math.min(
				recipeIng.quantity,
				inventoryItem.quantity,
			);
		}
	}

	return availableIngredients / totalIngredients;
}

function deductIngredientsFromInventory(
	inventory: Inventory,
	recipeIngredients: Ingredient[],
): Inventory {
	const updatedInventory = [...inventory];

	for (const ingredient of recipeIngredients) {
		const ingredientLower = ingredient.name.toLowerCase();
		const inventoryItem = updatedInventory.find(
			(ing) => ing.name.toLowerCase() === ingredientLower,
		);
		if (inventoryItem) {
			const updatedQuantity = Math.max(
				0,
				inventoryItem.quantity - ingredient.quantity,
			);
			updatedInventory[updatedInventory.indexOf(inventoryItem)] = {
				...inventoryItem,
				quantity: updatedQuantity,
			};
		}
	}

	return updatedInventory;
}

// Dietary restrictions configuration
type DietaryRestriction = {
	requiredTags?: string[];
	forbiddenTags?: string[];
	customCheck?: (tags: string[]) => boolean;
};

const DIETARY_RESTRICTIONS: Record<string, DietaryRestriction> = {
	vegan: {
		requiredTags: ["vegan"],
	},
	vegetarian: {
		customCheck: (tags: string[]) =>
			tags.some((tag) => ["vegan", "vegetarian"].includes(tag)),
	},
	pescatarian: {
		customCheck: (tags: string[]) =>
			tags.some((tag) => ["vegan", "vegetarian", "pescatarian"].includes(tag)),
	},
	"gluten-free": {
		customCheck: (tags: string[]) =>
			tags.some((tag) => tag.includes("gluten-free")),
	},
	"no-pork": {
		customCheck: (tags: string[]) => !tags.some((tag) => tag.includes("pork")),
	},
	"no-alcohol": {
		customCheck: (tags: string[]) =>
			!tags.some((tag) => tag.includes("wine") || tag.includes("alcohol")),
	},
};

function checkDietaryRestrictions(
	recipeTags: string[],
	dietaryPrefs: string[],
): boolean {
	if (!dietaryPrefs || dietaryPrefs.length === 0) {
		return true;
	}

	// Normalize tags to lowercase for comparison
	const tagsLower = recipeTags.map((tag) => tag.toLowerCase());

	for (const pref of dietaryPrefs) {
		if (!(pref in DIETARY_RESTRICTIONS)) {
			continue;
		}

		const restriction = DIETARY_RESTRICTIONS[pref];

		// Check custom function if exists
		if (restriction.customCheck) {
			if (!restriction.customCheck(tagsLower)) {
				return false;
			}
		} else {
			// Check required tags
			if (restriction.requiredTags) {
				if (
					!restriction.requiredTags.some((reqTag) => tagsLower.includes(reqTag))
				) {
					return false;
				}
			}

			// Check forbidden tags
			if (restriction.forbiddenTags) {
				if (
					restriction.forbiddenTags.some((forbiddenTag) =>
						tagsLower.includes(forbiddenTag),
					)
				) {
					return false;
				}
			}
		}
	}

	return true;
}

export async function selectBestRecipes(
	mealType: string,
	targetCalories: number,
	inventory: Inventory,
	dietaryPrefs: string[] = [],
): Promise<Recipe[]> {
	const lowerBound = targetCalories - CALORIE_MARGIN;
	const upperBound = targetCalories + CALORIE_MARGIN;
	const categories = MEAL_TYPE_TO_CATEGORIES[mealType] || [];

	if (categories.length === 0) {
		return [];
	}

	// Query recipes
	const results = await db
		.select({
			id: recipes.id,
			name: recipes.name,
			description: recipes.description,
			category: recipes.category,
			cuisine: recipes.cuisine,
			difficulty: recipes.difficulty,
			ingredients: recipes.ingredients,
			meta: recipes.meta,
			nutrition: recipes.nutrition,
			calories: recipes.calories,
			dietary: recipes.dietary,
			tags: recipes.tags,
		})
		.from(recipes)
		.where(inArray(recipes.category, categories));

	const sortedResults: Recipe[] = [];

	for (const row of results) {
		// Parse JSON fields
		const ingredientGroups = JSON.parse(row.ingredients || "[]");
		const meta = JSON.parse(row.meta || "{}");
		const nutrition = JSON.parse(row.nutrition || "{}").per_serving || {};
		const dietary = JSON.parse(row.dietary || "{}");
		const recipeTags =
			typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags || [];

		// Check dietary restrictions
		if (!checkDietaryRestrictions(recipeTags, dietaryPrefs)) {
			continue;
		}

		// Check calorie range
		const calories = row.calories || 0;
		if (calories < lowerBound || calories > upperBound) {
			continue;
		}

		// Calculate ingredient coverage
		const ingredients: Ingredient[] = [];
		for (const group of ingredientGroups) {
			for (const ingredient of group.items || []) {
				const name = ingredient.name.toLowerCase();
				let quantity = ingredient.quantity || 0;

				const hasSmallUnit = ["g", "ml"].includes(ingredient.unit);
				if (hasSmallUnit) {
					quantity /= 1000; // Normalize measurements
				}

				const unit =
					ingredient.unit === "g" ? "kg" : ingredient.unit === "ml" ? "l" : "";

				ingredients.push({
					name,
					quantity: parseFloat(quantity || 0),
					unit,
				});
			}
		}

		const recipe: Recipe = {
			id: row.id,
			name: row.name || "",
			description: row.description || "",
			category: row.category || "",
			cuisine: row.cuisine || "",
			difficulty: row.difficulty || "",
			calories,
			totalTime: meta.total_time || "N/A",
			activeTime: meta.active_time || "N/A",
			yields: meta.yields || "N/A",
			proteinG: nutrition.protein_g || 0,
			fatG: nutrition.fat_g || 0,
			carbsG: nutrition.carbohydrates_g || 0,
			fiberG: nutrition.fiber_g || 0,
			isVegetarian: dietary.is_vegetarian || false,
			isVegan: dietary.is_vegan || false,
			isGlutenFree: dietary.is_gluten_free || false,
			tags: recipeTags,
			ingredients: ingredients,
			coverageScore: inventoryCoverageScore(ingredients, inventory),
		};

		sortedResults.push(recipe);
	}

	// Sort by coverage score descending
	sortedResults.sort((a, b) => b.coverageScore - a.coverageScore);

	return sortedResults.slice(0, 5);
}

export async function aiSuggestBestRecipe(
	recipesList: Recipe[],
	mealType: string,
	targetCalories: number,
	userInventory: Inventory,
	previousMeals: SelectedRecipe[] = [],
): Promise<SelectedRecipe | null> {
	if (recipesList.length === 0) {
		return null;
	}

	// Prepare recipe information for the AI
	const recipesInfo = recipesList.map((recipe, idx) => ({
		index: idx,
		name: recipe.name,
		cuisine: recipe.cuisine,
		difficulty: recipe.difficulty,
		calories: recipe.calories,
		totalTime: recipe.totalTime,
		proteinG: recipe.proteinG,
		fatG: recipe.fatG,
		carbsG: recipe.carbsG,
		isVegetarian: recipe.isVegetarian,
		isVegan: recipe.isVegan,
		isGlutenFree: recipe.isGlutenFree,
		coverageScore: recipe.coverageScore,
		description: `${recipe.description.substring(0, 150)}...`,
	}));

	// Prepare previous meals context
	const previousMealsSummary = previousMeals.map((meal) => ({
		mealType: meal.mealType,
		name: meal.name,
		cuisine: meal.cuisine,
		calories: meal.calories,
		proteinG: meal.proteinG,
		fatG: meal.fatG,
		carbsG: meal.carbsG,
	}));

	// Create a detailed prompt
	const prompt = `You are a meal planning assistant. Help choose the best recipe for ${mealType}.

Target calories: ${targetCalories.toFixed(0)} calories (±${CALORIE_MARGIN} is acceptable)

Available inventory:
${JSON.stringify(userInventory, null, 2)}

Previously selected meals today:
${previousMealsSummary.length > 0 ? JSON.stringify(previousMealsSummary, null, 2) : "None - this is the first meal"}

Recipe options (sorted by ingredient availability):
${JSON.stringify(recipesInfo, null, 2)}

Coverage score indicates how many ingredients the user already has (0-1 scale, higher is better).

Please analyze these recipes and recommend the BEST ONE considering:
1. How closely calories match the target
2. Ingredient availability (coverage score)
3. Variety and nutrition balance across the day (avoid repeating cuisines or flavors)
4. Complementing previous meals (balance macros across the day)
5. Practicality for ${mealType} (time, difficulty)
6. Dietary considerations

Respond with ONLY the index number (0-${recipesList.length - 1}) of the best recipe, followed by a brief explanation on the next line.
Format:
<index>
<reason>`;

	// Call OpenAI API
	try {
		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "system",
					content:
						"You are a helpful meal planning assistant. Respond concisely with just an index number and brief reason.",
				},
				{ role: "user", content: prompt },
			],
			temperature: 0.7,
			max_tokens: 300,
		});

		const responseText = response.choices[0].message.content?.trim() || "";
		const lines = responseText.split("\n", 2);

		const selectedIndex = parseInt(lines[0], 10);
		const reason = lines.length > 1 ? lines[1] : "AI recommendation";

		if (selectedIndex >= 0 && selectedIndex < recipesList.length) {
			const selectedRecipe = { ...recipesList[selectedIndex] };
			return {
				...selectedRecipe,
				aiReason: reason,
			};
		}
	} catch (error) {
		console.error("Error calling OpenAI API:", error);
	}

	// Fallback to highest coverage score
	return recipesList[0];
}

export async function planDailyMeals(
	totalCalories: number,
	calorieDistribution: Record<string, number>,
	initialInventory: Inventory,
	dietaryPrefs: string[] = [],
) {
	const mealOrder = ["Breakfast", "Lunch", "Snacks", "Dinner"];
	const dailyMealPlan: Record<string, SelectedRecipe> = {};
	const allSelectedMeals: SelectedRecipe[] = [];
	let dailyConsumedCalories = 0;
	let dailyRemainingCalories = totalCalories;
	let currentInventory = [ ...initialInventory ];

	for (const mealType of mealOrder) {
		// Calculate target calories based on original distribution
		const originalTarget = calorieDistribution[mealType];

		// Adjust if we're running low on remaining calories
		const adjustedTarget =
			mealType === "Dinner"
				? dailyRemainingCalories
				: Math.min(originalTarget, dailyRemainingCalories * 0.5);

		// Find candidate recipes
		const candidateRecipes = await selectBestRecipes(
			mealType,
			adjustedTarget,
			currentInventory,
			dietaryPrefs,
		);

		if (candidateRecipes.length === 0) {
			console.warn(`No recipes found for ${mealType}`);
			continue;
		}

		// Use AI to select the best recipe
		const selectedRecipe = await aiSuggestBestRecipe(
			candidateRecipes,
			mealType,
			adjustedTarget,
			currentInventory,
			allSelectedMeals,
		);

		if (selectedRecipe) {
			selectedRecipe.mealType = mealType;

			// Update tracking
			dailyMealPlan[mealType] = selectedRecipe;
			allSelectedMeals.push(selectedRecipe);
			dailyConsumedCalories += selectedRecipe.calories;
			dailyRemainingCalories = totalCalories - dailyConsumedCalories;

			// Update inventory
			currentInventory = deductIngredientsFromInventory(
				currentInventory,
				selectedRecipe.ingredients,
			);
		}
	}

	return {
		meals: dailyMealPlan,
		totalCalories: dailyConsumedCalories,
		finalInventory: currentInventory,
	};
}
