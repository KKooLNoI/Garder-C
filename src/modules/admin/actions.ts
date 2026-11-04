"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/modules/auth/session";
import * as service from "./service";

export interface FormState {
  error?: string;
  ok?: string;
}

const uuid = z.string().uuid();
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const flag = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const idOf = (fd: FormData, k = "id") => uuid.safeParse(str(fd, k));

function finish(r: { ok: true } | { ok: false; error: string }, message: string): FormState {
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin", "layout");
  return { ok: message };
}

const BAD_ID: FormState = { error: "Invalid record." };

// Every export below is a public endpoint: requireAdmin() runs first, independent of the UI.

// ---- lessons
export async function createLessonAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const r = await service.createLesson(admin.id, Object.fromEntries(fd));
  return finish(r, "Lesson created (unpublished).");
}
export async function updateLessonAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  return finish(await service.updateLesson(admin.id, id.data, Object.fromEntries(fd)), "Saved.");
}
export async function lessonPublishAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  const publish = flag(fd, "publish");
  return finish(await service.setLessonPublished(admin.id, id.data, publish), publish ? "Published." : "Archived.");
}
export async function deleteLessonAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  return finish(await service.deleteLesson(admin.id, id.data), "Deleted.");
}

// ---- problems
function problemInput(fd: FormData) {
  return { ...Object.fromEntries(fd), normalizeWhitespace: flag(fd, "normalizeWhitespace") };
}
export async function createProblemAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const r = await service.createProblem(admin.id, problemInput(fd));
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin", "layout");
  redirect(`/admin/problems/${r.id}`);
}
export async function updateProblemAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  return finish(await service.updateProblem(admin.id, id.data, problemInput(fd)), "Saved.");
}
export async function problemPublishAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  const publish = flag(fd, "publish");
  return finish(await service.setProblemPublished(admin.id, id.data, publish), publish ? "Published." : "Unpublished.");
}

// ---- test cases
function testInput(fd: FormData) {
  return { ...Object.fromEntries(fd), isSample: flag(fd, "isSample") };
}
export async function createTestCaseAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const pid = idOf(fd, "problemId");
  if (!pid.success) return BAD_ID;
  return finish(await service.createTestCase(admin.id, pid.data, testInput(fd)), "Test case added.");
}
export async function updateTestCaseAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  return finish(await service.updateTestCase(admin.id, id.data, testInput(fd)), "Saved.");
}
export async function deleteTestCaseAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  return finish(await service.deleteTestCase(admin.id, id.data), "Deleted.");
}

// ---- users
export async function createUserAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return finish(await service.createUser(admin.id, Object.fromEntries(fd)), "User created.");
}
export async function userActiveAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  const active = flag(fd, "active");
  return finish(await service.setUserActive(admin.id, id.data, active), active ? "Activated." : "Deactivated.");
}
export async function userRoleAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  const role = z.enum(["STUDENT", "ADMIN"]).safeParse(str(fd, "role"));
  if (!id.success || !role.success) return BAD_ID;
  return finish(await service.setUserRole(admin.id, id.data, role.data), "Role updated.");
}
export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idOf(fd);
  if (!id.success) return BAD_ID;
  return finish(await service.resetUserPassword(admin.id, id.data, str(fd, "password")), "Password reset; user signed out.");
}
