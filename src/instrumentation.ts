// Runs once when the Next.js server boots. Refuses to start production with a broken configuration.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv } = await import("./lib/env");
  const production = process.env.NODE_ENV === "production";
  const { errors, warnings } = checkEnv(process.env, production);
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[config] ${e}`);
    if (production && process.env.ALLOW_WEAK_CONFIG !== "true") {
      console.error("[config] refusing to start. Fix the errors above (ALLOW_WEAK_CONFIG=true overrides, for local testing only).");
      process.exit(1);
    }
  }
}
