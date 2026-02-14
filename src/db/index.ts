import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import type { Context, MiddlewareHandler } from "hono";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

export const dbMiddleware: MiddlewareHandler<{
	Bindings: CloudflareBindings;
}> = async (c, next) => {
	const db = drizzle(c.env.avena_db, { schema });
	c.set("db", db);
	await next();
};

export const getDb = (
	c: Context<{ Bindings: CloudflareBindings }>,
): Database => {
	return c.get("db") as Database;
};
