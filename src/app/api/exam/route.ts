import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canTakeExam, startExam, submitExamAnswer, completeExam, generateRemedialQuestions } from "@/server/exam-logic";
import { getQuestionById } from "@/server/question-engine";

// GET: Check eligibility and get current exam status
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eligibility = await canTakeExam(session.userId);
  return NextResponse.json(eligibility);
}

// POST: Start or resume exam
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  switch (action) {
    case "start": {
      const eligibility = await canTakeExam(session.userId);
      if (!eligibility.canTake) {
        return NextResponse.json({ error: eligibility.reason }, { status: 403 });
      }

      const exam = await startExam(session.userId, session.companyId);
      const data = JSON.parse(exam.answers || "{}");

      // Get current question
      const currentQId = data.questionIds?.[exam.currentIndex];
      const currentQuestion = currentQId ? await getQuestionById(currentQId) : null;

      return NextResponse.json({
        examId: exam.id,
        currentIndex: exam.currentIndex,
        totalQuestions: exam.questionCount,
        currentQuestion: currentQuestion
          ? {
              id: currentQuestion.id,
              type: currentQuestion.type,
              category: currentQuestion.category,
              difficulty: currentQuestion.difficulty,
              text: currentQuestion.text,
              options: currentQuestion.options.map((o) => ({
                id: o.id,
                text: o.text,
                position: o.position,
              })),
              incorrectDefinition: currentQuestion.incorrectDefinition,
            }
          : null,
      });
    }

    case "answer": {
      const { examId, questionId, answer, score } = body;
      const count = await submitExamAnswer(examId, questionId, answer, score);
      return NextResponse.json({ answeredCount: count });
    }

    case "complete": {
      const { examId } = body;
      const result = await completeExam(examId);

      let remedialQuestions: string[] = [];
      if (!result.passed && result.weakCategories.length > 0) {
        remedialQuestions = await generateRemedialQuestions(
          session.companyId,
          result.weakCategories
        );
      }

      return NextResponse.json({
        ...result,
        remedialQuestionIds: remedialQuestions,
      });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
