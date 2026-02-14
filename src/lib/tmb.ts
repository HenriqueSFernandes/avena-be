type Gender = "male" | "female" | "other";
type ActivityLevel =
	| "sedentary"
	| "lightly active"
	| "moderately active"
	| "very active"
	| "extra active";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
	sedentary: 1.2,
	"lightly active": 1.375,
	"moderately active": 1.55,
	"very active": 1.725,
	"extra active": 1.9,
};

export function calculateTMB(
	gender: Gender,
	age: number,
	weight: number,
	height: number,
	activityLevel?: ActivityLevel,
): number {
	// Mifflin-St Jeor Equation
	// Men: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
	// Women: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161

	let bmr: number;

	if (gender === "male") {
		bmr = 10 * weight + 6.25 * height - 5 * age + 5;
	} else if (gender === "female") {
		bmr = 10 * weight + 6.25 * height - 5 * age - 161;
	} else {
		// For "other", use average of male and female formulas
		const maleBmr = 10 * weight + 6.25 * height - 5 * age + 5;
		const femaleBmr = 10 * weight + 6.25 * height - 5 * age - 161;
		bmr = (maleBmr + femaleBmr) / 2;
	}

	// If activity level is provided, calculate TDEE
	if (activityLevel) {
		return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
	}

	return bmr;
}
