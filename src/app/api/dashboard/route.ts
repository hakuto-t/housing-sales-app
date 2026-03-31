import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getXpForNextLevel, QUESTION_CATEGORIES } from "@/lib/constants";
import { format } from "date-fns";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, submissions, sessions, weakpoint, badges, ranking] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.submission.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        isCorrect: true,
        createdAt: true,
        question: { select: { category: true } },
      },
    }),
    prisma.learningSession.findMany({
      where: { userId: session.userId },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.weakpointProfile.findUnique({ where: { userId: session.userId } }),
    prisma.userBadge.findMany({
      where: { userId: session.userId },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    }),
    prisma.rankingAllTime.findUnique({ where: { userId: session.userId } }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const totalCorrect = submissions.filter((s) => s.isCorrect).length;
  const totalAttempts = submissions.length;
  const correctRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  // Build full category stats for all 10 categories
  const parsedCategoryStats: Record<string, any> = weakpoint
    ? JSON.parse(weakpoint.categoryStats)
    : {};

  const allCategoryStats = QUESTION_CATEGORIES.map((cat) => {
    const s = parsedCategoryStats[cat];
    return {
      category: cat,
      correctRate: s ? Math.round(s.correctRate * 100) : 0,
      totalAttempts: s ? s.totalAttempts : 0,
      recentTrend: s ? Math.round((s.recentTrend ?? 0) * 100) : 0, // e.g. +10 or -5
    };
  });

  const weakCategories = allCategoryStats
    .filter((c) => c.totalAttempts > 0)
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 3);

  return NextResponse.json({
    user: {
      name: user.name,
      xp: user.xp,
      level: user.level,
      xpForNextLevel: getXpForNextLevel(user.level),
      streakDays: user.streakDays,
      isGraduated: user.isGraduated,
    },
    stats: {
      totalCorrect,
      totalAttempts,
      correctRate,
      sessionsCount: sessions.length,
    },
    weakCategories,
    allCategoryStats,
    recentBadges: badges.slice(0, 5).map((ub) => ({
      name: ub.badge.name,
      description: ub.badge.description,
      awardedAt: ub.awardedAt,
    })),
    rank: ranking?.rank ?? null,
  });
}
