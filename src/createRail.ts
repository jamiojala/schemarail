import { SchemarailError } from "./errors.js";
import { buildJsonCandidates } from "./json.js";
import { validateWithSchema } from "./schema.js";
import type {
  CandidateSource,
  CreateRailOptions,
  InferSchemaOutput,
  ParseOptions,
  Rail,
  RailMeta,
  RepairContext,
  SchemaLike,
  ValidationIssue
} from "./types.js";

const DEFAULT_MAX_REPAIR_ATTEMPTS = 1;

interface EvaluationSuccess<T> {
  success: true;
  data: T;
  issues: [];
  candidatesTried: number;
  sourcesTried: CandidateSource[];
}

interface EvaluationFailure {
  success: false;
  issues: ValidationIssue[];
  candidatesTried: number;
  sourcesTried: CandidateSource[];
}

function getInputType(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function normalizeMaxRepairAttempts(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_REPAIR_ATTEMPTS;
  }

  if (!value || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function evaluateInput<T>(
  schema: SchemaLike<T>,
  input: unknown
): EvaluationSuccess<T> | EvaluationFailure {
  const { candidates, parseErrors } = buildJsonCandidates(input);
  const sources = new Set<CandidateSource>();
  let attempted = 0;

  let bestIssues: ValidationIssue[] | undefined;

  for (const candidate of candidates) {
    attempted += 1;
    sources.add(candidate.source);

    const validated = validateWithSchema(schema, candidate.value);
    if (validated.success) {
      return {
        success: true,
        data: validated.data,
        issues: [],
        candidatesTried: attempted,
        sourcesTried: [...sources]
      };
    }

    if (!bestIssues || validated.issues.length < bestIssues.length) {
      bestIssues = validated.issues;
    }
  }

  if (!bestIssues) {
    bestIssues = [
      {
        path: [],
        pathString: "$",
        code: "NO_JSON_CANDIDATE",
        message: parseErrors[0] ?? "No parseable JSON candidate was found in the input."
      }
    ];
  }

  return {
    success: false,
    issues: bestIssues,
    candidatesTried: attempted,
    sourcesTried: [...sources]
  };
}

export function createRail<TSchema extends SchemaLike<any>>(
  options: CreateRailOptions<TSchema>
): Rail<InferSchemaOutput<TSchema>> {
  type Output = InferSchemaOutput<TSchema>;

  const schema = options.schema as SchemaLike<Output>;
  const defaultRepair = options.repair;
  const defaultMaxRepairAttempts = normalizeMaxRepairAttempts(options.maxRepairAttempts);

  const safeParse: Rail<Output>["safeParse"] = async (
    input: unknown,
    parseOptions?: ParseOptions<Output>
  ) => {
    const repair = parseOptions?.repair ?? defaultRepair;
    const maxRepairAttempts =
      parseOptions?.maxRepairAttempts !== undefined
        ? normalizeMaxRepairAttempts(parseOptions.maxRepairAttempts)
        : defaultMaxRepairAttempts;

    const sources = new Set<CandidateSource>();
    const rawInputType = getInputType(input);

    let attempts = 0;
    let currentInput: unknown = input;
    let candidatesTried = 0;
    let issues: ValidationIssue[] = [];

    while (true) {
      const evaluated = evaluateInput(schema, currentInput);
      candidatesTried += evaluated.candidatesTried;
      for (const source of evaluated.sourcesTried) {
        sources.add(source);
      }

      const meta: RailMeta = {
        attempts,
        candidatesTried,
        sourcesTried: [...sources],
        rawInputType
      };

      if (evaluated.success) {
        return {
          ok: true,
          data: evaluated.data,
          issues: [],
          meta
        };
      }

      issues = evaluated.issues;

      if (!repair || attempts >= maxRepairAttempts) {
        return {
          ok: false,
          issues,
          meta
        };
      }

      attempts += 1;
      sources.add("custom-repair");

      const repairContext: RepairContext<Output> = {
        input,
        current: currentInput,
        attempt: attempts,
        issues,
        meta: {
          attempts,
          candidatesTried,
          sourcesTried: [...sources],
          rawInputType
        },
        schema
      };

      try {
        const repaired = await repair(repairContext);

        if (repaired === undefined) {
          return {
            ok: false,
            issues: [
              ...issues,
              {
                path: [],
                pathString: "$",
                code: "REPAIR_RETURNED_UNDEFINED",
                message:
                  "Repair handler returned undefined. Return JSON text or a candidate object."
              }
            ],
            meta: {
              attempts,
              candidatesTried,
              sourcesTried: [...sources],
              rawInputType
            }
          };
        }

        currentInput = repaired;
      } catch (error) {
        return {
          ok: false,
          issues: [
            ...issues,
            {
              path: [],
              pathString: "$",
              code: "REPAIR_FAILED",
              message:
                error instanceof Error
                  ? `Repair handler threw: ${error.message}`
                  : "Repair handler threw an unknown error."
            }
          ],
          meta: {
            attempts,
            candidatesTried,
            sourcesTried: [...sources],
            rawInputType
          }
        };
      }
    }
  };

  const parse: Rail<Output>["parse"] = async (input: unknown, parseOptions?: ParseOptions<Output>) => {
    const result = await safeParse(input, parseOptions);

    if (result.ok) {
      return result.data;
    }

    throw new SchemarailError("Unable to produce a schema-valid object.", result);
  };

  return {
    safeParse,
    parse
  };
}
