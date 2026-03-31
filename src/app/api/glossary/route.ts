import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const difficulty = searchParams.get("difficulty")
    ? parseInt(searchParams.get("difficulty")!)
    : undefined;

  const where: Record<string, unknown> = { companyId: session.companyId };
  if (search) {
    where.OR = [
      { term: { contains: search, mode: "insensitive" } },
      { definition: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;
  if (difficulty) where.difficulty = difficulty;

  const terms = await prisma.glossaryTerm.findMany({
    where: where as any,
    orderBy: [{ category: "asc" }, { term: "asc" }],
  });

  return NextResponse.json({ terms });
}
