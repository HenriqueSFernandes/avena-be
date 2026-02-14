import "dotenv/config";
import { auth } from "./lib/auth";

async function seed() {
	console.log("🌱 Seeding test account...");

	const testEmail = "test@example.com";
	const testPassword = "password123";
	const testName = "Test User";

	try {
		const result = await auth.api.signUpEmail({
			body: {
				email: testEmail,
				password: testPassword,
				name: testName,
			},
		});

		if (result) {
			console.log("✅ Test account created successfully!");
			console.log(`   Email: ${testEmail}`);
			console.log(`   Password: ${testPassword}`);
			console.log(`   Name: ${testName}`);
		}
	} catch (error: any) {
		if (
			error?.message?.includes("already exists") ||
			error?.message?.includes("unique")
		) {
			console.log("ℹ️  Test account already exists");
			console.log(`   Email: ${testEmail}`);
			console.log(`   Password: ${testPassword}`);
		} else {
			console.error("❌ Error creating test account:", error);
			process.exit(1);
		}
	}

	process.exit(0);
}

seed();
