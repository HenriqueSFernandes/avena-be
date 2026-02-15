import { generateId } from "better-auth";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { recipes, weeklyMealPlan } from "../db/schema";
import { betterAuth } from "../lib/auth-middleware";
import { db } from "../lib/db";

const mealTypeValidator = t.Union([
	t.Literal("breakfast"),
	t.Literal("morning snack"),
	t.Literal("brunch"),
	t.Literal("lunch"),
	t.Literal("afternoon snack"),
	t.Literal("dinner"),
	t.Literal("midnight snack"),
]);

const saveMealSchema = t.Object({
	weekStartDate: t.String({ format: "date" }),
	dayOfWeek: t.Integer({ minimum: 1, maximum: 7 }),
	mealType: mealTypeValidator,
	recipeId: t.String({ minLength: 1 }),
});

const updateMealSchema = t.Object({
	recipeId: t.String({ minLength: 1 }),
});

export const mealPlanRoutes = new Elysia({ prefix: "/api/meal-plan" })
	.use(betterAuth)
	.post(
		"/",
		async ({ body, user: currentUser, status }) => {
			const [recipe] = await db
				.select({ id: recipes.id })
				.from(recipes)
				.where(eq(recipes.id, body.recipeId))
				.limit(1);

			if (!recipe) {
				status(404);
				return { error: "Recipe not found" };
			}

			const [existingMeal] = await db
				.select()
				.from(weeklyMealPlan)
				.where(
					and(
						eq(weeklyMealPlan.userId, currentUser.id),
						eq(weeklyMealPlan.weekStartDate, body.weekStartDate),
						eq(weeklyMealPlan.dayOfWeek, body.dayOfWeek),
						eq(weeklyMealPlan.mealType, body.mealType),
					),
				)
				.limit(1);

			if (existingMeal) {
				const [updatedMeal] = await db
					.update(weeklyMealPlan)
					.set({
						recipeId: body.recipeId,
					})
					.where(eq(weeklyMealPlan.id, existingMeal.id))
					.returning();

				return updatedMeal;
			}

			const [newMeal] = await db
				.insert(weeklyMealPlan)
				.values({
					id: generateId(),
					userId: currentUser.id,
					weekStartDate: body.weekStartDate,
					dayOfWeek: body.dayOfWeek,
					mealType: body.mealType,
					recipeId: body.recipeId,
				})
				.returning();

			status(201);
			return newMeal;
		},
		{
			auth: true,
			body: saveMealSchema,
			detail: {
				summary: "Save meal to weekly plan",
				description:
					"Save a meal to the weekly plan. If a meal already exists for the same slot (user + week + day + meal type), it will be updated instead.",
				tags: ["Meal Plan"],
			},
		},
	)
	.get(
		"/",
		async ({ query, user: currentUser }) => {
			const weekStartDate = query.weekStartDate || getCurrentWeekMonday();

			const meals = await db
				.select({
					id: weeklyMealPlan.id,
					userId: weeklyMealPlan.userId,
					weekStartDate: weeklyMealPlan.weekStartDate,
					dayOfWeek: weeklyMealPlan.dayOfWeek,
					mealType: weeklyMealPlan.mealType,
					recipeId: weeklyMealPlan.recipeId,
					createdAt: weeklyMealPlan.createdAt,
					updatedAt: weeklyMealPlan.updatedAt,
					recipe: {
						id: recipes.id,
						name: recipes.name,
						description: recipes.description,
						category: recipes.category,
						cuisine: recipes.cuisine,
						difficulty: recipes.difficulty,
						tags: recipes.tags,
						ingredients: recipes.ingredients,
						instructions: recipes.instructions,
						meta: recipes.meta,
						dietary: recipes.dietary,
						nutrition: recipes.nutrition,
						calories: recipes.calories,
					},
				})
				.from(weeklyMealPlan)
				.leftJoin(recipes, eq(weeklyMealPlan.recipeId, recipes.id))
				.where(
					and(
						eq(weeklyMealPlan.userId, currentUser.id),
						eq(weeklyMealPlan.weekStartDate, weekStartDate),
					),
				)
				.orderBy(weeklyMealPlan.dayOfWeek, weeklyMealPlan.mealType);

			return {
				weekStartDate,
				meals,
			};
		},
		{
			auth: true,
			query: t.Object({
				weekStartDate: t.Optional(t.String({ format: "date" })),
			}),
			detail: {
				summary: "Get weekly meal plan",
				description:
					"Get all saved meals for a specific week. If no week is specified, returns the current week's plan (starting Monday).",
				tags: ["Meal Plan"],
			},
		},
	)
	.patch(
		"/:id",
		async ({ params: { id }, body, user: currentUser, status }) => {
			// Verify meal plan entry exists and belongs to user
			const [existingMeal] = await db
				.select()
				.from(weeklyMealPlan)
				.where(eq(weeklyMealPlan.id, id))
				.limit(1);

			if (!existingMeal) {
				status(404);
				return { error: "Meal plan entry not found" };
			}

			if (existingMeal.userId !== currentUser.id) {
				status(403);
				return { error: "Forbidden" };
			}

			// Verify new recipe exists
			const [recipe] = await db
				.select({ id: recipes.id })
				.from(recipes)
				.where(eq(recipes.id, body.recipeId))
				.limit(1);

			if (!recipe) {
				status(404);
				return { error: "Recipe not found" };
			}

			const [updatedMeal] = await db
				.update(weeklyMealPlan)
				.set({ recipeId: body.recipeId })
				.where(eq(weeklyMealPlan.id, id))
				.returning();

			return updatedMeal;
		},
		{
			auth: true,
			body: updateMealSchema,
			detail: {
				summary: "Update meal in weekly plan",
				description:
					"Update a specific meal in the weekly plan by replacing its recipe.",
				tags: ["Meal Plan"],
			},
		},
	)
	.delete(
		"/:id",
		async ({ params: { id }, user: currentUser, status }) => {
			const [existingMeal] = await db
				.select()
				.from(weeklyMealPlan)
				.where(eq(weeklyMealPlan.id, id))
				.limit(1);

			if (!existingMeal) {
				status(404);
				return { error: "Meal plan entry not found" };
			}

			if (existingMeal.userId !== currentUser.id) {
				status(403);
				return { error: "Forbidden" };
			}

			await db.delete(weeklyMealPlan).where(eq(weeklyMealPlan.id, id));

			status(204);
			return;
		},
		{
			auth: true,
			detail: {
				summary: "Delete meal from weekly plan",
				description: "Remove a specific meal from the weekly plan.",
				tags: ["Meal Plan"],
			},
		},
	)
	.delete(
		"/week",
		async ({ query, user: currentUser, status }) => {
			const weekStartDate = query.weekStartDate || getCurrentWeekMonday();

			await db
				.delete(weeklyMealPlan)
				.where(
					and(
						eq(weeklyMealPlan.userId, currentUser.id),
						eq(weeklyMealPlan.weekStartDate, weekStartDate),
					),
				);

			status(204);
			return;
		},
		{
			auth: true,
			query: t.Object({
				weekStartDate: t.Optional(t.String({ format: "date" })),
			}),
			detail: {
				summary: "Delete entire weekly meal plan",
				description:
					"Delete all meals for a specific week. If no week is specified, deletes the current week's plan.",
				tags: ["Meal Plan"],
			},
		},
	);

function getCurrentWeekMonday(): string {
	const today = new Date();
	const day = today.getDay();
	const diff = day === 0 ? -6 : 1 - day; // If Sunday (0), go back 6 days, otherwise go to Monday
	const monday = new Date(today);
	monday.setDate(today.getDate() + diff);
	return monday.toISOString().split("T")[0];
}
