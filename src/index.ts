import { Hono } from "hono";
import { dbMiddleware, getDb } from "./db";
import { createAuth, type Session } from "./utils/auth";
import { requireAuth } from "./utils/middleware";

const app = new Hono<{
	Bindings: CloudflareBindings;
	Variables: {
		user: Session["user"] | null;
		session: Session["session"] | null;
	};
}>();

app.use("*", dbMiddleware);

app.use("*", async (c, next) => {
	const db = getDb(c);
	const auth = createAuth(db, c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		c.set("user", null);
		c.set("session", null);
		await next();
		return;
	}

	c.set("user", session.user);
	c.set("session", session.session);
	await next();
});

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

app.get("/protected", requireAuth, async (c) => {
	const user = c.get("user");
	return c.json({ message: "Protected data", user });
});

export default app;
