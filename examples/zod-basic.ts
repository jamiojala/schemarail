import { z } from "zod";

import { createRail } from "@jamiojala/schemarail";

const TicketSchema = z.object({
  id: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  tags: z.array(z.string())
});

const rail = createRail({ schema: TicketSchema });

const llmResponse = `Great question. Here's your object:

\`\`\`json
{
  "id": "T-1042",
  "priority": "high",
  "tags": ["billing", "urgent"]
}
\`\`\`
`;

const result = await rail.safeParse(llmResponse);

if (!result.ok) {
  console.error("Validation failed", result.issues);
  process.exit(1);
}

console.log("Validated object:", result.data);
