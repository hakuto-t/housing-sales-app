import { prisma } from "@/lib/prisma";
import { XP_REWARDS, getLevelForXp } from "@/lib/constants";
import { format } from "date-fns";

// ==================== XP Calculation ====================

export function calculateXp(params: {
  isCorrect: boolean;
  difficulty: number;
  comboCount: number;
  timeSpentSec?: number;
  timeLimitSec?: number;
}): number {
  if (!params.isCorrect) {
    return XP_REWARDS.LEARNING_CONTINUATION;
  }

  let xp = XP_REWARDS.CORRECT_BASE;

  // Difficulty bonus
  xp += params.difficulty * XP_REWARDS.DIFFICULTY_MULTIPLIER;

  // Combo bonus
  xp += Math.min(params.comboCount, 10) * XP_REWARDS.COMBO_BONUS;

  // Speed bonus (if answered within half the time limit)
  if (params.timeSpentSec && params.timeLimitSec) {
    const ratio = params.timeSpentSec / params.timeLimitSec;
    if (ratio < 0.5) {
      xp += Math.round(XP_REWARDS.SPEED_BONUS_MAX * (1 - ratio));
    }
  }

  return xp;
}

// ==================== User XP & Level Update ====================

export async function addUserXp(userId: string, xpToAdd: number) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      xp: { increment: xpToAdd },
      lastActiveAt: new Date(),
    },
  });

  const newLevel = getLevelForXp(user.xp);
  if (newLevel !== user.level) {
    await prisma.user.update({
      where: { id: userId },
      data: { level: newLevel },
    });
  }

  // Update rankings
  await updateRankings(userId, user.companyId, xpToAdd);

  return { xp: user.xp, level: newLevel };
}

// ==================== Streak ====================

export async function updateStreak(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActiveAt: true, streakDays: true },
  });

  if (!user) return 0;

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");

  if (user.lastActiveAt) {
    const lastActive = format(user.lastActiveAt, "yyyy-MM-dd");
    const yesterday = format(new Date(now.getTime() - 86400000), "yyyy-MM-dd");

    if (lastActive === today) {
      return user.streakDays; // Already active today
    } else if (lastActive === yesterday) {
      // Consecutive day
      const newStreak = user.streakDays + 1;
      await prisma.user.update({
        where: { id: userId },
        data: { streakDays: newStreak },
      });
      return newStreak;
    } else {
      // Streak broken
      await prisma.user.update({
        where: { id: userId },
        data: { streakDays: 1 },
      });
      return 1;
    }
  } else {
    // First activity
    await prisma.user.update({
      where: { id: userId },
      data: { streakDays: 1 },
    });
    return 1;
  }
}

// ==================== Rankings ====================

async function updateRankings(userId: string, companyId: string, xpToAdd: number) {
  const yyyymm = format(new Date(), "yyyy-MM");

  // All-time ranking
  await prisma.rankingAllTime.upsert({
    where: { userId },
    update: { totalXp: { increment: xpToAdd } },
    create: { userId, companyId, totalXp: xpToAdd, rank: 0 },
  });

  // Monthly ranking
  await prisma.rankingMonthly.upsert({
    where: { userId_yyyymm: { userId, yyyymm } },
    update: { monthlyXp: { increment: xpToAdd } },
    create: { userId, companyId, yyyymm, monthlyXp: xpToAdd, rank: 0 },
  });

  // Recalculate ranks for the company
  await recalculateRanks(companyId, yyyymm);
}

async function recalculateRanks(companyId: string, yyyymm: string) {
  // All-time
  const allTime = await prisma.rankingAllTime.findMany({
    where: { companyId },
    orderBy: [{ totalXp: "desc" }, { updatedAt: "asc" }],
  });

  for (let i = 0; i < allTime.length; i++) {
    if (allTime[i].rank !== i + 1) {
      await prisma.rankingAllTime.update({
        where: { id: allTime[i].id },
        data: { rank: i + 1 },
      });
    }
  }

  // Monthly
  const monthly = await prisma.rankingMonthly.findMany({
    where: { companyId, yyyymm },
    orderBy: [{ monthlyXp: "desc" }, { updatedAt: "asc" }],
  });

  for (let i = 0; i < monthly.length; i++) {
    if (monthly[i].rank !== i + 1) {
      await prisma.rankingMonthly.update({
        where: { id: monthly[i].id },
        data: { rank: i + 1 },
      });
    }
  }
}

// ==================== Badge Evaluation ====================

interface BadgeCondition {
  type: string;
  threshold: number;
  category?: string;
  questionType?: string;
}

