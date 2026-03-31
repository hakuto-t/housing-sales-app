import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const type = searchParams.get("type") || undefined;

  const questions = await prisma.question.findMany({
    where: {
      companyId: session.companyId,
      ...(category ? { category } : {}),
      ...(type ? { type: type as any } : {}),
    },
    include: { options: { orderBy: { position: "asc" } }, tags: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ questions });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();

  const question = await prisma.question.create({
    data: {
      companyId: session.companyId,
      type: body.type,
      category: body.category,
      difficulty: body.difficulty || 1,
      text: body.text,
      explanation: body.explanation,
      mustInclude: body.mustInclude || [],
      forbiddenPoints: body.forbiddenPoints || [],
      relatedTerms: body.relatedTerms || [],
      modelAnswer: body.modelAnswer,
      correctOrder: body.correctOrder || [],
      incorrectDefinition: body.incorrectDefinition,
      correctDefinition: body.correctDefinition,
      options: body.options
        ? {
            create: body.options.map((o: any, i: number) => ({
              text: o.text,
              isCorrect: o.isCorrect || false,
              position: i + 1,
              explanation: o.explanation,
            })),
          }
        : undefined,
      tags: body.tags
        ? { create: body.tags.map((t: string) => ({ tag: t })) }
        : undefined,
    },
    include: { options: true, tags: true },
  });

  return NextResponse.json({ question }, { status: 201 });
}
