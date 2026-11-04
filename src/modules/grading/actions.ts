"use server";

import { requireUser } from "@/modules/auth/session";
import { judge0ConfigFromEnv } from "@/modules/judge/judge0";
import * as service from "./service";

// Every export here is a public endpoint: authenticate first, then delegate.
export async function submitCodeAction(input: { slug: string; sourceCode: string }) {
  const user = await requireUser();
  return service.createSubmission(user.id, judge0ConfigFromEnv() !== null, input);
}

/** Polled by the client until the submission reaches a final status. */
export async function getSubmissionAction(input: { id: string }) {
  const user = await requireUser();
  const view = await service.getSubmissionView(user.id, user.role, String(input.id));
  if (!view) return { ok: false as const, code: "NOT_FOUND" as const, message: "Submission not found." };
  // The client only needs the verdict, not the source it already has.
  return { ok: true as const, submission: { ...view, sourceCode: undefined } };
}
