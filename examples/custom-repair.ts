import { z } from "zod";

import { buildRepairPrompt, createRail } from "@jamiojala/schemarail";

const ActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().min(3)
});

async function callModel(prompt: string): Promise<string> {
  // Replace with your LLM call. This is intentionally stubbed for copy-paste use.
  console.log("Repair prompt:\n", prompt);
  return '{"action":"approve","reason":"Looks good."}';
}

const rail = createRail({
  schema: ActionSchema,
  maxRepairAttempts: 1,
  repair: async ({ current, issues }) => {
    const raw = typeof current === "string" ? current : JSON.stringify(current);

    const prompt = buildRepairPrompt({
      raw,
      issues,
      schemaHint: `{
  action: "approve" | "reject";
  reason: string;
}`
    });

    return callModel(prompt);
  }
});

const result = await rail.safeParse("Action=approve, reason=ok");

if (!result.ok) {
  console.error(result.issues);
  process.exit(1);
}

console.log(result.data);
