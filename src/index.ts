import { Hono } from "hono";
import { dbMiddleware, getDb } from "./db";
import { type Auth, createAuth, type Session } from "./utils/auth";
import { requireAuth } from "./utils/middleware";

const app = new Hono<{
	Bindings: CloudflareBindings;
	Variables: {
		user: Session["user"] | null;
		session: Session["session"] | null;
		auth: Auth;
	};
}>();

app.use("*", dbMiddleware);

app.use("*", async (c, next) => {
	const db = getDb(c);
	const auth = createAuth(db, c.env);
	c.set("auth", auth);
	await next();
});

app.on(["POST", "GET"], "/api/auth/**", async (c) => {
	const auth = c.get("auth");
	if (!auth) {
		return c.json({ error: "Authentication not configured" }, 500);
	}
	return auth.handler(c.req.raw);
});

app.get("/message", (c) => {
	return c.text("Hello Hono!");
});

app.get("/", (c) => {
	return c.text("asdas");
});

app.get("/protected", requireAuth, async (c) => {
	const user = c.get("user");
	return c.json({ message: "Protected data", user });
});

export default app;
