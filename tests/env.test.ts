import { describe, expect, it } from "vitest";
import { checkEnv } from "../src/lib/env";

const good = { DATABASE_URL: "postgresql://app:Xk29sLqPz@db:5432/cpractice", JUDGE0_URL: "http://judge0:2358", JUDGE0_AUTH_TOKEN: "t" };

describe("checkEnv", () => {
  it("accepts a sound production config without warnings", () => {
    expect(checkEnv(good, true)).toEqual({ errors: [], warnings: [] });
  });
  it("requires DATABASE_URL", () => {
    expect(checkEnv({}, false).errors.join()).toContain("DATABASE_URL");
  });
  it("rejects an invalid JUDGE0_URL and out-of-range session TTL", () => {
    expect(checkEnv({ ...good, JUDGE0_URL: "not a url" }, true).errors.join()).toContain("JUDGE0_URL");
    expect(checkEnv({ ...good, SESSION_TTL_DAYS: "9999" }, true).errors.join()).toContain("SESSION_TTL_DAYS");
  });
  it("rejects default database passwords in production only", () => {
    const weak = { ...good, DATABASE_URL: "postgresql://postgres:postgres@db:5432/x" };
    expect(checkEnv(weak, true).errors.join()).toContain("weak");
    expect(checkEnv(weak, false).errors).toEqual([]);
  });
  it("warns about an unauthenticated judge and a missing judge", () => {
    expect(checkEnv({ ...good, JUDGE0_AUTH_TOKEN: undefined }, true).warnings.join()).toContain("unauthenticated");
    expect(checkEnv({ DATABASE_URL: good.DATABASE_URL }, true).warnings.join()).toContain("not set");
  });
});
