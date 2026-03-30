# API

## `createRail(options)`

Creates a schema-bound parser with deterministic extraction and validation.

### Options

- `schema`: object with `safeParse` or `parse`
- `repair?`: optional async/sync function for custom retries
- `maxRepairAttempts?`: number of repair retries (default: `1`)

### Returned methods

- `safeParse(input, options?) => Promise<RailResult<T>>`
- `parse(input, options?) => Promise<T>` (throws `SchemarailError` on failure)

## `buildRepairPrompt({ raw, issues, schemaHint? })`

Creates a strict prompt for a repair model call.

## `formatIssuesForPrompt(issues)`

Converts normalized issues into a concise bullet list.

## Result shape

```ts
type RailSuccess<T> = {
  ok: true;
  data: T;
  issues: [];
  meta: {
    attempts: number;
    candidatesTried: number;
    sourcesTried: CandidateSource[];
    rawInputType: string;
  };
};

type RailFailure = {
  ok: false;
  issues: Array<{
    path: Array<string | number>;
    pathString: string;
    message: string;
    code?: string;
  }>;
  meta: {
    attempts: number;
    candidatesTried: number;
    sourcesTried: CandidateSource[];
    rawInputType: string;
  };
};
```
