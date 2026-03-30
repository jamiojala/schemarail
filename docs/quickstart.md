# Quickstart

## Install

```bash
pnpm add @jamiojala/schemarail
```

## First success in under 1 minute

```ts
import { z } from "zod";
import { createRail } from "@jamiojala/schemarail";

const UserSchema = z.object({
  id: z.string(),
  role: z.enum(["admin", "member"])
});

const rail = createRail({ schema: UserSchema });

const result = await rail.safeParse(`\`\`\`json
{"id":"u_1","role":"member"}
\`\`\``);

if (!result.ok) {
  console.error(result.issues);
} else {
  // strongly typed object
  console.log(result.data.role);
}
```

## What happens under the hood

1. Candidate JSON is extracted from text.
2. JSON is parsed and validated against your schema.
3. Optional repair hook is called if needed.
4. You get either typed data or normalized issues.
