import type { CandidateSource } from "./types.js";

export interface ParsedCandidate {
  value: unknown;
  source: CandidateSource;
}

export interface CandidateBuildResult {
  candidates: ParsedCandidate[];
  parseErrors: string[];
}

interface StringCandidateSeed {
  source: Extract<CandidateSource, "json-string" | "json-fence" | "json-slice">;
  text: string;
}

function tryParseJson(text: string):
  | { ok: true; value: unknown }
  | { ok: false; message: string } {
  try {
    return {
      ok: true,
      value: JSON.parse(text)
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown JSON parse error"
    };
  }
}

function toComparableKey(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value !== "object") {
    return `${typeof value}:${String(value)}`;
  }

  try {
    return `json:${JSON.stringify(value)}`;
  } catch {
    return `object:${Object.prototype.toString.call(value)}`;
  }
}

function extractCodeFences(text: string): string[] {
  const matches: string[] = [];
  const regex = /```(?:json)?\s*([\s\S]*?)```/gi;

  let match = regex.exec(text);
  while (match) {
    const block = match[1]?.trim();
    if (block) {
      matches.push(block);
    }
    match = regex.exec(text);
  }

  return matches;
}

function extractBalancedJsonSlices(text: string): string[] {
  const slices: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (quote === char) {
        inString = false;
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (start === -1) {
      if (char === "{" || char === "[") {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;

      if (depth === 0) {
        slices.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return slices;
}

function removeTrailingCommas(value: string): string {
  let output = value;
  let previous: string;

  do {
    previous = output;
    output = output.replace(/,\s*([}\]])/g, "$1");
  } while (output !== previous);

  return output;
}

function sanitizeJsonLike(input: string): string {
  return removeTrailingCommas(
    input
      .replace(/^\uFEFF/, "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim()
  );
}

export function buildJsonCandidates(input: unknown): CandidateBuildResult {
  if (typeof input !== "string") {
    return {
      candidates: [
        {
          value: input,
          source: "direct"
        }
      ],
      parseErrors: []
    };
  }

  const text = input.trim();

  if (text.length === 0) {
    return {
      candidates: [],
      parseErrors: ["Input string is empty."]
    };
  }

  const seeds: StringCandidateSeed[] = [
    {
      source: "json-string",
      text
    }
  ];

  for (const fenced of extractCodeFences(text)) {
    seeds.push({
      source: "json-fence",
      text: fenced
    });
  }

  for (const slice of extractBalancedJsonSlices(text)) {
    seeds.push({
      source: "json-slice",
      text: slice
    });
  }

  const parseErrors: string[] = [];
  const candidates: ParsedCandidate[] = [];
  const seen = new Set<string>();

  const addParsedCandidate = (candidateText: string, source: CandidateSource): void => {
    const parsed = tryParseJson(candidateText);

    if (!parsed.ok) {
      if (parseErrors.length < 4) {
        parseErrors.push(`${source}: ${parsed.message}`);
      }
      return;
    }

    const key = toComparableKey(parsed.value);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push({
      value: parsed.value,
      source
    });
  };

  for (const seed of seeds) {
    addParsedCandidate(seed.text, seed.source);

    const sanitized = sanitizeJsonLike(seed.text);
    if (sanitized !== seed.text) {
      addParsedCandidate(sanitized, "sanitized-json");
    }
  }

  if (candidates.length === 0 && parseErrors.length === 0) {
    parseErrors.push("No parseable JSON candidate was found in the input.");
  }

  return {
    candidates,
    parseErrors
  };
}
