"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface CategoryStat {
  category: string;
  correctRate: number;
  totalAttempts: number;
  recentTrend: number;
}

interface DashboardData {
  user: {
    name: string;
    xp: number;
    level: number;
    xpForNextLevel: number;
    streakDays: number;
    isGraduated: boolean;
  };
  stats: {
    totalCorrect: number;
    totalAttempts: number;
    correctRate: number;
    sessionsCount: number;
  };
  weakCategories: { category: string; correctRate: number }[];
  allCategoryStats: CategoryStat[];
  recentBadges: { name: string; description: string; awardedAt: string }[];
  rank: number | null;
}

const categoryIcons: Record<string, string> = {
  "建築基礎": "🏗️",
  "法規・制度": "📜",
  "資金計画": "💰",
  "土地": "🗺️",
  "設計・プラン": "📐",
  "構造・工法": "🔩",
  "設備・仕様": "⚙️",
  "契約・手続き": "📝",
  "税金・保険": "🏦",
  "営業スキル": "🤝",
};

// SVG Radar Chart component (no external library needed)
function RadarChart({ stats }: { stats: CategoryStat[] }) {
  const size = 300;
  const center = size / 2;
  const radius = 120;
  const levels = 5; // 0%, 20%, 40%, 60%, 80%, 100%
  const count = stats.length;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const gridLines = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * radius;
    const points = Array.from({ length: count }, (_, j) => {
      const angle = (Math.PI * 2 * j) / count - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(" ");
    return points;
  });

  const dataPoints = stats.map((s, i) => getPoint(i, s.correctRate));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Short label for each category
  const shortLabels = stats.map((s) => {
    const name = s.category;
    if (name.includes("・")) {
      const parts = name.split("・");
      return parts[0].substring(0, 3);
    }
    return name.substring(0, 4);
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px] mx-auto">
      {/* Grid */}
      {gridLines.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={i === levels - 1 ? 1.5 : 0.8}
        />
      ))}
      {/* Axis lines */}
      {stats.map((_, i) => {
        const p = getPoint(i, 100);
        return (
          <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth={0.8} />
        );
      })}
      {/* Data polygon */}
      <polygon
        points={dataPath}
        fill="rgba(234, 88, 12, 0.2)"
        stroke="#ea580c"
        strokeWidth={2}
      />
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#ea580c" stroke="white" strokeWidth={2} />
      ))}
      {/* Labels */}
      {stats.map((s, i) => {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const labelR = radius + 28;
        const x = center + labelR * Math.cos(angle);
        const y = center + labelR * Math.sin(angle);
        const rate = s.correctRate;
        const color = rate >= 70 ? "#16a34a" : rate >= 50 ? "#ca8a04" : s.totalAttempts === 0 ? "#9ca3af" : "#dc2626";
        return (
          <g key={i}>
            <text
              x={x}
              y={y - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-medium"
              fill="#374151"
            >
              {shortLabels[i]}
            </text>
            <text
              x={x}
              y={y + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-bold"
              fill={color}
            >
              {s.totalAttempts > 0 ? `${rate}%` : "---"}
            </text>
          </g>
        );
      })}
      {/* Center percentage levels */}
      {[20, 40, 60, 80, 100].map((pct, i) => (
        <text
          key={i}
          x={center + 2}
          y={center - ((i + 1) / levels) * radius + 3}
          className="text-[8px]"
          fill="#9ca3af"
        >
          {pct}
        </text>
      ))}
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error("データの取得に失敗しました");
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 font-medium">{error || "データの取得に失敗しました"}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, stats, weakCategories, allCategoryStats, recentBadges, rank } = data;
  const xpInCurrentLevel = user.xp - getLevelThreshold(user.level);
  const xpNeededForNextLevel = user.xpForNextLevel - getLevelThreshold(user.level);
  const xpPercent = xpNeededForNextLevel > 0 ? Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100) : 100;

  // Overall mastery (avg of categories with attempts)
  const activeCats = allCategoryStats.filter((c) => c.totalAttempts > 0);
  const overallMastery = activeCats.length > 0
    ? Math.round(activeCats.reduce((sum, c) => sum + c.correctRate, 0) / activeCats.length)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user.name} さんのダッシュボード
          </h1>
          <p className="text-gray-500 mt-1">
            今日も頑張りましょう
          </p>
        </div>
        {user.isGraduated && (
          <Badge className="bg-yellow-500 text-white text-sm px-3 py-1">
            卒業済み
          </Badge>
        )}
      </div>

      {/* Level & XP Card */}
      <Card className="bg-gradient-to-r from-orange-600 to-orange-700 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">Lv.{user.level}</span>
              </div>
              <div>
                <p className="text-orange-100 text-sm">現在のレベル</p>
                <p className="text-3xl font-bold">{user.xp.toLocaleString()} XP</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-2 1-3 .5 1.5 1 2 2 3a3 3 0 01-.38 1.62z" />
                </svg>
                <span className="text-xl font-bold text-orange-300">{user.streakDays}日連続</span>
              </div>
              {rank && (
                <p className="text-orange-200 text-sm mt-1">全体ランキング: {rank}位</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-orange-100">
              <span>次のレベルまで</span>
              <span>{xpInCurrentLevel.toLocaleString()} / {xpNeededForNextLevel.toLocaleString()} XP</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-white rounded-full h-3 transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">総回答数</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalAttempts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">正答率</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.correctRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">学習セッション</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.sessionsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">総合理解度</p>
            <p className={cn(
              "text-2xl font-bold mt-1",
              overallMastery >= 70 ? "text-green-600" : overallMastery >= 50 ? "text-yellow-600" : "text-red-600"
            )}>
              {activeCats.length > 0 ? `${overallMastery}%` : "---"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Radar Chart + Weak Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">分野別理解度</CardTitle>
            <p className="text-xs text-gray-500">各分野の正答率をレーダーチャートで表示</p>
          </CardHeader>
          <CardContent>
            {activeCats.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-gray-400 text-sm">問題を解くとチャートが表示されます</p>
              </div>
            ) : (
              <RadarChart stats={allCategoryStats} />
            )}
          </CardContent>
        </Card>

        {/* Weak Categories with Learn buttons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">苦手カテゴリ</CardTitle>
            <p className="text-xs text-gray-500">正答率が低い分野をピックアップ</p>
          </CardHeader>
          <CardContent>
            {weakCategories.length === 0 ? (
              <p className="text-gray-400 text-sm">まだデータがありません</p>
            ) : (
              <div className="space-y-4">
                {weakCategories.map((wc) => (
                  <div key={wc.category} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{categoryIcons[wc.category] || "📚"}</span>
                        <span className="font-medium text-sm text-gray-700">{wc.category}</span>
                      </div>
                      <span className={cn(
                        "font-bold text-sm",
                        wc.correctRate >= 70 ? "text-green-600" : wc.correctRate >= 50 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {wc.correctRate}%
                      </span>
                    </div>
                    <Progress
                      value={wc.correctRate}
                      max={100}
                      className={cn(
                        "h-2 mb-2",
                        wc.correctRate < 50 && "[&>div]:bg-red-500",
                        wc.correctRate >= 50 && wc.correctRate < 70 && "[&>div]:bg-yellow-500"
                      )}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                      onClick={() => router.push(`/learn?category=${encodeURIComponent(wc.category)}`)}
                    >
                      この分野を集中学習する
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Category Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">全分野の学習状況</CardTitle>
          <p className="text-xs text-gray-500">各カテゴリの理解度・回答数・最近のトレンド</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allCategoryStats.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors cursor-pointer"
                onClick={() => router.push(`/learn?category=${encodeURIComponent(cat.category)}`)}
              >
                <span className="text-2xl shrink-0">{categoryIcons[cat.category] || "📚"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{cat.category}</span>
                    {cat.totalAttempts > 0 && cat.recentTrend !== 0 && (
                      <span className={cn(
                        "text-xs font-bold shrink-0",
                        cat.recentTrend > 0 ? "text-green-600" : "text-red-500"
                      )}>
                        {cat.recentTrend > 0 ? "↑" : "↓"}{Math.abs(cat.recentTrend)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={cat.correctRate}
                      max={100}
                      className={cn(
                        "h-2 flex-1",
                        cat.totalAttempts === 0 && "[&>div]:bg-gray-300",
                        cat.totalAttempts > 0 && cat.correctRate < 50 && "[&>div]:bg-red-500",
                        cat.totalAttempts > 0 && cat.correctRate >= 50 && cat.correctRate < 70 && "[&>div]:bg-yellow-500"
                      )}
                    />
                    <span className={cn(
                      "text-xs font-bold w-10 text-right shrink-0",
                      cat.totalAttempts === 0 ? "text-gray-400" :
                      cat.correctRate >= 70 ? "text-green-600" : cat.correctRate >= 50 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {cat.totalAttempts > 0 ? `${cat.correctRate}%` : "---"}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {cat.totalAttempts > 0 ? `${cat.totalAttempts}問回答` : "未学習"}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">最近のバッジ</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBadges.length === 0 ? (
            <p className="text-gray-500 text-sm">まだバッジを獲得していません</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentBadges.map((badge, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-gray-900 truncate">{badge.name}</p>
                    <p className="text-xs text-gray-500 truncate">{badge.description}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(badge.awardedAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">クイックアクション</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              size="lg"
              className="h-14 bg-orange-600 hover:bg-orange-700 text-white text-base"
              onClick={() => router.push("/learn")}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              学習を始める
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 border-orange-600 text-orange-600 hover:bg-orange-50 text-base"
              onClick={() => router.push("/test")}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              テストに挑戦
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 border-yellow-500 text-yellow-600 hover:bg-yellow-50 text-base"
              onClick={() => router.push("/exam")}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              卒業検定
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getLevelThreshold(level: number): number {
  const thresholds: Record<number, number> = {
    1: 0, 2: 100, 3: 250, 4: 500, 5: 800,
    6: 1200, 7: 1700, 8: 2300, 9: 3000, 10: 3800,
    11: 4800, 12: 6000, 13: 7500, 14: 9200, 15: 11200,
    16: 13500, 17: 16000, 18: 19000, 19: 22500, 20: 26500,
  };
  return thresholds[level] ?? 0;
}
