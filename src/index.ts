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
	.post("/suggest-recipes", async ({ body }) => {
		try {
			// Type cast the body for TypeScript
			const requestBody = body as {
				userProfile: {
					male: boolean;
					height: number;
					weight: number;
					age: number;
					activityLevel: number;
					dietaryRestrictions?: string[];
				};
				inventory: Record<string, number>;
			};

			// Validate required fields
			if (!requestBody.userProfile) {
				return {
					success: false,
					error: "userProfile is required",
				};
			}

			if (!requestBody.inventory) {
				return {
					success: false,
					error: "inventory is required",
				};
			}

			const userProfile = {
				male: requestBody.userProfile.male,
				height: requestBody.userProfile.height,
				weight: requestBody.userProfile.weight,
				age: requestBody.userProfile.age,
				activityLevel: requestBody.userProfile.activityLevel,
				dietaryRestrictions: requestBody.userProfile.dietaryRestrictions ?? [],
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
	})
	.listen({
		port: 3000,
		hostname: "0.0.0.0",
	});

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
