import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const recipes = pgTable("recipes", {
	id: text("id").primaryKey(),
	name: text("name"),
	description: text("description"),
	category: text("category"),
	cuisine: text("cuisine"),
	difficulty: text("difficulty"),
	tags: text("tags"),
	ingredients: text("ingredients"),
	instructions: text("instructions"),
	meta: text("meta"),
	dietary: text("dietary"),
	nutrition: text("nutrition"),
	calories: integer("calories"),
	storage: text("storage"),
	equipment: text("equipment"),
	troubleshooting: text("troubleshooting"),
	chefNotes: text("chef_notes"),
	culturalContext: text("cultural_context"),
});
