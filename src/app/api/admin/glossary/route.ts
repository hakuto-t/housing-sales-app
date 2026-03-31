import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const terms = await prisma.glossaryTerm.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ category: "asc" }, { term: "asc" }],
  });

  return NextResponse.json({ terms });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();

  const term = await prisma.glossaryTerm.create({
    data: {
      companyId: session.companyId,
      term: body.term,
      definition: body.definition,
      relatedDiff: body.relatedDiff,
      usageExample: body.usageExample,
      misuseExample: body.misuseExample,
      imageUrl: body.imageUrl,
      category: body.category,
      difficulty: body.difficulty || 1,
    },
  });

  return NextResponse.json({ term }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...data } = body;

  const term = await prisma.glossaryTerm.update({
    where: { id },
    data,
  });

  return NextResponse.json({ term });
}
