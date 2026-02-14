import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db";

const authCache = new Map<string, ReturnType<typeof betterAuth>>();

export const createAuth = (db: Database, env: CloudflareBindings) => {
	const cacheKey = `${env.BETTER_AUTH_URL}_${env.BETTER_AUTH_SECRET}`;

	if (authCache.has(cacheKey)) {
		return authCache.get(cacheKey) || null;
	}

	const socialProviders: Record<
		string,
		{ clientId: string; clientSecret: string }
	> = {};

	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
		socialProviders.google = {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		};
	}

	if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
		socialProviders.github = {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
		};
	}

	const auth = betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		socialProviders:
			Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
	});

	// Cache the instance
	authCache.set(cacheKey, auth);

	return auth;
};

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
