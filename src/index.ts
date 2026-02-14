import "dotenv/config";
import { cors } from "@elysiajs/cors";
import { openapi } from '@elysiajs/openapi'
import { Elysia } from "elysia";
import { betterAuth } from "./lib/auth-middleware";
import { inventoryRoutes } from "./routes/inventory";
import { suggestRecipes } from "./routes/suggest-recipes";
import { userRoutes } from "./routes/user";

const app = new Elysia()
	.use(
		cors({
			origin: "*",
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	.use(betterAuth)
	.use(openapi())
	.use(userRoutes)
	.use(inventoryRoutes)
	.use(suggestRecipes)
	.listen({
		port: 3000,
		hostname: "0.0.0.0",
	});

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
