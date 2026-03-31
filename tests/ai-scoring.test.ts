import { describe, it, expect } from "vitest";
import { z } from "zod";

// Reproduce the schema for testing
const AIScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.enum(["correct", "partial", "incorrect"]),
  missing_points: z.array(z.string()),
  misconception: z.array(z.string()),
  model_answer: z.string(),
  next_recommendation: z.array(z.string()),
});

function parseAIResponse(raw: string) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in AI response");
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return AIScoreSchema.parse(parsed);
}

describe("AI Scoring - JSON Validation", () => {
  it("should parse valid AI response", () => {
    const raw = JSON.stringify({
      score: 85,
      verdict: "correct",
      missing_points: [],
      misconception: [],
      model_answer: "正しい定義はこちらです。",
      next_recommendation: ["用語ID_001"],
    });

    const result = parseAIResponse(raw);
    expect(result.score).toBe(85);
    expect(result.verdict).toBe("correct");
  });

  it("should extract JSON from text with extra content", () => {
    const raw = `以下が採点結果です。
{
  "score": 60,
  "verdict": "partial",
  "missing_points": ["建ぺい率の計算方法"],
  "misconception": ["容積率と混同"],
  "model_answer": "建ぺい率とは...",
  "next_recommendation": ["容積率"]
}
以上です。`;

    const result = parseAIResponse(raw);
    expect(result.score).toBe(60);
    expect(result.verdict).toBe("partial");
    expect(result.missing_points).toHaveLength(1);
    expect(result.misconception).toHaveLength(1);
  });

  it("should reject invalid score range", () => {
    const raw = JSON.stringify({
      score: 150,
      verdict: "correct",
      missing_points: [],
      misconception: [],
      model_answer: "",
      next_recommendation: [],
    });

    expect(() => parseAIResponse(raw)).toThrow();
  });

  it("should reject invalid verdict", () => {
    const raw = JSON.stringify({
      score: 50,
      verdict: "maybe",
      missing_points: [],
      misconception: [],
      model_answer: "",
      next_recommendation: [],
    });

    expect(() => parseAIResponse(raw)).toThrow();
  });

  it("should reject non-integer score", () => {
    const raw = JSON.stringify({
      score: 85.5,
      verdict: "correct",
      missing_points: [],
      misconception: [],
      model_answer: "",
      next_recommendation: [],
    });

    expect(() => parseAIResponse(raw)).toThrow();
  });

  it("should throw when no JSON present", () => {
    const raw = "これは採点結果ではありません。";
    expect(() => parseAIResponse(raw)).toThrow("No JSON found");
  });

  it("should handle score boundary values", () => {
    for (const score of [0, 50, 100]) {
      const raw = JSON.stringify({
        score,
        verdict: "partial",
        missing_points: [],
        misconception: [],
        model_answer: "",
        next_recommendation: [],
      });
      const result = parseAIResponse(raw);
      expect(result.score).toBe(score);
    }
  });
});
