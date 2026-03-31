"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  earned: boolean;
  awardedAt?: string;
}

// Badge emoji, rarity & difficulty (lower = easier to get)
const badgeMeta: Record<string, { emoji: string; rarity: "bronze" | "silver" | "gold" | "legend"; diff: number }> = {
  // スタート系
  "はじめの一歩":       { emoji: "👣", rarity: "bronze", diff: 1 },
  "正解デビュー":       { emoji: "✅", rarity: "bronze", diff: 2 },
  "スリーコンボ":       { emoji: "🎯", rarity: "bronze", diff: 3 },
  "初心者マーク":       { emoji: "🔰", rarity: "bronze", diff: 5 },
  "三日坊主を超えた":    { emoji: "📅", rarity: "bronze", diff: 6 },
  "学習習慣の芽生え":    { emoji: "🌱", rarity: "bronze", diff: 8 },
  "好奇心旺盛":        { emoji: "🔭", rarity: "bronze", diff: 9 },
  "レベル3 見習い":     { emoji: "🐣", rarity: "bronze", diff: 10 },
  "努力の証":          { emoji: "💪", rarity: "bronze", diff: 12 },
  "XPハンター":        { emoji: "💰", rarity: "bronze", diff: 14 },
  // シルバー
  "ファイブスター":      { emoji: "🌟", rarity: "silver", diff: 15 },
  "学習の星":          { emoji: "⭐", rarity: "silver", diff: 18 },
  "満点デビュー":       { emoji: "💯", rarity: "silver", diff: 19 },
  "レベル5 中堅":      { emoji: "🐤", rarity: "silver", diff: 20 },
  "全方位学習":        { emoji: "🧭", rarity: "silver", diff: 21 },
  "鉄人ストリーク":     { emoji: "🦾", rarity: "silver", diff: 22 },
  "挑戦者魂":          { emoji: "🔥", rarity: "silver", diff: 23 },
  "卒検チャレンジャー":  { emoji: "📝", rarity: "silver", diff: 24 },
  "経験値マニア":       { emoji: "💎", rarity: "silver", diff: 25 },
  "選択の達人":        { emoji: "🎮", rarity: "silver", diff: 26 },
  "ケース攻略者":       { emoji: "🛡️", rarity: "silver", diff: 27 },
  "建築の基本を修めし者": { emoji: "🏗️", rarity: "silver", diff: 28 },
  "法律の番人":        { emoji: "📜", rarity: "silver", diff: 28 },
  "マネープランナー":    { emoji: "💰", rarity: "silver", diff: 28 },
  "土地鑑定士の卵":     { emoji: "🗺️", rarity: "silver", diff: 28 },
  "間取りの達人":       { emoji: "📐", rarity: "silver", diff: 28 },
  "構造マニア":        { emoji: "🔩", rarity: "silver", diff: 28 },
  "設備オタク":        { emoji: "⚙️", rarity: "silver", diff: 28 },
  "契約のプロ":        { emoji: "📝", rarity: "silver", diff: 28 },
  "税金マスター":       { emoji: "🏦", rarity: "silver", diff: 28 },
  "トップセールス":     { emoji: "🤝", rarity: "silver", diff: 28 },
  "筆記王":           { emoji: "✍️", rarity: "silver", diff: 30 },
  // ゴールド
  "連続王":           { emoji: "👑", rarity: "gold", diff: 35 },
  "パーフェクトゲーム":  { emoji: "🏆", rarity: "gold", diff: 36 },
  "知識の達人":        { emoji: "🎓", rarity: "gold", diff: 37 },
  "レベル10 エキスパート": { emoji: "🦅", rarity: "gold", diff: 38 },
  "二週間の壁突破":     { emoji: "🧱", rarity: "gold", diff: 39 },
  "万XPの壁突破":      { emoji: "🏔️", rarity: "gold", diff: 40 },
  "修行僧":           { emoji: "🧘", rarity: "gold", diff: 41 },
  "即答マシーン":       { emoji: "⏱️", rarity: "gold", diff: 42 },
  "卒業生":           { emoji: "🎓", rarity: "gold", diff: 43 },
  "無双モード":        { emoji: "⚡", rarity: "gold", diff: 44 },
  "ケーススタディの鬼":  { emoji: "👹", rarity: "gold", diff: 45 },
  "定義ハンター":       { emoji: "🔍", rarity: "gold", diff: 45 },
  "並べ替えマスター":    { emoji: "🔢", rarity: "gold", diff: 45 },
  "再挑戦の勇者":       { emoji: "🗡️", rarity: "gold", diff: 46 },
  "オールラウンダー":    { emoji: "🌍", rarity: "gold", diff: 48 },
  "月間マラソン":       { emoji: "🏃", rarity: "gold", diff: 50 },
  "レベル15 マスター":  { emoji: "🐉", rarity: "gold", diff: 52 },
  // レジェンド
  "千本ノック達成":     { emoji: "⚾", rarity: "legend", diff: 60 },
  "住宅博士":          { emoji: "🏠", rarity: "legend", diff: 65 },
  "完全無欠":          { emoji: "💎", rarity: "legend", diff: 68 },
  "電光石火":          { emoji: "⚡", rarity: "legend", diff: 70 },
  "XPリッチ":          { emoji: "🤑", rarity: "legend", diff: 72 },
  "90日チャレンジ制覇":  { emoji: "🗻", rarity: "legend", diff: 75 },
  "レベル20 グランドマスター": { emoji: "🌈", rarity: "legend", diff: 80 },
  "常勝将軍":          { emoji: "🏯", rarity: "legend", diff: 82 },
  "住宅のスペシャリスト": { emoji: "🏛️", rarity: "legend", diff: 85 },
  "伝説の営業マン":     { emoji: "👑", rarity: "legend", diff: 99 },
  // 旧名互換
  "定義マスター":       { emoji: "🏗️", rarity: "silver", diff: 28 },
  "土地調査ハンター":    { emoji: "🗺️", rarity: "silver", diff: 28 },
  "ローン設計士見習い":  { emoji: "💰", rarity: "silver", diff: 28 },
  "レベル10到達":       { emoji: "🦅", rarity: "gold", diff: 38 },
};

