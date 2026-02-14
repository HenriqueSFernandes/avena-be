import { cors } from "@elysiajs/cors";
import { openapi } from '@elysiajs/openapi'
import { Elysia } from "elysia";
import { betterAuth } from "./lib/auth-middleware";
import {
	calculateCaloricNeeds,
	suggestCalorieDistribution,
	planDailyMeals,
} from "./lib/meal-planner";

const app = new Elysia()
	.use(
		cors({
			origin: "*",
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	.use(betterAuth)
	.use(openapi())
	.get("/protected", ({ user }) => user, {
		auth: true,
	})
	.post("/suggest-recipes", async () => {
		try {
			// Hardcoded user profile (from notebook)
			const userProfile = {
				male: true,
				height: 183, // cm
				weight: 81, // kg
				age: 21,
				activityLevel: 1.55, // Moderately active
				dietaryRestrictions: [], // e.g., ['vegan', 'gluten-free', 'no-pork', 'no-alcohol']
			};

			// Hardcoded inventory (from notebook)
			const inventory = {
				egg: 2,
				milk: 0.5, // l
				flour: 0.2, // kg
				sugar: 0.1, // kg
				butter: 0.05, // kg
				salt: 0.01, // kg
			};

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
	})
	.listen({
		port: 3000,
		hostname: "0.0.0.0",
	});

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
