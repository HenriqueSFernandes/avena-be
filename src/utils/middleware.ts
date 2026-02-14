import { createMiddleware } from "hono/factory";
import type { Session } from "./auth";

export const requireAuth = createMiddleware<{
	Variables: {
		user: Session["user"] | null;
		session: Session["session"] | null;
	};
}>(async (c, next) => {
	const user = c.get("user");

	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	await next();
});
