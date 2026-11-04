"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
});

export interface LoginState {
  error?: string;
}

// Verified against when the user is unknown so response time does not reveal
// whether an account exists.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: form.get("identifier"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Enter your username/email and password." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const { identifier, password } = parsed.data;
  if (!rateLimit(`login:${ip}`, 20, 60_000) || !rateLimit(`login:${identifier.toLowerCase()}`, 8, 60_000)) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] },
  });
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !ok || !user.isActive) return { error: "Invalid credentials." };

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
