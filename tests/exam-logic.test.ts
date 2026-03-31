import { describe, it, expect } from "vitest";

// Reproduce the pure logic for testing
function isExamPassed(totalScore: number, categoryScores: Record<string, number>): boolean {
  if (totalScore < 90) return false;
  for (const [, score] of Object.entries(categoryScores)) {
    if (score < 90) return false;
  }
  return true;
}

describe("Exam Logic - Graduation Judgment", () => {
  it("should pass when total >= 90 and all categories >= 90", () => {
    const result = isExamPassed(95, {
      建築基礎: 92,
      法規制度: 91,
      資金計画: 95,
      土地: 90,
      設計プラン: 93,
    });
    expect(result).toBe(true);
  });

  it("should fail when total < 90", () => {
    const result = isExamPassed(89, {
      建築基礎: 95,
      法規制度: 95,
      資金計画: 95,
    });
    expect(result).toBe(false);
  });

  it("should fail when any category < 90", () => {
    const result = isExamPassed(95, {
      建築基礎: 95,
      法規制度: 89,
      資金計画: 95,
    });
    expect(result).toBe(false);
  });

  it("should fail when total >= 90 but one category is 89", () => {
    const result = isExamPassed(92, {
      建築基礎: 95,
      法規制度: 95,
      資金計画: 89,
      土地: 95,
    });
    expect(result).toBe(false);
  });

  it("should pass at exact boundary (total=90, all categories=90)", () => {
    const result = isExamPassed(90, {
      建築基礎: 90,
      法規制度: 90,
      資金計画: 90,
    });
    expect(result).toBe(true);
  });

  it("should pass with perfect scores", () => {
    const result = isExamPassed(100, {
      建築基礎: 100,
      法規制度: 100,
      資金計画: 100,
      土地: 100,
      設計プラン: 100,
    });
    expect(result).toBe(true);
  });

  it("should handle empty category scores (edge case)", () => {
    const result = isExamPassed(95, {});
    expect(result).toBe(true);
  });

  it("should fail with total=0", () => {
    const result = isExamPassed(0, { 建築基礎: 0 });
    expect(result).toBe(false);
  });
});
