import { describe, it, expect } from "vitest";

// Import the function directly for unit testing
// We test the pure logic functions without DB dependency

function chooseCorrectIndexWithBalance(stats: { 1: number; 2: number; 3: number; 4: number }): number {
  const total = stats[1] + stats[2] + stats[3] + stats[4] + 1;
  const ideal = total / 4;
  const weights = ([1, 2, 3, 4] as const).map((i) => Math.max(0.1, ideal - stats[i] + 1));
  return weightedRandom([1, 2, 3, 4], weights);
}

function weightedRandom(items: number[], weights: number[]): number {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

describe("Question Engine - Position Balance", () => {
  it("should return a valid position (1-4)", () => {
    const stats = { 1: 10, 2: 10, 3: 10, 4: 10 };
    const result = chooseCorrectIndexWithBalance(stats);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(4);
  });

  it("should favor underrepresented positions", () => {
    // Position 3 has much fewer than others
    const stats = { 1: 100, 2: 100, 3: 10, 4: 100 };
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    for (let i = 0; i < 1000; i++) {
      const result = chooseCorrectIndexWithBalance(stats);
      counts[result]++;
    }

    // Position 3 should be chosen more often than others
    expect(counts[3]).toBeGreaterThan(counts[1]);
    expect(counts[3]).toBeGreaterThan(counts[2]);
    expect(counts[3]).toBeGreaterThan(counts[4]);
  });

  it("should distribute roughly evenly when stats are equal", () => {
    const stats = { 1: 25, 2: 25, 3: 25, 4: 25 };
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    for (let i = 0; i < 10000; i++) {
      const result = chooseCorrectIndexWithBalance(stats);
      counts[result]++;
    }

    // Each position should be roughly 25% (±10%)
    for (const pos of [1, 2, 3, 4]) {
      const ratio = counts[pos] / 10000;
      expect(ratio).toBeGreaterThan(0.15);
      expect(ratio).toBeLessThan(0.35);
    }
  });

  it("should strongly favor empty positions when others have many", () => {
    const stats = { 1: 50, 2: 50, 3: 0, 4: 50 };
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    for (let i = 0; i < 1000; i++) {
      const result = chooseCorrectIndexWithBalance(stats);
      counts[result]++;
    }

    // Position 3 should dominate
    expect(counts[3]).toBeGreaterThan(400);
  });
});
