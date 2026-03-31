import { prisma } from "@/lib/prisma";
import { QuestionType } from "@prisma/client";
import { DESCRIPTIVE_RATIO_MAX, DESCRIPTIVE_TYPES } from "@/lib/constants";

interface PositionStats {
  1: number;
  2: number;
  3: number;
  4: number;
}

/**
 * Weighted random selection to balance correct answer positions over time
 */
export function chooseCorrectIndexWithBalance(stats: PositionStats): number {
  const total = stats[1] + stats[2] + stats[3] + stats[4] + 1;
  const ideal = total / 4;
  const weights = ([1, 2, 3, 4] as const).map((i) =>
    Math.max(0.1, ideal - stats[i] + 1)
  );
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

/**
 * Cap descriptive questions to DESCRIPTIVE_RATIO_MAX of total count.
 * Takes scored/sorted arrays and merges them respecting the ratio limit.
 */
function applyDescriptiveRatioCap<T extends { id: string; type?: string }>(
  descriptive: T[],
  nonDescriptive: T[],
  count: number
): T[] {
  const maxDescriptive = Math.floor(count * DESCRIPTIVE_RATIO_MAX);
  const pickedDescriptive = descriptive.slice(0, maxDescriptive);
  const remaining = count - pickedDescriptive.length;
  const pickedNonDescriptive = nonDescriptive.slice(0, remaining);
  const result = [...pickedDescriptive, ...pickedNonDescriptive];
  // Shuffle to avoid predictable ordering
  return result.sort(() => Math.random() - 0.5);
}

/**
 * Learning mode: prioritize weak categories and recently wrong questions
 */
export async function getLearnQuestions(
  userId: string,
  companyId: string,
  count: number = 10
): Promise<string[]> {
  // Get user's weakpoint profile
  const weakpoint = await prisma.weakpointProfile.findUnique({
    where: { userId },
  });

  let categoryWeights: Record<string, number> = {};

  if (weakpoint) {
    const stats = JSON.parse(weakpoint.categoryStats) as Record<
      string,
      { correctRate: number; totalAttempts: number }
    >;
    for (const [cat, s] of Object.entries(stats)) {
      // Lower correct rate = higher weight (prioritize weak areas)
      categoryWeights[cat] = Math.max(0.1, 1 - s.correctRate) * (s.totalAttempts > 0 ? 2 : 1);
    }
  }

  // Get recently incorrect question IDs
  const recentWrong = await prisma.submission.findMany({
    where: { userId, isCorrect: false },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { questionId: true },
  });
  const recentWrongIds = recentWrong.map((s) => s.questionId);

  // Get all active questions
  const questions = await prisma.question.findMany({
    where: { companyId, isActive: true },
    select: { id: true, category: true, difficulty: true, type: true },
  });

  // Score each question
  const scored = questions.map((q) => {
    let score = 1;
    // Weak category boost
    if (categoryWeights[q.category]) {
      score += categoryWeights[q.category] * 3;
    }
    // Recent wrong boost
    if (recentWrongIds.includes(q.id)) {
      score += 5;
    }
    return { id: q.id, type: q.type, score };
  });

  // Weighted shuffle
  scored.sort((a, b) => {
    const aRand = Math.random() * a.score;
    const bRand = Math.random() * b.score;
    return bRand - aRand;
  });

  // Split by descriptive vs non-descriptive and apply ratio cap
  const isDescriptive = (type: string) =>
    (DESCRIPTIVE_TYPES as readonly string[]).includes(type);
  const descriptive = scored.filter((q) => isDescriptive(q.type));
  const nonDescriptive = scored.filter((q) => !isDescriptive(q.type));

  return applyDescriptiveRatioCap(descriptive, nonDescriptive, count).map((q) => q.id);
}

/**
 * Category-specific learning: filter by category, sort easy→hard
 */
export async function getCategoryLearnQuestions(
  userId: string,
  companyId: string,
  category: string,
  count: number = 10
): Promise<string[]> {
  // Get recently incorrect question IDs for priority boost
  const recentWrong = await prisma.submission.findMany({
    where: { userId, isCorrect: false },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { questionId: true },
  });
  const recentWrongIds = new Set(recentWrong.map((s) => s.questionId));

  // Get questions for this category only
  const questions = await prisma.question.findMany({
    where: { companyId, isActive: true, category },
    select: { id: true, difficulty: true },
  });

  // Sort by difficulty ascending, shuffle within same difficulty
  // Recently wrong questions get priority within their difficulty tier
  const sorted = questions.sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    // Within same difficulty: recently wrong first, then random
    const aWrong = recentWrongIds.has(a.id) ? 0 : 1;
    const bWrong = recentWrongIds.has(b.id) ? 0 : 1;
    if (aWrong !== bWrong) return aWrong - bWrong;
    return Math.random() - 0.5;
  });

  return sorted.slice(0, count).map((q) => q.id);
}

