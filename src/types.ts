export type PathSegment = string | number;

export interface ValidationIssue {
  path: PathSegment[];
  pathString: string;
  message: string;
  code?: string;
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error?: unknown;
      issues?: Array<{ path?: unknown; message?: unknown; code?: unknown }>;
    };

export interface SafeParseSchema<T> {
  safeParse(input: unknown): SafeParseResult<T>;
}

export interface ParseSchema<T> {
  parse(input: unknown): T;
}

export type SchemaLike<T> = SafeParseSchema<T> | ParseSchema<T>;

export type InferSchemaOutput<TSchema> =
  TSchema extends SafeParseSchema<infer T>
    ? T
    : TSchema extends ParseSchema<infer T>
      ? T
      : never;

export type CandidateSource =
  | "direct"
  | "json-string"
  | "json-fence"
  | "json-slice"
  | "sanitized-json"
  | "custom-repair";

export interface RailMeta {
  attempts: number;
  candidatesTried: number;
  sourcesTried: CandidateSource[];
  rawInputType: string;
}

export interface RailSuccess<T> {
  ok: true;
  data: T;
  issues: [];
  meta: RailMeta;
}

export interface RailFailure {
  ok: false;
  issues: ValidationIssue[];
  meta: RailMeta;
}

export type RailResult<T> = RailSuccess<T> | RailFailure;

export interface RepairContext<T> {
  input: unknown;
  current: unknown;
  attempt: number;
  issues: ValidationIssue[];
  meta: RailMeta;
  schema: SchemaLike<T>;
}

export type RepairHandler<T> =
  | ((context: RepairContext<T>) => unknown | Promise<unknown>)
  | undefined;

export interface ParseOptions<T> {
  repair?: RepairHandler<T>;
  maxRepairAttempts?: number;
}

export interface CreateRailOptions<TSchema extends SchemaLike<any>> {
  schema: TSchema;
  repair?: RepairHandler<InferSchemaOutput<TSchema>>;
  maxRepairAttempts?: number;
}

export interface Rail<T> {
  safeParse(input: unknown, options?: ParseOptions<T>): Promise<RailResult<T>>;
  parse(input: unknown, options?: ParseOptions<T>): Promise<T>;
}
