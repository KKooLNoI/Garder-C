export interface CompareOptions {
  /** Ignore trailing spaces on each line and trailing blank lines. Off = byte-exact. */
  normalizeWhitespace: boolean;
  /** When set, tokens that parse as numbers are compared within this absolute/relative tolerance. */
  floatTolerance?: number | null;
}

const normalize = (s: string) =>
  s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");

const isNumber = (t: string) => /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t);

function withinTolerance(a: string, b: string, tol: number): boolean {
  const x = Number(a);
  const y = Number(b);
  return Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));
}

export function outputsMatch(actual: string, expected: string, opts: CompareOptions): boolean {
  if (opts.floatTolerance != null) {
    const a = normalize(actual).split(/\s+/).filter(Boolean);
    const e = normalize(expected).split(/\s+/).filter(Boolean);
    if (a.length !== e.length) return false;
    return a.every((tok, i) =>
      isNumber(tok) && isNumber(e[i]) ? withinTolerance(tok, e[i], opts.floatTolerance as number) : tok === e[i],
    );
  }
  return opts.normalizeWhitespace ? normalize(actual) === normalize(expected) : actual === expected;
}