/**
 * Test mode: gradually increase difficulty with combo bonus
 */
export async function getTestQuestions(
  companyId: string,
  count: number = 20
): Promise<string[]> {
  const questions = await prisma.question.findMany({
    where: { companyId, isActive: true },
    select: { id: true, difficulty: true, type: true },
    orderBy: { difficulty: "asc" },
  });

  // Distribute: easy -> medium -> hard
  const easy = questions.filter((q) => q.difficulty <= 2);
  const medium = questions.filter((q) => q.difficulty === 3);
  const hard = questions.filter((q) => q.difficulty >= 4);

  const easyCount = Math.ceil(count * 0.3);
  const medCount = Math.ceil(count * 0.4);
  const hardCount = count - easyCount - medCount;

  const pick = (arr: typeof questions, n: number) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  };

  // Gather candidates with type info
  const candidates = [
    ...pick(easy, easyCount),
    ...pick(medium, medCount),
    ...pick(hard, hardCount),
  ];

  // Apply descriptive ratio cap
  const isDescriptive = (type: string) =>
    (DESCRIPTIVE_TYPES as readonly string[]).includes(type);
  const descriptive = candidates.filter((q) => isDescriptive(q.type));
  const nonDescriptive = candidates.filter((q) => !isDescriptive(q.type));

  return applyDescriptiveRatioCap(descriptive, nonDescriptive, count).map((q) => q.id);
}

/**
 * Exam mode: 120 questions, evenly distributed by category and type
 */
export async function getExamQuestions(
  companyId: string,
  typeDistribution: Record<string, number> = {
    MCQ: 60,
    FREE_TEXT: 30,
    CASE_MULTI: 20,
    DEFINITION_FIX: 5,
    ORDERING: 5,
  }
): Promise<string[]> {
  const result: string[] = [];

  for (const [type, count] of Object.entries(typeDistribution)) {
    const questions = await prisma.question.findMany({
      where: {
        companyId,
        isActive: true,
        type: type as QuestionType,
      },
      select: { id: true, category: true },
    });

    // Try to evenly distribute across categories
    const byCategory: Record<string, string[]> = {};
    for (const q of questions) {
      if (!byCategory[q.category]) byCategory[q.category] = [];
      byCategory[q.category].push(q.id);
    }

    const categories = Object.keys(byCategory);
    const perCategory = Math.ceil(count / Math.max(categories.length, 1));
    let picked: string[] = [];

    for (const cat of categories) {
      const shuffled = byCategory[cat].sort(() => Math.random() - 0.5);
      picked.push(...shuffled.slice(0, perCategory));
    }

    // Shuffle and trim to exact count
    picked = picked.sort(() => Math.random() - 0.5).slice(0, count);
    result.push(...picked);
  }

  // Final shuffle
  return result.sort(() => Math.random() - 0.5);
}

/**
 * Get full question data with options for rendering
 */
export async function getQuestionById(questionId: string) {
  return prisma.question.findUnique({
    where: { id: questionId },
    include: {
      options: { orderBy: { position: "asc" } },
      tags: true,
      explanationAssets: true,
    },
  });
}
