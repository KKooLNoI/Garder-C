import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  JUDGE0_URL: z.string().url("JUDGE0_URL must be a valid URL").optional().or(z.literal("")),
  JUDGE0_AUTH_TOKEN: z.string().optional(),
  JUDGE0_C_LANGUAGE_ID: z.coerce.number().int().positive().default(50),
});

export interface EnvReport {
  errors: string[];
  warnings: string[];
}

/** Pure so it can be unit tested. Errors should stop the server; warnings are logged. */
export function checkEnv(env: Record<string, string | undefined>, production: boolean): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = schema.safeParse(env);
  if (!parsed.success) errors.push(...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  else {
    const e = parsed.data;
    if (e.JUDGE0_URL && !e.JUDGE0_AUTH_TOKEN) warnings.push("JUDGE0_URL is set without JUDGE0_AUTH_TOKEN: the judge API would be unauthenticated.");
    if (production && !e.JUDGE0_URL) warnings.push("JUDGE0_URL is not set: Run and Submit are disabled.");
    if (production && /(postgres:postgres@|:change-me@|:password@)/.test(e.DATABASE_URL)) {
      errors.push("DATABASE_URL uses a default/weak password; set a strong one for production.");
    }
  }
  return { errors, warnings };
}
