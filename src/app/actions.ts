"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActorName, getRole } from "@/lib/role";
import { createSubmission } from "@/lib/data/submissions";
import { createVersion, updatePreCheckStatus } from "@/lib/data/versions";
import { createFlags, updateFlagState } from "@/lib/data/flags";
import { createReview } from "@/lib/data/reviews";
import { runRuleChecks } from "@/lib/rules";
import { runLlmPreCheck } from "@/lib/llm/pre-check";

export async function switchRole(formData: FormData) {
  const role = formData.get("role") as string;
  const name = formData.get("name") as string;
  const cookieStore = await cookies();
  cookieStore.set("clearpath-role", role === "submitter" ? "submitter" : "reviewer", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  if (name) {
    cookieStore.set("clearpath-name", name, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  revalidatePath("/");
}

export async function submitAd(formData: FormData) {
  const actor = await getActorName();
  const title = formData.get("title") as string;
  const channel = formData.get("channel") as string;
  const product = formData.get("product") as string;
  const content = formData.get("content") as string;

  const { submission, version } = await createSubmission(actor, {
    title,
    channel,
    product,
    content,
  });

  // Run rule checks and LLM pre-check in parallel
  const [ruleFlags, llmResult] = await Promise.all([
    Promise.resolve(runRuleChecks(content, product)),
    runLlmPreCheck(content, product, channel),
  ]);

  // Insert flags
  if (ruleFlags.length > 0) {
    await createFlags(actor, submission.id, version.id, ruleFlags);
  }
  if (llmResult.flags.length > 0) {
    await createFlags(actor, submission.id, version.id, llmResult.flags);
  }

  // Update pre-check status
  await updatePreCheckStatus(version.id, llmResult.status);

  redirect(`/submissions/${submission.id}`);
}

export async function reviseSubmission(submissionId: string, formData: FormData) {
  const actor = await getActorName();
  const content = formData.get("content") as string;

  const version = await createVersion(actor, submissionId, content);

  // Re-run checks on new version
  // We need the product for rule checks — read from submission
  const { query } = await import("@/lib/db");
  const subResult = await query("SELECT product, channel FROM submissions WHERE id = $1", [submissionId]);
  const { product, channel } = subResult.rows[0];

  const [ruleFlags, llmResult] = await Promise.all([
    Promise.resolve(runRuleChecks(content, product)),
    runLlmPreCheck(content, product, channel),
  ]);

  if (ruleFlags.length > 0) {
    await createFlags(actor, submissionId, version.id, ruleFlags);
  }
  if (llmResult.flags.length > 0) {
    await createFlags(actor, submissionId, version.id, llmResult.flags);
  }

  await updatePreCheckStatus(version.id, llmResult.status);

  revalidatePath(`/submissions/${submissionId}`);
  redirect(`/submissions/${submissionId}`);
}

function requireRole(actual: string, expected: string, submissionId: string): void {
  if (actual !== expected) {
    throw redirect(`/submissions/${submissionId}?error=${encodeURIComponent(`This action requires the ${expected} role.`)}`);
  }
}

export async function acceptFlag(flagId: string, submissionId: string) {
  const role = await getRole();
  requireRole(role, "reviewer", submissionId);
  const actor = await getActorName();
  await updateFlagState(actor, flagId, "accepted");
  revalidatePath(`/submissions/${submissionId}`);
}

export async function dismissFlag(formData: FormData) {
  const flagId = formData.get("flagId") as string;
  const submissionId = formData.get("submissionId") as string;
  const role = await getRole();
  requireRole(role, "reviewer", submissionId);
  const actor = await getActorName();
  const reason = formData.get("reason") as string;
  await updateFlagState(actor, flagId, "dismissed", reason);
  revalidatePath(`/submissions/${submissionId}`);
}

export async function resolveFlag(flagId: string, submissionId: string) {
  const role = await getRole();
  requireRole(role, "submitter", submissionId);
  const actor = await getActorName();
  await updateFlagState(actor, flagId, "resolved");
  revalidatePath(`/submissions/${submissionId}`);
}

export async function submitReview(formData: FormData) {
  const submissionId = formData.get("submissionId") as string;
  const role = await getRole();
  requireRole(role, "reviewer", submissionId);
  const actor = await getActorName();
  const versionId = formData.get("versionId") as string;
  const decision = formData.get("decision") as "approved" | "changes_requested";

  try {
    await createReview(actor, versionId, decision);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review failed";
    if (message.includes("Reviewer cannot be the submitter")) {
      redirect(`/submissions/${submissionId}?error=${encodeURIComponent("You cannot review your own submission.")}`);
    }
    if (message.includes("unresolved flag")) {
      redirect(`/submissions/${submissionId}?error=${encodeURIComponent("All flags must be resolved or dismissed before approving.")}`);
    }
    throw err;
  }
  revalidatePath(`/submissions/${submissionId}`);
  redirect(`/submissions/${submissionId}`);
}
