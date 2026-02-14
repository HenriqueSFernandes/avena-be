import { createMiddleware } from "hono/factory";
import type { Auth, Session } from "./auth";

export const requireAuth = createMiddleware<{
	Variables: {
		user: Session["user"] | null;
		session: Session["session"] | null;
		auth: Auth;
	};
}>(async (c, next) => {
	let user = c.get("user");

	if (user === undefined) {
		const auth = c.get("auth");

		if (auth === null) {
			c.set("user", null);
			c.set("session", null);
			return c.json({ error: "Unauthorized" }, 401);
		}

		const session = await auth.api.getSession({ headers: c.req.raw.headers });

		if (!session) {
			c.set("user", null);
			c.set("session", null);
			return c.json({ error: "Unauthorized" }, 401);
		}

		c.set("user", session.user);
		c.set("session", session.session);
		user = session.user;
	}

	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	await next();
});
