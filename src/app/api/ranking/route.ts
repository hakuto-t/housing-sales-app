import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "alltime";
  const yyyymm = searchParams.get("month") || format(new Date(), "yyyy-MM");

  if (type === "alltime") {
    const rankings = await prisma.rankingAllTime.findMany({
      where: { companyId: session.companyId },
      orderBy: { rank: "asc" },
      take: 50,
      include: {
        user: { select: { name: true, level: true, isGraduated: true } },
      },
    });

    return NextResponse.json({
      type: "alltime",
      rankings: rankings.map((r) => ({
        rank: r.rank,
        name: r.user.name,
        xp: r.totalXp,
        level: r.user.level,
        isGraduated: r.user.isGraduated,
        isMe: r.userId === session.userId,
      })),
    });
  }

  // Monthly
  const rankings = await prisma.rankingMonthly.findMany({
    where: { companyId: session.companyId, yyyymm },
    orderBy: { rank: "asc" },
    take: 50,
    include: {
      user: { select: { name: true, level: true, isGraduated: true } },
    },
  });

  return NextResponse.json({
    type: "monthly",
    month: yyyymm,
    rankings: rankings.map((r) => ({
      rank: r.rank,
      name: r.user.name,
      xp: r.monthlyXp,
      level: r.user.level,
      isGraduated: r.user.isGraduated,
      isMe: r.userId === session.userId,
    })),
  });
}
