import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { companyCode, name } = await req.json();

  if (!companyCode || !name) {
    return NextResponse.json({ error: "会社コードと氏名を入力してください" }, { status: 400 });
  }

  const trimmedName = name.trim();
  const trimmedCode = companyCode.trim().toUpperCase();

  // 会社コードで会社を検索
  const company = await prisma.company.findUnique({
    where: { code: trimmedCode },
  });

  if (!company) {
    return NextResponse.json({ error: "会社コードが見つかりません" }, { status: 404 });
  }

  // 会社 + 氏名でユーザーを検索、なければ自動作成
  let user = await prisma.user.findUnique({
    where: { companyId_name: { companyId: company.id, name: trimmedName } },
    include: { company: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: trimmedName,
        companyId: company.id,
        role: "LEARNER",
      },
      include: { company: true },
    });
  }

  const token = await createToken({
    userId: user.id,
    email: user.email || "",
    role: user.role,
    companyId: user.companyId,
  });

  await setSessionCookie(token);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      xp: user.xp,
      level: user.level,
      streakDays: user.streakDays,
      companyName: user.company.name,
    },
  });
}
