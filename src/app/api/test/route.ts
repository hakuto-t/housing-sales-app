import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTestQuestions, getQuestionById } from "@/server/question-engine";
import { SessionMode } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count = 20 } = await req.json().catch(() => ({}));

  const questionIds = await getTestQuestions(session.companyId, count);

  const learningSession = await prisma.learningSession.create({
    data: {
      userId: session.userId,
      mode: SessionMode.TEST,
      totalQuestions: questionIds.length,
    },
  });

  const questions = await Promise.all(questionIds.map((id) => getQuestionById(id)));

  return NextResponse.json({
    sessionId: learningSession.id,
    questions: questions.filter(Boolean).map((q) => {
      // For ORDERING questions, build items from correctOrder (shuffled)
      let orderingItems: { id: string; text: string }[] | undefined;
      if (q!.type === "ORDERING" && q!.correctOrder.length > 0) {
        orderingItems = q!.correctOrder
          .map((text, i) => ({ id: String(i), text }))
          .sort(() => Math.random() - 0.5);
      }
      return {
        id: q!.id,
        type: q!.type,
        category: q!.category,
        difficulty: q!.difficulty,
        text: q!.text,
        options: q!.options.map((o) => ({
          id: o.id,
          text: o.text,
          position: o.position,
        })),
        orderingItems,
        incorrectDefinition: q!.incorrectDefinition,
      };
    }),
  });
}