export async function evaluateBadges(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      badges: true,
      submissions: {
        select: {
          isCorrect: true,
          score: true,
          timeSpentSec: true,
          question: { select: { category: true, type: true } },
        },
      },
      examSessions: { select: { status: true } },
    },
  });

  if (!user) return [];

  const existingBadgeIds = new Set(user.badges.map((b) => b.badgeId));

  const allBadges = await prisma.badge.findMany();
  const newBadges: { name: string; description: string }[] = [];

  for (const badge of allBadges) {
    if (existingBadgeIds.has(badge.id)) continue;

    const condition: BadgeCondition = JSON.parse(badge.condition);
    let earned = false;

    switch (condition.type) {
      case "total_correct": {
        const correct = user.submissions.filter((s) => s.isCorrect).length;
        earned = correct >= condition.threshold;
        break;
      }
      case "streak_days": {
        earned = user.streakDays >= condition.threshold;
        break;
      }
      case "level_reached": {
        earned = user.level >= condition.threshold;
        break;
      }
      case "category_mastery": {
        if (condition.category) {
          const catSubs = user.submissions.filter(
            (s) => s.question.category === condition.category
          );
          const correctRate =
            catSubs.length > 0
              ? catSubs.filter((s) => s.isCorrect).length / catSubs.length
              : 0;
          earned = correctRate >= condition.threshold / 100 && catSubs.length >= 10;
        }
        break;
      }
      case "exam_passed": {
        const passed = user.examSessions.filter((e) => e.status === "PASSED").length;
        earned = passed >= condition.threshold;
        break;
      }
      case "exam_attempted": {
        earned = user.examSessions.length >= condition.threshold;
        break;
      }
      case "combo_max": {
        const sessions = await prisma.learningSession.findMany({
          where: { userId },
          select: { comboMax: true },
        });
        const maxCombo = Math.max(...sessions.map((s) => s.comboMax), 0);
        earned = maxCombo >= condition.threshold;
        break;
      }
      case "total_submissions": {
        earned = user.submissions.length >= condition.threshold;
        break;
      }
      case "total_xp": {
        earned = user.xp >= condition.threshold;
        break;
      }
      case "perfect_session": {
        const perfectSessions = await prisma.learningSession.findMany({
          where: { userId, correctCount: { gte: condition.threshold } },
          select: { correctCount: true, totalQuestions: true },
        });
        earned = perfectSessions.some(
          (s) => s.correctCount === s.totalQuestions && s.totalQuestions >= condition.threshold
        );
        break;
      }
      case "speed_answer": {
        const fastAnswers = user.submissions.filter(
          (s) => s.isCorrect && s.timeSpentSec !== null && s.timeSpentSec <= condition.threshold
        );
        earned = fastAnswers.length >= 10;
        break;
      }
      case "all_category_mastery": {
        const categories = [
          "建築基礎", "法規・制度", "資金計画", "土地", "設計・プラン",
          "構造・工法", "設備・仕様", "契約・手続き", "税金・保険", "営業スキル",
        ];
        earned = categories.every((cat) => {
          const catSubs = user.submissions.filter((s) => s.question.category === cat);
          if (catSubs.length < 10) return false;
          const rate = catSubs.filter((s) => s.isCorrect).length / catSubs.length;
          return rate >= condition.threshold / 100;
        });
        break;
      }
      case "question_type_count": {
        if (condition.questionType) {
          const typeSubs = user.submissions.filter(
            (s) => s.isCorrect && s.question.type === condition.questionType
          );
          earned = typeSubs.length >= condition.threshold;
        }
        break;
      }
      case "category_count": {
        const catMap: Record<string, number> = {};
        for (const s of user.submissions) {
          catMap[s.question.category] = (catMap[s.question.category] || 0) + 1;
        }
        const activeCats = Object.values(catMap).filter((c) => c >= 5).length;
        earned = activeCats >= condition.threshold;
        break;
      }
    }

    if (earned) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
      });
      newBadges.push({ name: badge.name, description: badge.description });
    }
  }

  return newBadges;
}

// ==================== Weakpoint Profile Update ====================

export async function updateWeakpointProfile(userId: string) {
  const submissions = await prisma.submission.findMany({
    where: { userId },
    include: { question: { select: { category: true } } },
    orderBy: { createdAt: "desc" },
  });

  const categoryStats: Record<
    string,
    { correctRate: number; totalAttempts: number; recentTrend: number }
  > = {};

  // Group by category
  const grouped: Record<string, typeof submissions> = {};
  for (const sub of submissions) {
    const cat = sub.question.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(sub);
  }

  for (const [cat, subs] of Object.entries(grouped)) {
    const total = subs.length;
    const correct = subs.filter((s) => s.isCorrect).length;
    const correctRate = total > 0 ? correct / total : 0;

    // Recent trend: compare last 5 vs previous 5
    const recent5 = subs.slice(0, 5);
    const prev5 = subs.slice(5, 10);
    const recentRate =
      recent5.length > 0 ? recent5.filter((s) => s.isCorrect).length / recent5.length : 0;
    const prevRate =
      prev5.length > 0 ? prev5.filter((s) => s.isCorrect).length / prev5.length : 0;

    categoryStats[cat] = {
      correctRate,
      totalAttempts: total,
      recentTrend: recentRate - prevRate,
    };
  }

  await prisma.weakpointProfile.upsert({
    where: { userId },
    update: {
      categoryStats: JSON.stringify(categoryStats),
      lastCalculatedAt: new Date(),
    },
    create: {
      userId,
      categoryStats: JSON.stringify(categoryStats),
    },
  });

  return categoryStats;
}
