import { cors } from "@elysiajs/cors";
import { openapi } from '@elysiajs/openapi'
import { Elysia } from "elysia";
import { betterAuth } from "./lib/auth-middleware";

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
	.listen({
		port: 3000,
		hostname: "0.0.0.0",
	});

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
