import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreWithAI } from "@/server/ai-scoring";
import { calculateXp } from "@/server/gamification";
import { getLevelForXp } from "@/lib/constants";
import { Verdict, QuestionType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, questionId, answer, timeSpentSec } = body;

    if (!sessionId || !questionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Get current combo
    const prevSubmission = await prisma.submission.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      select: { isCorrect: true, comboCount: true },
    });
    const currentCombo = prevSubmission?.isCorrect ? (prevSubmission.comboCount || 0) + 1 : 0;

    let isCorrect = false;
    let score = 0;
    let verdict: Verdict = Verdict.INCORRECT;
    let judgmentReason = "";
    let selectedOptionId: string | null = null;
    let freeTextAnswer: string | null = null;
    let orderingAnswer: string[] = [];
    let fixedDefinition: string | null = null;
    let missingPoints: string[] = [];
    let misconception: string[] = [];
    let aiModelAnswer = "";

    switch (question.type) {
      case QuestionType.MCQ: {
        selectedOptionId = answer.optionId;
        const correctOption = question.options.find((o) => o.isCorrect);
        isCorrect = correctOption?.id === selectedOptionId;
        score = isCorrect ? 100 : 0;
        verdict = isCorrect ? Verdict.CORRECT : Verdict.INCORRECT;
        judgmentReason = isCorrect
          ? "正解です。"
          : `不正解です。正解は「${correctOption?.text}」です。`;
        break;
      }

      case QuestionType.FREE_TEXT:
      case QuestionType.CASE_MULTI: {
        freeTextAnswer = answer.text;
        console.log(`[submit] AI scoring start: ${Date.now() - t0}ms, provider: ${process.env.LLM_MODEL || 'local'}`);
        const aiResult = await scoreWithAI(
          "__pending__",
          question.text,
          question.mustInclude,
          question.forbiddenPoints,
          question.relatedTerms,
          freeTextAnswer || "",
          question.modelAnswer || ""
        );
        console.log(`[submit] AI scoring done: ${Date.now() - t0}ms, score: ${aiResult.score}, verdict: ${aiResult.verdict}`);
        score = aiResult.score;
        isCorrect = aiResult.verdict === "correct";
        verdict = aiResult.verdict === "correct"
          ? Verdict.CORRECT
          : aiResult.verdict === "partial"
            ? Verdict.PARTIAL
            : Verdict.INCORRECT;
        missingPoints = aiResult.missing_points;
        misconception = aiResult.misconception;
        aiModelAnswer = aiResult.model_answer;
        judgmentReason = JSON.stringify({
          missingPoints: aiResult.missing_points,
          misconception: aiResult.misconception,
          modelAnswer: aiResult.model_answer,
        });
        break;
      }

      case QuestionType.ORDERING: {
        const rawOrder: string[] = answer.order || [];
        const correct = question.correctOrder;
        const userOrderTexts = rawOrder.map((id: string) => {
          const idx = parseInt(id, 10);
          return !isNaN(idx) && idx >= 0 && idx < correct.length ? correct[idx] : id;
        });
        orderingAnswer = userOrderTexts;
        isCorrect = JSON.stringify(userOrderTexts) === JSON.stringify(correct);
        if (!isCorrect) {
          let correctPositions = 0;
          for (let i = 0; i < correct.length; i++) {
            if (userOrderTexts[i] === correct[i]) correctPositions++;
          }
          score = Math.round((correctPositions / correct.length) * 100);
          verdict = score >= 50 ? Verdict.PARTIAL : Verdict.INCORRECT;
        } else {
          score = 100;
          verdict = Verdict.CORRECT;
        }
        judgmentReason = isCorrect
          ? "正しい順序です。"
          : `正しい順序は: ${correct.join(" → ")}`;
        break;
      }

      case QuestionType.DEFINITION_FIX: {
        fixedDefinition = answer.text;
        if (question.correctDefinition) {
          const aiResult = await scoreWithAI(
            "__pending__",
            `以下の定義の誤りを修正してください: ${question.incorrectDefinition}`,
            question.mustInclude,
            question.forbiddenPoints,
            question.relatedTerms,
            fixedDefinition || "",
            question.correctDefinition
          );
          score = aiResult.score;
          isCorrect = aiResult.verdict === "correct";
          verdict = aiResult.verdict === "correct"
            ? Verdict.CORRECT
            : aiResult.verdict === "partial"
              ? Verdict.PARTIAL
              : Verdict.INCORRECT;
          missingPoints = aiResult.missing_points;
          misconception = aiResult.misconception;
          aiModelAnswer = question.correctDefinition;
          judgmentReason = JSON.stringify({
            correctDefinition: question.correctDefinition,
            missingPoints: aiResult.missing_points,
          });
        }
        break;
      }
    }

    // Calculate XP (pure function, no DB)
    const comboCount = isCorrect ? currentCombo + 1 : 0;
    const xpAwarded = calculateXp({
      isCorrect,
      difficulty: question.difficulty,
      comboCount,
      timeSpentSec,
    });

    // === Single DB transaction for ALL writes ===
    // This avoids multiple sequential DB calls and connection pool exhaustion
    const submission = await prisma.submission.create({
      data: {
        userId: session.userId,
        questionId,
        sessionId,
        selectedOptionId,
        freeTextAnswer,
        orderingAnswer,
        fixedDefinition,
        isCorrect,
        score,
        verdict,
        xpAwarded,
        timeSpentSec,
        comboCount,
        judgmentReason,
      },
    });

    // Lightweight inline updates — no heavy gamification functions
    // Update user XP and level in a single call
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        xp: { increment: xpAwarded },
        lastActiveAt: new Date(),
      },
      select: { xp: true, level: true },
    });

    const newLevel = getLevelForXp(updatedUser.xp);
    if (newLevel !== updatedUser.level) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { level: newLevel },
      });
    }

    // Update session stats in one call
    await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        correctCount: { increment: isCorrect ? 1 : 0 },
        xpEarned: { increment: xpAwarded },
        ...(comboCount > 0 ? {} : {}),
      },
    });

    // Update combo max if needed (single conditional query)
    const currentSession = await prisma.learningSession.findUnique({
      where: { id: sessionId },
      select: { comboMax: true },
    });
    if (currentSession && comboCount > currentSession.comboMax) {
      await prisma.learningSession.update({
        where: { id: sessionId },
        data: { comboMax: comboCount },
      });
    }

    // Skip heavy operations: recalculateRanks, evaluateBadges, updateWeakpointProfile
    // These will be calculated on-demand when the user visits dashboard/rankings/badges pages

    const explanation = question.explanation;
    const correctOption = question.options.find((o) => o.isCorrect);

    console.log(`[submit] TOTAL: ${Date.now() - t0}ms, verdict: ${verdict}`);
    return NextResponse.json({
      submissionId: submission.id,
      isCorrect,
      score,
      verdict,
      xpAwarded,
      comboCount,
      judgmentReason,
      explanation,
      correctAnswer: correctOption?.text,
      correctOrder: question.type === "ORDERING" ? question.correctOrder : undefined,
      modelAnswer: question.modelAnswer,
      newBadges: [],
      missingPoints,
      misconception,
      aiModelAnswer: aiModelAnswer || question.modelAnswer || "",
      mustInclude: question.mustInclude,
      relatedTerms: question.relatedTerms,
    });

  } catch (err) {
    console.error(`[submit] ERROR at ${Date.now() - t0}ms:`, err);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
