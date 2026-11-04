// Usage: tsx --env-file=.env scripts/create-user.ts <username> <email> <password> [ADMIN|STUDENT]
import { PrismaClient, type Role } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const [username, email, password, role = "STUDENT"] = process.argv.slice(2);
if (!username || !email || !password || password.length < 10) {
  console.error("usage: create-user <username> <email> <password (>=10 chars)> [ADMIN|STUDENT]");
  process.exit(1);
}
const prisma = new PrismaClient();
async function main() {
  const passwordHash = await hash(password, { algorithm: 2 });
  const u = await prisma.user.create({ data: { username, email: email.toLowerCase(), passwordHash, role: role as Role } });
  console.log(`created ${u.role} ${u.username}`);
}
main().finally(() => prisma.$disconnect());
