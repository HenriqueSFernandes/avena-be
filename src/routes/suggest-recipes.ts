import Elysia from "elysia";
import { betterAuth } from "../lib/auth-middleware";
import { db } from "../lib/db";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";
import { calculateCaloricNeeds, Ingredient, planDailyMeals, suggestCalorieDistribution } from "../lib/meal-planner";

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
  .post("/", async ({ body, user: currentUser }) => {
    try {
			// Type cast the body for TypeScript
			const requestBody = body as {
				inventory: Ingredient[];
			};

			if (!requestBody.inventory) {
				return {
					success: false,
					error: "inventory is required",
				};
			}

      const [userData] = await db
        .select({
          gender: user.gender,
          height: user.height,
          weight: user.weight,
          age: user.age,
          activityLevel: user.activityLevel,
					dietaryRestrictions: user.dietaryRestrictions,
        })
        .from(user)
        .where(eq(user.id, currentUser.id))
        .limit(1);

			if (!userData || !userData.gender || !userData.height || !userData.weight || !userData.age || !userData.activityLevel) {
				return {
					success: false,
					error: "Incomplete user profile. Please update your profile with gender, height, weight, age, and activity level.",
				};
			}

			const userProfile = {
				male: userData.gender === "male",
				height: userData.height,
				weight: userData.weight,
				age: userData.age,
				activityLevel: toNumberActivityLevel(userData.activityLevel),
				dietaryRestrictions: userData.dietaryRestrictions ?? [],
			};

			const inventory = requestBody.inventory;

			// Calculate caloric needs
			const totalCalories = calculateCaloricNeeds(userProfile);

			// Get calorie distribution across meals
			const calorieDistribution = suggestCalorieDistribution(totalCalories);

			// Plan daily meals
			const mealPlan = await planDailyMeals(
				totalCalories,
				calorieDistribution,
				inventory,
				userProfile.dietaryRestrictions
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
  }, {
    auth: true,
    detail: {
      summary: "Suggest recipes based on user profile and inventory",
      description: "Suggest recipes based on the authenticated user's profile and available ingredients",
      tags: ["Recipes"],
    },
  });



