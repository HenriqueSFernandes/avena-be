import { generateId } from "better-auth";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { inventoryItem } from "../db/schema/inventory";
import { betterAuth } from "../lib/auth-middleware";
import { db } from "../lib/db";

const unitEnum = t.Union([t.Literal("kg"), t.Literal("l")]);

const addItemSchema = t.Object({
	name: t.String({ minLength: 1 }),
	quantity: t.Number({ minimum: 0, exclusiveMinimum: true }),
	unit: t.Optional(unitEnum),
});

const updateItemSchema = t.Object({
	name: t.Optional(t.String({ minLength: 1 })),
	quantity: t.Optional(t.Number({ minimum: 0, exclusiveMinimum: true })),
	unit: t.Optional(unitEnum),
});

export const inventoryRoutes = new Elysia({ prefix: "/api/inventory" })
	.use(betterAuth)
	.get(
		"/",
		async ({ user: currentUser }) => {
			const items = await db
				.select({
					id: inventoryItem.id,
					name: inventoryItem.name,
					quantity: inventoryItem.quantity,
					unit: inventoryItem.unit,
					createdAt: inventoryItem.createdAt,
					updatedAt: inventoryItem.updatedAt,
				})
				.from(inventoryItem)
				.where(eq(inventoryItem.userId, currentUser.id));

			return items;
		},
		{
			auth: true,
			detail: {
				summary: "Get user inventory",
				description: "Get all inventory items for the authenticated user",
				tags: ["Inventory"],
			},
		},
	)
	.post(
		"/",
		async ({ user: currentUser, body, status }) => {
			const existingItem = await db
				.select()
				.from(inventoryItem)
				.where(
					and(
						eq(inventoryItem.userId, currentUser.id),
						eq(inventoryItem.name, body.name),
					),
				)
				.limit(1);

			if (existingItem.length > 0) {
				const newQuantity = existingItem[0].quantity + body.quantity;
				const [updatedItem] = await db
					.update(inventoryItem)
					.set({ quantity: newQuantity })
					.where(eq(inventoryItem.id, existingItem[0].id))
					.returning({
						id: inventoryItem.id,
						name: inventoryItem.name,
						quantity: inventoryItem.quantity,
						unit: inventoryItem.unit,
						createdAt: inventoryItem.createdAt,
						updatedAt: inventoryItem.updatedAt,
					});

				return updatedItem;
			}

			const [newItem] = await db
				.insert(inventoryItem)
				.values({
					id: generateId(),
					userId: currentUser.id,
					name: body.name,
					quantity: body.quantity,
					unit: body.unit ?? "",
				})
				.returning({
					id: inventoryItem.id,
					name: inventoryItem.name,
					quantity: inventoryItem.quantity,
					unit: inventoryItem.unit,
					createdAt: inventoryItem.createdAt,
					updatedAt: inventoryItem.updatedAt,
				});

			status(201);
			return newItem;
		},
		{
			auth: true,
			body: addItemSchema,
			detail: {
				summary: "Add inventory item",
				description:
					"Add a new item to inventory. If item with same name exists, quantities will be merged.",
				tags: ["Inventory"],
			},
		},
	)
	.patch(
		"/:id",
		async ({ user: currentUser, params: { id }, body, status }) => {
			const [existingItem] = await db
				.select()
				.from(inventoryItem)
				.where(eq(inventoryItem.id, id))
				.limit(1);

			if (!existingItem) {
				status(404);
				return { error: "Item not found" };
			}

			if (existingItem.userId !== currentUser.id) {
				status(403);
				return { error: "Forbidden" };
			}

			if (body.name && body.name !== existingItem.name) {
				const duplicateCheck = await db
					.select()
					.from(inventoryItem)
					.where(
						and(
							eq(inventoryItem.userId, currentUser.id),
							eq(inventoryItem.name, body.name),
						),
					)
					.limit(1);

				if (duplicateCheck.length > 0) {
					status(409);
					return { error: "Item with this name already exists" };
				}
			}

			const [updatedItem] = await db
				.update(inventoryItem)
				.set(body)
				.where(eq(inventoryItem.id, id))
				.returning({
					id: inventoryItem.id,
					name: inventoryItem.name,
					quantity: inventoryItem.quantity,
					unit: inventoryItem.unit,
					createdAt: inventoryItem.createdAt,
					updatedAt: inventoryItem.updatedAt,
				});

			return updatedItem;
		},
		{
			auth: true,
			body: updateItemSchema,
			detail: {
				summary: "Update inventory item",
				description: "Update an inventory item's name, quantity, or unit",
				tags: ["Inventory"],
			},
		},
	)
	.delete(
		"/:id",
		async ({ user: currentUser, params: { id }, status }) => {
			const [existingItem] = await db
				.select()
				.from(inventoryItem)
				.where(eq(inventoryItem.id, id))
				.limit(1);

			if (!existingItem) {
				status(404);
				return { error: "Item not found" };
			}

			if (existingItem.userId !== currentUser.id) {
				status(403);
				return { error: "Forbidden" };
			}

			await db.delete(inventoryItem).where(eq(inventoryItem.id, id));

			status(204);
			return;
		},
		{
			auth: true,
			detail: {
				summary: "Delete inventory item",
				description: "Delete an inventory item",
				tags: ["Inventory"],
			},
		},
	);
