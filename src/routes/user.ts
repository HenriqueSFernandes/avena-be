import { Elysia, t } from "elysia";
import { db } from "../lib/db";
import { user } from "../db/schema/auth";
import { eq } from "drizzle-orm";
import { calculateTMB } from "../lib/tmb";
import { betterAuth } from "../lib/auth-middleware";

const genderEnum = t.Union([
	t.Literal("male"),
	t.Literal("female"),
	t.Literal("other"),
]);

const activityLevelEnum = t.Union([
	t.Literal("sedentary"),
	t.Literal("lightly active"),
	t.Literal("moderately active"),
	t.Literal("very active"),
	t.Literal("extra active"),
]);

const healthGoalEnum = t.Union([
	t.Literal("lose weight"),
	t.Literal("stay fit"),
	t.Literal("build muscle"),
	t.Literal("eat healthier"),
]);

const mealEnum = t.Union([
	t.Literal("breakfast"),
	t.Literal("brunch"),
	t.Literal("lunch"),
	t.Literal("afternoon"),
	t.Literal("dinner"),
	t.Literal("midnight snack"),
]);

const updateProfileSchema = t.Object({
	gender: t.Optional(genderEnum),
	age: t.Optional(t.Number({ minimum: 0, maximum: 150 })),
	weight: t.Optional(t.Number({ minimum: 0, maximum: 500 })),
	height: t.Optional(t.Number({ minimum: 0, maximum: 300 })),
	activityLevel: t.Optional(activityLevelEnum),
	healthGoal: t.Optional(healthGoalEnum),
	meals: t.Optional(t.Array(mealEnum)),
});

export const userRoutes = new Elysia({ prefix: "/api/user" })
	.use(betterAuth)
	.get(
		"/profile",
		async ({ user: currentUser }) => {
			const [userData] = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					image: user.image,
					gender: user.gender,
					age: user.age,
					weight: user.weight,
					height: user.height,
					activityLevel: user.activityLevel,
					healthGoal: user.healthGoal,
					tmb: user.tmb,
					meals: user.meals,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				})
				.from(user)
				.where(eq(user.id, currentUser.id))
				.limit(1);

			if (!userData) {
				throw new Error("User not found");
			}

			return userData;
		},
		{
			auth: true,
			detail: {
				summary: "Get user profile",
				description: "Get the authenticated user's profile information",
				tags: ["User"],
			},
		},
	)
	.patch(
		"/profile",
		async ({ user: currentUser, body }) => {
			const updateData: Record<string, unknown> = { ...body };

			const [currentData] = await db
				.select()
				.from(user)
				.where(eq(user.id, currentUser.id))
				.limit(1);

			if (!currentData) {
				throw new Error("User not found");
			}

			const gender = body.gender ?? currentData.gender;
			const age = body.age ?? currentData.age;
			const weight = body.weight ?? currentData.weight;
			const height = body.height ?? currentData.height;
			const activityLevel = body.activityLevel ?? currentData.activityLevel;

			if (gender && age && weight && height) {
				updateData.tmb = calculateTMB(
					gender,
					age,
					weight,
					height,
					activityLevel ?? undefined,
				);
			}

			const [updatedUser] = await db
				.update(user)
				.set(updateData)
				.where(eq(user.id, currentUser.id))
				.returning({
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					image: user.image,
					gender: user.gender,
					age: user.age,
					weight: user.weight,
					height: user.height,
					activityLevel: user.activityLevel,
					healthGoal: user.healthGoal,
					tmb: user.tmb,
					meals: user.meals,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				});

			return updatedUser;
		},
		{
			auth: true,
			body: updateProfileSchema,
			detail: {
				summary: "Update user profile",
				description:
					"Update the authenticated user's profile information. TMB is automatically calculated when gender, age, weight, and height are provided.",
				tags: ["User"],
			},
		},
	);
