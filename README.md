# Deterministic structured outputs for LLM apps

`schemarail` is a schema-first guardrail layer that turns messy model responses into validated TypeScript-safe objects.

It is designed for the practical path most teams need:

- keep your existing schema (Zod/Valibot-like `safeParse` or `parse`)
- recover JSON from noisy model output
- optionally run a single repair pass
- ship typed objects into production code with clear failure modes

## Why this exists

LLMs are great at content, but not always at output discipline.

In real apps, response shapes drift. You get wrappers, markdown fences, comments, trailing commas, or partial JSON. `schemarail` gives you a deterministic layer between model text and app logic.

## Install

```bash
pnpm add @jamiojala/schemarail
```

## Fast start

```ts
import { z } from "zod";
import { createRail } from "@jamiojala/schemarail";

const SummarySchema = z.object({
  title: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  confidence: z.number().min(0).max(1)
});

const rail = createRail({ schema: SummarySchema });

const output = await rail.safeParse(`
Here is your result:

\`\`\`json
{
  "title": "Quarterly revenue update",
  "sentiment": "positive",
  "confidence": 0.92
}
\`\`\`
`);

if (!output.ok) {
  console.error(output.issues);
  return;
}

// output.data is strongly typed
console.log(output.data.confidence);
```

## Built-in repair behavior

For string inputs, `schemarail` tries deterministic candidates in this order:

1. direct JSON parse
2. fenced JSON block extraction
3. balanced object/array extraction from surrounding text
4. sanitized pass (BOM, comments, smart quotes, trailing commas)

Then each candidate is validated by your schema.

## Optional custom repair hook

When built-in extraction still fails, attach a repair handler.

```ts
import { z } from "zod";
import { buildRepairPrompt, createRail } from "@jamiojala/schemarail";

const EventSchema = z.object({
  type: z.string(),
  timestamp: z.string()
});

const rail = createRail({
  schema: EventSchema,
  repair: async ({ current, issues }) => {
    const raw = typeof current === "string" ? current : JSON.stringify(current);

    const prompt = buildRepairPrompt({
      raw,
      issues,
      schemaHint: '{ type: string; timestamp: string }'
    });

    // call your model and return raw JSON string or object
    return callRepairModel(prompt);
  }
});
```

## API at a glance

- `createRail({ schema, repair?, maxRepairAttempts? })`
- `rail.safeParse(input, options?)`
- `rail.parse(input, options?)`
- `buildRepairPrompt(...)`
- `formatIssuesForPrompt(...)`

## Project goals

- tiny public API
- deterministic defaults
- strong TypeScript inference
- clean drop-in adoption path
- production-minded docs and tests

## Development

```bash
pnpm install
pnpm check
```

## Docs

- [`docs/quickstart.md`](./docs/quickstart.md)
- [`docs/api.md`](./docs/api.md)

## License

MIT
