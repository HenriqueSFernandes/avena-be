import { relations } from "drizzle-orm";
import {
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { mealEnum, user } from "./auth";
import { recipes } from "./recipes";

export const weeklyMealPlan = pgTable(
	"weekly_meal_plan",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		weekStartDate: date("week_start_date").notNull(),
		dayOfWeek: integer("day_of_week").notNull(), // 1-7 (Monday-Sunday)
		mealType: mealEnum("meal_type").notNull(),
		recipeId: text("recipe_id").references(() => recipes.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("weekly_meal_plan_userId_idx").on(table.userId),
		index("weekly_meal_plan_weekStartDate_idx").on(table.weekStartDate),
		unique("weekly_meal_plan_unique_slot").on(
			table.userId,
			table.weekStartDate,
			table.dayOfWeek,
			table.mealType,
		),
	],
);

export const weeklyMealPlanRelations = relations(weeklyMealPlan, ({ one }) => ({
	user: one(user, {
		fields: [weeklyMealPlan.userId],
		references: [user.id],
	}),
	recipe: one(recipes, {
		fields: [weeklyMealPlan.recipeId],
		references: [recipes.id],
	}),
}));
