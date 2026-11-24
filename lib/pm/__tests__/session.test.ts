import { describe, expect, it } from "vitest";
import { slugify } from "../projects";
import { SESSION_DAYS, createSessionToken, passwordMatches, verifySessionToken } from "../session";

const NOW = Date.UTC(2026, 10, 24);
const DAY = 86_400_000;

describe("session tokens", () => {
  it("accepts a token it issued, for the same password", () => {
    const token = createSessionToken("correct horse", NOW);
    expect(verifySessionToken(token, "correct horse", NOW)).toBe(true);
    expect(verifySessionToken(token, "correct horse", NOW + (SESSION_DAYS - 1) * DAY)).toBe(true);
  });

  it("expires after the session length", () => {
    const token = createSessionToken("pw", NOW);
    expect(verifySessionToken(token, "pw", NOW + SESSION_DAYS * DAY)).toBe(false);
    expect(verifySessionToken(token, "pw", NOW + (SESSION_DAYS + 1) * DAY)).toBe(false);
  });

  it("is invalidated by changing the password", () => {
    expect(verifySessionToken(createSessionToken("old", NOW), "new", NOW)).toBe(false);
  });

  it("rejects a token whose expiry was extended", () => {
    const [expires, signature] = createSessionToken("pw", NOW).split(".");
    expect(verifySessionToken(`${Number(expires) + 365 * DAY}.${signature}`, "pw", NOW)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    const good = createSessionToken("pw", NOW);
    for (const bad of ["", "abc", ".", "123.", `.${good.split(".")[1]}`, `${good}.extra`, `x${good}`, `${good.split(".")[0]}.deadbeef`, "9999999999999.00"]) {
      expect(verifySessionToken(bad, "pw", NOW)).toBe(false);
    }
  });
});

describe("passwordMatches", () => {
  it("matches only the exact password", () => {
    expect(passwordMatches("s3cret!", "s3cret!")).toBe(true);
    for (const wrong of ["", "s3cret", "s3cret! ", "S3cret!", "a much longer string than the password"]) {
      expect(passwordMatches(wrong, "s3cret!")).toBe(false);
    }
  });
});

describe("reserved project slugs", () => {
  it("never produces a slug that collides with a real /pm route", () => {
    expect(slugify("API")).toBe("api-project");
    expect(slugify("Login")).toBe("login-project");
    expect(slugify("Login flow")).toBe("login-flow");
  });
});
