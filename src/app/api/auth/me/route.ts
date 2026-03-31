import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { company: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      xp: user.xp,
      level: user.level,
      streakDays: user.streakDays,
      isGraduated: user.isGraduated,
      companyId: user.companyId,
      companyName: user.company.name,
      companyCode: user.company.code,
    },
  });
}
