import { relations } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const recipes = sqliteTable("recipes", {
	id: text("id", { length: 36 }).primaryKey(),
	name: text("name"),
	description: text("description"),
	category: text("category"),
	cuisine: text("cuisine"),
	difficulty: text("difficulty"),
	ingredients: text("ingredients"),
	instructions: text("instructions"),
	meta: text("meta"),
	dietary: text("dietary"),
	nutrition: text("nutrition"),
	storage: text("storage"),
	equipment: text("equipment"),
	troubleshooting: text("troubleshooting"),
	chefNotes: text("chef_notes"),
	culturalContext: text("cultural_context"),
});

export const tags = sqliteTable("tags", {
	id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
});

export const recipeTags = sqliteTable(
	"recipe_tags",
	{
		recipeId: text("recipe_id", { length: 36 })
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		tagId: integer("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.recipeId, table.tagId] })],
);

export const recipesRelations = relations(recipes, ({ many }) => ({
	recipeTags: many(recipeTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
	recipeTags: many(recipeTags),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
	recipe: one(recipes, {
		fields: [recipeTags.recipeId],
		references: [recipes.id],
	}),
	tag: one(tags, {
		fields: [recipeTags.tagId],
		references: [tags.id],
	}),
}));
