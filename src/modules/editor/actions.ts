"use server";

import { requireUser } from "@/modules/auth/session";
import { Judge0Client } from "@/modules/judge/judge0";
import * as service from "./service";

// Every export here is a public endpoint: authenticate first, then delegate.
const judge = new Judge0Client();

export async function runCodeAction(input: { slug: string; sourceCode: string; stdin: string }) {
  const user = await requireUser();
  return service.runCode(user.id, judge, input);
}

export async function runSamplesAction(input: { slug: string; sourceCode: string }) {
  const user = await requireUser();
  return service.runSamples(user.id, judge, input);
}

export async function saveDraftAction(input: { slug: string; code: string }) {
  const user = await requireUser();
  return service.saveDraft(user.id, input);
}

export async function deleteDraftAction(input: { slug: string }) {
  const user = await requireUser();
  return service.deleteDraft(user.id, input);
}
