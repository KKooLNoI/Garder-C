import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { chapters, problems } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  const lessonIds: string[] = [];
  for (const [i, c] of chapters.entries()) {
    const lesson = await prisma.lesson.upsert({
      where: { slug: c.slug },
      update: { title: c.title, description: c.description, orderIndex: i + 1 },
      create: { slug: c.slug, title: c.title, description: c.description, orderIndex: i + 1, isPublished: true },
    });
    lessonIds.push(lesson.id);
  }

  for (const p of problems) {
    const data = {
      lessonId: lessonIds[p.chapter],
      title: p.title,
      statement: p.statement,
      inputFormat: p.inputFormat,
      outputFormat: p.outputFormat,
      constraints: p.constraints,
      difficulty: p.difficulty,
      score: p.score,
      starterCode: p.starterCode,
      explanation: p.explanation,
      hints: p.hints,
      floatTolerance: p.floatTolerance ?? null,
      isPublished: true,
    };
    const problem = await prisma.problem.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, ...data },
    });
    // Test cases are regenerated only when the problem has no submissions yet,
    // so historical submissions keep referencing the tests they ran against.
    const subs = await prisma.submission.count({ where: { problemId: problem.id } });
    if (subs === 0) {
      await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
      await prisma.testCase.createMany({
        data: p.inputs.map((input, idx) => ({
          problemId: problem.id,
          inputData: input,
          expectedOutput: p.solve(input),
          isSample: idx < p.samples,
          points: 1,
          orderIndex: idx,
        })),
      });
    }
    await prisma.problemVersion.upsert({
      where: { problemId_version: { problemId: problem.id, version: problem.version } },
      update: {},
      create: { problemId: problem.id, version: problem.version, snapshot: { ...data, inputs: p.inputs } },
    });
  }

  const password = process.env.SEED_ADMIN_PASSWORD;
  if (password && password.length >= 10) {
    const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
        passwordHash: await hash(password, { algorithm: 2 }),
        role: "ADMIN",
      },
    });
    console.log(`admin user ready: ${username}`);
  } else {
    console.log("SEED_ADMIN_PASSWORD not set (min 10 chars): skipped admin creation");
  }
  console.log(`seeded ${chapters.length} lessons, ${problems.length} problems`);
}

main().finally(() => prisma.$disconnect());
