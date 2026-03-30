import type { RailFailure } from "./types.js";

export class SchemarailError extends Error {
  readonly issues: RailFailure["issues"];
  readonly meta: RailFailure["meta"];

  constructor(message: string, failure: RailFailure) {
    super(message);
    this.name = "SchemarailError";
    this.issues = failure.issues;
    this.meta = failure.meta;
  }
}