const rarityConfig = {
  bronze: { label: "ブロンズ", bg: "bg-orange-50", border: "border-orange-200", ring: "ring-orange-300", text: "text-orange-700", glow: "" },
  silver: { label: "シルバー", bg: "bg-slate-50", border: "border-slate-300", ring: "ring-slate-400", text: "text-slate-700", glow: "" },
  gold: { label: "ゴールド", bg: "bg-yellow-50", border: "border-yellow-300", ring: "ring-yellow-400", text: "text-yellow-700", glow: "shadow-yellow-200/50 shadow-lg" },
  legend: { label: "レジェンド", bg: "bg-purple-50", border: "border-purple-300", ring: "ring-purple-400", text: "text-purple-700", glow: "shadow-purple-300/50 shadow-xl" },
};

type FilterType = "all" | "earned" | "bronze" | "silver" | "gold" | "legend";

export default function BadgesPage() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch("/api/badges");
        if (!res.ok) throw new Error("バッジの取得に失敗しました");
        const data = await res.json();
        setBadges(data.badges);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    }
    fetchBadges();
  }, []);

  const earnedCount = badges.filter((b) => b.earned).length;

  const getRarity = (name: string) => badgeMeta[name]?.rarity || "bronze";
  const getEmoji = (name: string) => badgeMeta[name]?.emoji || "🏅";

  const rarityOrder = { legend: 0, gold: 1, silver: 2, bronze: 3 };

  const filteredBadges = badges
    .filter((b) => {
      if (filter === "all") return true;
      if (filter === "earned") return b.earned;
      return getRarity(b.name) === filter;
    })
    .sort((a, b) => {
      // Earned first, then by difficulty (easiest first)
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      const diffA = badgeMeta[a.name]?.diff ?? 50;
      const diffB = badgeMeta[b.name]?.diff ?? 50;
      return diffA - diffB;
    });

  // Count by rarity
  const rarityCounts = {
    bronze: { total: 0, earned: 0 },
    silver: { total: 0, earned: 0 },
    gold: { total: 0, earned: 0 },
    legend: { total: 0, earned: 0 },
  };
  for (const b of badges) {
    const r = getRarity(b.name);
    rarityCounts[r].total++;
    if (b.earned) rarityCounts[r].earned++;
  }

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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">バッジコレクション</h1>
        <span className="text-sm text-gray-500">
          {earnedCount} / {badges.length} 獲得済み
        </span>
      </div>

      {/* Summary header with rarity breakdown */}
      <Card className="bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-yellow-100 text-sm">コレクション進捗</p>
              <p className="text-3xl font-bold mt-1">{earnedCount} / {badges.length}</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-3xl">🏆</span>
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 mb-4">
            <div
              className="bg-white rounded-full h-3 transition-all duration-500"
              style={{ width: `${badges.length > 0 ? (earnedCount / badges.length) * 100 : 0}%` }}
            />
          </div>
          {/* Rarity breakdown */}
          <div className="grid grid-cols-4 gap-2">
            {(["bronze", "silver", "gold", "legend"] as const).map((r) => (
              <div key={r} className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-xs text-white/70">{rarityConfig[r].label}</p>
                <p className="text-sm font-bold">{rarityCounts[r].earned}/{rarityCounts[r].total}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all" as FilterType, label: "すべて", count: badges.length },
          { key: "earned" as FilterType, label: "獲得済み", count: earnedCount },
          { key: "legend" as FilterType, label: "🟣 レジェンド", count: rarityCounts.legend.total },
          { key: "gold" as FilterType, label: "🟡 ゴールド", count: rarityCounts.gold.total },
          { key: "silver" as FilterType, label: "⚪ シルバー", count: rarityCounts.silver.total },
          { key: "bronze" as FilterType, label: "🟤 ブロンズ", count: rarityCounts.bronze.total },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              filter === tab.key
                ? "bg-orange-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Badges grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredBadges.map((badge) => {
          const rarity = getRarity(badge.name);
          const config = rarityConfig[rarity];
          const emoji = getEmoji(badge.name);

          return (
            <Card
              key={badge.id}
              className={cn(
                "transition-all duration-300 overflow-hidden",
                badge.earned
                  ? `${config.border} border-2 hover:shadow-lg ${config.glow}`
                  : "border-gray-200 opacity-50 grayscale hover:opacity-70 hover:grayscale-0"
              )}
            >
              <CardContent className="p-4 text-center relative">
                {/* Rarity indicator */}
                {badge.earned && (
                  <div className={cn(
                    "absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold",
                    rarity === "legend" ? "bg-purple-100 text-purple-700" :
                    rarity === "gold" ? "bg-yellow-100 text-yellow-700" :
                    rarity === "silver" ? "bg-slate-100 text-slate-600" :
                    "bg-orange-100 text-orange-600"
                  )}>
                    {config.label}
                  </div>
                )}

                {/* Emoji icon */}
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3",
                  badge.earned ? config.bg : "bg-gray-100"
                )}>
                  <span className="text-2xl">{badge.earned ? emoji : "🔒"}</span>
                </div>

                {/* Name */}
                <h3 className={cn(
                  "font-bold text-sm leading-tight",
                  badge.earned ? "text-gray-900" : "text-gray-400"
                )}>
                  {badge.name}
                </h3>

                {/* Description */}
                <p className={cn(
                  "text-xs mt-1 leading-relaxed",
                  badge.earned ? "text-gray-600" : "text-gray-400"
                )}>
                  {badge.description}
                </p>

                {/* Date or locked */}
                {badge.earned && badge.awardedAt ? (
                  <p className="text-[10px] text-gray-400 mt-2">
                    {new Date(badge.awardedAt).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}に獲得
                  </p>
                ) : !badge.earned ? (
                  <p className="text-[10px] text-gray-400 mt-2">未獲得</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredBadges.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <span className="text-3xl block mb-2">🔍</span>
            <p className="text-gray-500">条件に一致するバッジがありません</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
