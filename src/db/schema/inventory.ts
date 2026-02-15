import { relations } from "drizzle-orm";
import {
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const unitEnum = pgEnum("unit", ["", "kg", "l"]);

export const inventoryItem = pgTable(
	"inventory_item",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		quantity: real("quantity").notNull(),
		unit: unitEnum("unit").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		userItemUnique: unique("user_item_unique").on(table.userId, table.name),
	}),
);

export const inventoryItemRelations = relations(inventoryItem, ({ one }) => ({
	user: one(user, {
		fields: [inventoryItem.userId],
		references: [user.id],
	}),
}));
