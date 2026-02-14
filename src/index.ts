import { Hono } from "hono";
import { dbMiddleware, getDb } from "./db";
import { createAuth } from "./utils/auth";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("*", dbMiddleware);

app.on(["POST", "GET"], "/api/auth/**", async (c) => {
	const db = getDb(c);
	const auth = createAuth(db, c.env);
	return auth.handler(c.req.raw);
});

app.get("/message", (c) => {
	return c.text("Hello Hono!");
});

app.get("/", (c) => {
	return c.text("asdas");
});

app.get("/protected", async (c) => {
	const db = getDb(c);
	const auth = createAuth(db, c.env);

	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	return c.json({ message: "Protected data", user: session.user });
});

export default app;
