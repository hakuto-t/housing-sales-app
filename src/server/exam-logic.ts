import { prisma } from "@/lib/prisma";
import { EXAM_SETTINGS, GLOSSARY_CATEGORIES } from "@/lib/constants";
import { getExamQuestions } from "./question-engine";
import { ExamStatus } from "@prisma/client";

// ==================== Exam Eligibility ====================

export async function canTakeExam(userId: string): Promise<{
  canTake: boolean;
  reason?: string;
  nextAvailableAt?: Date;
}> {
  const lastExam = await prisma.examSession.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!lastExam) return { canTake: true };

  // Check for in-progress exam (allow resume)
  if (lastExam.status === ExamStatus.IN_PROGRESS) {
    return { canTake: true };
  }

  // 24-hour cooldown
  const cooldownMs = EXAM_SETTINGS.COOLDOWN_HOURS * 60 * 60 * 1000;
  const nextAvailable = new Date(lastExam.completedAt!.getTime() + cooldownMs);

  if (new Date() < nextAvailable) {
    return {
      canTake: false,
      reason: "再受験は24時間後から可能です。",
      nextAvailableAt: nextAvailable,
    };
  }

  return { canTake: true };
}

// ==================== Start Exam ====================

export async function startExam(userId: string, companyId: string) {
  // Check for resumable exam
  const existingExam = await prisma.examSession.findFirst({
    where: { userId, status: ExamStatus.IN_PROGRESS },
  });

  if (existingExam) {
    return existingExam;
  }

  // Generate questions
  const questionIds = await getExamQuestions(companyId, EXAM_SETTINGS.TYPE_DISTRIBUTION);

  const exam = await prisma.examSession.create({
    data: {
      userId,
      questionCount: EXAM_SETTINGS.TOTAL_QUESTIONS,
      answers: JSON.stringify({ questionIds, responses: [] }),
    },
  });

  return exam;
}

// ==================== Submit Exam Answer ====================

export async function submitExamAnswer(
  examId: string,
  questionId: string,
  answer: unknown,
  score: number
) {
  const exam = await prisma.examSession.findUnique({ where: { id: examId } });
  if (!exam || exam.status !== ExamStatus.IN_PROGRESS) {
    throw new Error("Exam session not found or already completed");
  }

  const data = JSON.parse(exam.answers || "{}");
  data.responses = data.responses || [];
  data.responses.push({ questionId, answer, score });

  await prisma.examSession.update({
    where: { id: examId },
    data: {
      currentIndex: exam.currentIndex + 1,
      answers: JSON.stringify(data),
    },
  });

  return data.responses.length;
}

// ==================== Complete & Judge Exam ====================

export interface ExamResult {
  passed: boolean;
  totalScore: number;
  categoryScores: Record<string, number>;
  failedCategories: string[];
  weakCategories: string[];
}

export function isExamPassed(
  totalScore: number,
  categoryScores: Record<string, number>
): boolean {
  if (totalScore < EXAM_SETTINGS.PASS_TOTAL_SCORE) return false;
  for (const [, score] of Object.entries(categoryScores)) {
    if (score < EXAM_SETTINGS.PASS_CATEGORY_SCORE) return false;
  }
  return true;
}

export async function completeExam(examId: string): Promise<ExamResult> {
  const exam = await prisma.examSession.findUnique({ where: { id: examId } });
  if (!exam) throw new Error("Exam session not found");

  const data = JSON.parse(exam.answers || "{}");
  const responses = data.responses || [];

  // Get questions to map categories
  const questionIds = responses.map((r: { questionId: string }) => r.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, category: true },
  });
  const categoryMap = new Map(questions.map((q) => [q.id, q.category]));

  // Calculate category scores
  const categoryTotals: Record<string, { total: number; count: number }> = {};
  let totalScoreSum = 0;

  for (const response of responses) {
    const cat = categoryMap.get(response.questionId) || "unknown";
    if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, count: 0 };
    categoryTotals[cat].total += response.score;
    categoryTotals[cat].count += 1;
    totalScoreSum += response.score;
  }

  const categoryScores: Record<string, number> = {};
  for (const [cat, data] of Object.entries(categoryTotals)) {
    categoryScores[cat] = data.count > 0 ? Math.round(data.total / data.count) : 0;
  }

  const totalScore =
    responses.length > 0 ? Math.round(totalScoreSum / responses.length) : 0;

  const passed = isExamPassed(totalScore, categoryScores);

  const failedCategories = Object.entries(categoryScores)
    .filter(([, score]) => score < EXAM_SETTINGS.PASS_CATEGORY_SCORE)
    .map(([cat]) => cat);

  // Sort weakest first
  const weakCategories = Object.entries(categoryScores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([cat]) => cat);

  // Update exam session
  await prisma.examSession.update({
    where: { id: examId },
    data: {
      status: passed ? ExamStatus.PASSED : ExamStatus.FAILED,
      completedAt: new Date(),
      totalScore,
      categoryScores: JSON.stringify(categoryScores),
    },
  });

  // If passed, update user graduation status
  if (passed) {
    await prisma.user.update({
      where: { id: exam.userId },
      data: { isGraduated: true },
    });
  }

  return { passed, totalScore, categoryScores, failedCategories, weakCategories };
}

// ==================== Generate Remedial Set ====================

export async function generateRemedialQuestions(
  companyId: string,
  weakCategories: string[],
  count: number = 20
): Promise<string[]> {
  const questions = await prisma.question.findMany({
    where: {
      companyId,
      isActive: true,
      category: { in: weakCategories },
    },
    select: { id: true },
  });

  const shuffled = questions.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((q) => q.id);
}
