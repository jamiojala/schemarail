import type {
  PathSegment,
  SafeParseResult,
  SchemaLike,
  ValidationIssue
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePath(path: unknown): PathSegment[] {
  if (!Array.isArray(path)) {
    return [];
  }

  return path.filter(
    (segment): segment is PathSegment =>
      typeof segment === "string" || typeof segment === "number"
  );
}

export function pathToString(path: PathSegment[]): string {
  if (path.length === 0) {
    return "$";
  }

  let output = "$";

  for (const segment of path) {
    if (typeof segment === "number") {
      output += `[${segment}]`;
      continue;
    }

    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(segment)) {
      output += `.${segment}`;
      continue;
    }

    output += `[${JSON.stringify(segment)}]`;
  }

  return output;
}

function readRawIssues(value: unknown): Array<{
  path?: unknown;
  message?: unknown;
  code?: unknown;
}> {
  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.issues)) {
    return value.issues;
  }

  if (Array.isArray(value.errors)) {
    return value.errors as Array<{ path?: unknown; message?: unknown; code?: unknown }>;
  }

  if (value.error !== undefined) {
    return readRawIssues(value.error);
  }

  return [];
}

export function normalizeIssues(value: unknown): ValidationIssue[] {
  const rawIssues = readRawIssues(value);

  if (rawIssues.length > 0) {
    return rawIssues.map((issue) => {
      const path = normalizePath(issue.path);
      const message =
        typeof issue.message === "string" && issue.message.length > 0
          ? issue.message
          : "Validation failed.";
      const code = typeof issue.code === "string" ? issue.code : undefined;

      return {
        path,
        pathString: pathToString(path),
        message,
        code
      };
    });
  }

  if (value instanceof Error) {
    return [
      {
        path: [],
        pathString: "$",
        message: value.message || "Validation failed."
      }
    ];
  }

  if (isRecord(value) && typeof value.message === "string" && value.message.length > 0) {
    return [
      {
        path: [],
        pathString: "$",
        message: value.message
      }
    ];
  }

  return [
    {
      path: [],
      pathString: "$",
      message: "Validation failed."
    }
  ];
}

export function validateWithSchema<T>(
  schema: SchemaLike<T>,
  input: unknown
): { success: true; data: T } | { success: false; issues: ValidationIssue[] } {
  if ("safeParse" in schema && typeof schema.safeParse === "function") {
    const result = schema.safeParse(input) as SafeParseResult<T>;

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    }

    return {
      success: false,
      issues: normalizeIssues(result)
    };
  }

  if ("parse" in schema && typeof schema.parse === "function") {
    try {
      const data = schema.parse(input);

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        issues: normalizeIssues(error)
      };
    }
  }

  return {
    success: false,
    issues: [
      {
        path: [],
        pathString: "$",
        message: "Invalid schema: expected an object with parse or safeParse.",
        code: "INVALID_SCHEMA"
      }
    ]
  };
}
