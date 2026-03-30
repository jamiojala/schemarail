import type { ValidationIssue } from "./types.js";

export function formatIssuesForPrompt(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return "- None";
  }

  return issues
    .map((issue) => `- ${issue.pathString}: ${issue.message}`)
    .join("\n");
}

export function buildRepairPrompt(params: {
  raw: string;
  issues: ValidationIssue[];
  schemaHint?: string;
}): string {
  const schemaHint = params.schemaHint ? `Schema hint:\n${params.schemaHint}\n\n` : "";

  return [
    "You are fixing malformed JSON from another model.",
    "Return only valid JSON and no extra text.",
    "",
    schemaHint,
    "Validation issues:",
    formatIssuesForPrompt(params.issues),
    "",
    "Raw model output:",
    params.raw
  ]
    .filter(Boolean)
    .join("\n");
}
