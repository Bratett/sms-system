import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  levenshtein,
  nameKey,
  findPotentialDuplicates,
} from "@/lib/guardian-matching";

describe("normalizePhone", () => {
  it("strips spaces, dashes, plus signs", () => {
    expect(normalizePhone("+233 24 123 4567")).toBe("241234567");
    expect(normalizePhone("0241234567")).toBe("241234567");
    expect(normalizePhone("024-123-4567")).toBe("241234567");
  });

  it("returns null when fewer than 9 digits after stripping", () => {
    expect(normalizePhone("1234")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("asante", "asante")).toBe(0);
  });

  it("returns 1 for a single character edit", () => {
    expect(levenshtein("asante", "asantf")).toBe(1);  // substitution
    expect(levenshtein("asante", "asant")).toBe(1);    // deletion
    expect(levenshtein("asante", "asanter")).toBe(1);  // insertion
  });

  it("returns correct distance for multi-edit cases", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("nameKey", () => {
  it("returns lowercased underscore-joined key", () => {
    expect(nameKey("Kwame", "Asante")).toBe("kwame_asante");
  });

  it("trims whitespace", () => {
    expect(nameKey("  Kwame ", " Asante ")).toBe("kwame_asante");
  });

  it("handles mixed case", () => {
    expect(nameKey("KWAME", "asante")).toBe("kwame_asante");
  });
});

describe("findPotentialDuplicates", () => {
  const candidate = {
    id: "new",
    firstName: "Kwame",
    lastName: "Asante",
    phone: "0241234567",
    email: "kwame@example.com",
  };

  it("matches on exact phone", () => {
    const result = findPotentialDuplicates(candidate, [
      { id: "g1", firstName: "Different", lastName: "Person", phone: "+233 24 123 4567", email: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.reasons).toEqual(["phone"]);
  });

  it("matches on exact email", () => {
    const result = findPotentialDuplicates(candidate, [
      { id: "g1", firstName: "Different", lastName: "Person", phone: "0999999999", email: "kwame@example.com" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.reasons).toEqual(["email"]);
  });

  it("matches on fuzzy name (Levenshtein <= 2)", () => {
    const result = findPotentialDuplicates(candidate, [
      { id: "g1", firstName: "Kwame", lastName: "Assante", phone: "0999999999", email: null }, // 1 edit
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.reasons).toEqual(["name-fuzzy"]);
  });

  it("combines multiple match reasons in strongest-first order", () => {
    const result = findPotentialDuplicates(candidate, [
      {
        id: "g1",
        firstName: "Kwame",
        lastName: "Asante", // exact name — distance 0, also fires name-fuzzy
        phone: "+233 24 123 4567", // same normalised phone
        email: "kwame@example.com", // same email
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.reasons).toEqual(["phone", "email", "name-fuzzy"]);
  });

  it("returns empty for no-match case", () => {
    const result = findPotentialDuplicates(candidate, [
      { id: "g1", firstName: "Bernice", lastName: "Owusu", phone: "0999999999", email: "other@example.com" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("ignores candidates missing required fields (null email doesn't match null email)", () => {
    const candNoEmail = { ...candidate, email: null };
    const result = findPotentialDuplicates(candNoEmail, [
      { id: "g1", firstName: "Different", lastName: "Person", phone: "0999999999", email: null },
    ]);
    expect(result).toHaveLength(0);
  });

  it("does not match the candidate against its own id (safe for update flows)", () => {
    const result = findPotentialDuplicates(candidate, [
      { id: "new", firstName: "Kwame", lastName: "Asante", phone: "0241234567", email: "kwame@example.com" },
    ]);
    expect(result).toHaveLength(0);
  });
});
