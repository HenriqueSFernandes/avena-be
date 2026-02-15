import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { inventoryItem, user } from "../db/schema";
import { betterAuth } from "../lib/auth-middleware";
import { db } from "../lib/db";
import {
	calculateCaloricNeeds,
	type Ingredient,
	planDailyMeals,
	suggestCalorieDistribution,
} from "../lib/meal-planner";

const suggestRecipesSchema = t.Object({
	ignoreInventory: t.Optional(t.Boolean()),
});

const toNumberActivityLevel = (activityLevel: string): number => {
	switch (activityLevel) {
		case "sedentary":
			return 1.2;
		case "lightly active":
			return 1.375;
		case "moderately active":
			return 1.55;
		case "very active":
			return 1.725;
		case "extra active":
			return 1.9;
		default:
			return 1.2; // Default to sedentary if unknown
	}
};

export const suggestRecipes = new Elysia({ prefix: "/api/suggest-recipes" })
	.use(betterAuth)
	.post(
		"/",
		async ({ body, user: currentUser }) => {
			try {
				const ignoreInventory = body.ignoreInventory ?? false;

				const [userData] = await db
					.select({
						gender: user.gender,
						height: user.height,
						weight: user.weight,
						age: user.age,
						activityLevel: user.activityLevel,
						meals: user.meals,
						dietaryRestrictions: user.dietaryRestrictions,
					})
					.from(user)
					.where(eq(user.id, currentUser.id))
					.limit(1);

				if (
					!userData ||
					!userData.gender ||
					!userData.height ||
					!userData.weight ||
					!userData.age ||
					!userData.activityLevel ||
					!userData.meals
				) {
					return {
						success: false,
						error:
							"Incomplete user profile. Please update your profile with gender, height, weight, age, activity level, and meals.",
					};
				}

				const userProfile = {
					male: userData.gender === "male",
					height: userData.height,
					weight: userData.weight,
					age: userData.age,
					activityLevel: toNumberActivityLevel(userData.activityLevel),
					meals: userData.meals,
					dietaryRestrictions: userData.dietaryRestrictions ?? [],
				};

				const inventory = ignoreInventory
					? []
					: await db
							.select()
							.from(inventoryItem)
							.where(eq(inventoryItem.userId, currentUser.id))
							.then((items) =>
								items.map(
									(item) =>
										({
											name: item.name,
											quantity: item.quantity,
											unit: item.unit,
										}) as Ingredient,
								),
							);

				// Calculate caloric needs
				const totalCalories = calculateCaloricNeeds(userProfile);

				// Get calorie distribution across meals
				const calorieDistribution = suggestCalorieDistribution(totalCalories, userProfile.meals);

				// Plan daily meals
				const mealPlan = await planDailyMeals(
					totalCalories,
					calorieDistribution,
					inventory,
					userProfile.dietaryRestrictions,
				);

				return {
					success: true,
					userProfile,
					totalCalories,
					calorieDistribution,
					mealPlan,
				};
			} catch (error) {
				console.error("Error in /suggest-recipes:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		},
		{
			auth: true,
			body: suggestRecipesSchema,
			detail: {
				summary: "Suggest recipes",
				description:
					"Generate daily meal plan with recipes based on the authenticated user's profile and available ingredients. Optionally ignore inventory to get recommendations without considering available items.",
				tags: ["Recipes"],
			},
		},
	);
