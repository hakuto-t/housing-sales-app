import { describe, it, expect } from "vitest";

// Reproduce the pure logic for testing
const XP_REWARDS = {
  CORRECT_BASE: 10,
  DIFFICULTY_MULTIPLIER: 2,
  COMBO_BONUS: 5,
  SPEED_BONUS_MAX: 10,
  LEARNING_CONTINUATION: 2,
  EXAM_PASS_BONUS: 500,
} as const;

function calculateXp(params: {
  isCorrect: boolean;
  difficulty: number;
  comboCount: number;
  timeSpentSec?: number;
  timeLimitSec?: number;
}): number {
  if (!params.isCorrect) {
    return XP_REWARDS.LEARNING_CONTINUATION;
  }

  let xp = XP_REWARDS.CORRECT_BASE;
  xp += params.difficulty * XP_REWARDS.DIFFICULTY_MULTIPLIER;
  xp += Math.min(params.comboCount, 10) * XP_REWARDS.COMBO_BONUS;

  if (params.timeSpentSec && params.timeLimitSec) {
    const ratio = params.timeSpentSec / params.timeLimitSec;
    if (ratio < 0.5) {
      xp += Math.round(XP_REWARDS.SPEED_BONUS_MAX * (1 - ratio));
    }
  }

  return xp;
}

const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0, 2: 100, 3: 250, 4: 500, 5: 800,
  6: 1200, 7: 1700, 8: 2300, 9: 3000, 10: 3800,
};

function getLevelForXp(xp: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(LEVEL_THRESHOLDS)) {
    if (xp >= threshold) level = parseInt(lvl);
  }
  return level;
}

describe("Gamification - XP Calculation", () => {
  it("should give base XP for correct answer", () => {
    const xp = calculateXp({ isCorrect: true, difficulty: 1, comboCount: 0 });
    expect(xp).toBe(10 + 1 * 2); // base + difficulty
  });

  it("should give continuation XP for wrong answer", () => {
    const xp = calculateXp({ isCorrect: false, difficulty: 5, comboCount: 10 });
    expect(xp).toBe(2); // Learning continuation only
  });

  it("should add difficulty bonus", () => {
    const xp1 = calculateXp({ isCorrect: true, difficulty: 1, comboCount: 0 });
    const xp5 = calculateXp({ isCorrect: true, difficulty: 5, comboCount: 0 });
    expect(xp5 - xp1).toBe(4 * 2); // 4 difficulty levels * multiplier
  });

  it("should add combo bonus up to 10", () => {
    const xp0 = calculateXp({ isCorrect: true, difficulty: 1, comboCount: 0 });
    const xp5 = calculateXp({ isCorrect: true, difficulty: 1, comboCount: 5 });
    const xp10 = calculateXp({ isCorrect: true, difficulty: 1, comboCount: 10 });
    const xp15 = calculateXp({ isCorrect: true, difficulty: 1, comboCount: 15 });

    expect(xp5 - xp0).toBe(5 * 5); // 5 combos * bonus
    expect(xp10 - xp0).toBe(10 * 5); // 10 combos * bonus
    expect(xp15).toBe(xp10); // Capped at 10
  });

  it("should add speed bonus when fast", () => {
    const fast = calculateXp({
      isCorrect: true,
      difficulty: 1,
      comboCount: 0,
      timeSpentSec: 10,
      timeLimitSec: 60,
    });
    const slow = calculateXp({
      isCorrect: true,
      difficulty: 1,
      comboCount: 0,
      timeSpentSec: 50,
      timeLimitSec: 60,
    });

    expect(fast).toBeGreaterThan(slow);
  });

  it("should not add speed bonus when slow", () => {
    const normal = calculateXp({
      isCorrect: true,
      difficulty: 1,
      comboCount: 0,
    });
    const slow = calculateXp({
      isCorrect: true,
      difficulty: 1,
      comboCount: 0,
      timeSpentSec: 40,
      timeLimitSec: 60,
    });

    expect(slow).toBe(normal);
  });
});

describe("Gamification - Level Calculation", () => {
  it("should be level 1 at 0 XP", () => {
    expect(getLevelForXp(0)).toBe(1);
  });

  it("should be level 2 at 100 XP", () => {
    expect(getLevelForXp(100)).toBe(2);
  });

  it("should be level 2 at 249 XP", () => {
    expect(getLevelForXp(249)).toBe(2);
  });

  it("should be level 3 at 250 XP", () => {
    expect(getLevelForXp(250)).toBe(3);
  });

  it("should be level 10 at 3800 XP", () => {
    expect(getLevelForXp(3800)).toBe(10);
  });

  it("should be level 10 at very high XP", () => {
    expect(getLevelForXp(99999)).toBe(10);
  });
});

describe("Gamification - Ranking Tiebreaker", () => {
  it("should rank by XP descending, then by updatedAt ascending", () => {
    const entries = [
      { name: "A", xp: 500, updatedAt: new Date("2025-01-02") },
      { name: "B", xp: 500, updatedAt: new Date("2025-01-01") },
      { name: "C", xp: 600, updatedAt: new Date("2025-01-03") },
    ];

    const sorted = [...entries].sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      return a.updatedAt.getTime() - b.updatedAt.getTime();
    });

    expect(sorted[0].name).toBe("C"); // Highest XP
    expect(sorted[1].name).toBe("B"); // Same XP, earlier date
    expect(sorted[2].name).toBe("A"); // Same XP, later date
  });
});
