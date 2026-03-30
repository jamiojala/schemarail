import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { SchemarailError, createRail } from "../src/index.js";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number().int().nonnegative()
});

describe("createRail", () => {
  it("validates a plain object input", async () => {
    const rail = createRail({ schema: PersonSchema });

    const result = await rail.safeParse({ name: "Ada", age: 36 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "Ada", age: 36 });
      expect(result.meta.candidatesTried).toBe(1);
      expect(result.meta.sourcesTried).toEqual(["direct"]);
    }
  });

  it("extracts and validates JSON from markdown fences", async () => {
    const rail = createRail({ schema: PersonSchema });

    const messy = [
      "Here is the user profile you requested:",
      "",
      "```json",
      '{"name":"Lin","age":29}',
      "```",
      "",
      "Hope that helps."
    ].join("\n");

    const result = await rail.safeParse(messy);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "Lin", age: 29 });
      expect(result.meta.sourcesTried).toContain("json-fence");
    }
  });

  it("sanitizes common JSON noise like comments and trailing commas", async () => {
    const rail = createRail({ schema: PersonSchema });

    const messy = [
      "Some context before JSON",
      "{",
      "  // generated profile",
      '  "name": "Rina",',
      '  "age": 41,',
      "}",
      "Extra text after JSON"
    ].join("\n");

    const result = await rail.safeParse(messy);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "Rina", age: 41 });
      expect(result.meta.sourcesTried).toContain("sanitized-json");
    }
  });

  it("returns normalized issues when validation fails", async () => {
    const rail = createRail({ schema: PersonSchema });

    const result = await rail.safeParse('{"name": 123}');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]?.pathString).toMatch(/^\$/);
    }
  });

  it("calls custom repair and succeeds", async () => {
    const repair = vi.fn(async () => '{"name":"Uma","age":25}');
    const rail = createRail({ schema: PersonSchema, repair });

    const result = await rail.safeParse("no json here");

    expect(repair).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "Uma", age: 25 });
      expect(result.meta.attempts).toBe(1);
      expect(result.meta.sourcesTried).toContain("custom-repair");
    }
  });

  it("respects maxRepairAttempts", async () => {
    const repair = vi.fn(async () => '{"name":"Nova","age":31}');
    const rail = createRail({
      schema: PersonSchema,
      repair,
      maxRepairAttempts: 0
    });

    const result = await rail.safeParse("still no json");

    expect(result.ok).toBe(false);
    expect(repair).not.toHaveBeenCalled();
  });

  it("parse throws SchemarailError on failure", async () => {
    const rail = createRail({ schema: PersonSchema, maxRepairAttempts: 0 });

    await expect(rail.parse("not valid json")).rejects.toBeInstanceOf(SchemarailError);
  });
});
