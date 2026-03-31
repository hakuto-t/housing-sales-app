import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [allBadges, userBadges] = await Promise.all([
    prisma.badge.findMany({ orderBy: { name: "asc" } }),
    prisma.userBadge.findMany({
      where: { userId: session.userId },
      include: { badge: true },
    }),
  ]);

  const earnedIds = new Set(userBadges.map((ub) => ub.badgeId));

  return NextResponse.json({
    badges: allBadges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      iconUrl: b.iconUrl,
      earned: earnedIds.has(b.id),
      awardedAt: userBadges.find((ub) => ub.badgeId === b.id)?.awardedAt,
    })),
  });
}
