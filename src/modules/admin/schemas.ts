import { z } from "zod";

const text = (max: number) => z.string().max(max);
const required = (max: number, label: string) => z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);
const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug may contain lowercase letters, digits and single hyphens.")
  .max(80);

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const lessonSchema = z.object({
  title: required(120, "Title"),
  slug: slugField.or(z.literal("")).optional(),
  description: required(500, "Description"),
  content: text(50_000).default(""),
  orderIndex: z.coerce.number().int().min(0).max(10_000),
});

export const problemSchema = z.object({
  lessonId: z.string().uuid("Choose a lesson."),
  title: required(150, "Title"),
  slug: slugField.or(z.literal("")).optional(),
  statement: required(20_000, "Statement"),
  inputFormat: required(5_000, "Input format"),
  outputFormat: required(5_000, "Output format"),
  constraints: required(5_000, "Constraints"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  score: z.coerce.number().int().min(1).max(1000),
  timeLimitMs: z.coerce.number().int().min(100).max(10_000),
  memoryLimitMb: z.coerce.number().int().min(16).max(512),
  starterCode: text(20_000).default(""),
  explanation: text(20_000).default(""),
  hints: text(5_000).default(""),
  normalizeWhitespace: z.boolean(),
  floatTolerance: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(1).nullable()),
});

export const testCaseSchema = z.object({
  inputData: text(16 * 1024),
  expectedOutput: text(16 * 1024),
  isSample: z.boolean(),
  points: z.coerce.number().int().min(1).max(100),
  orderIndex: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(10_000).nullable()),
});

export const userCreateSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,32}$/, "Username: 3-32 letters, digits, . _ -"),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(254),
  password: z.string().min(10, "Password must be at least 10 characters.").max(128),
  role: z.enum(["STUDENT", "ADMIN"]),
});

export const passwordSchema = z.string().min(10, "Password must be at least 10 characters.").max(128);

export type LessonInput = z.infer<typeof lessonSchema>;
export type ProblemInput = z.infer<typeof problemSchema>;
export type TestCaseInput = z.infer<typeof testCaseSchema>;
