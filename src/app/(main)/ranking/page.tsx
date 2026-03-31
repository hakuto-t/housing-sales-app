"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RankingEntry {
  rank: number;
  name: string;
  xp: number;
  level: number;
  isGraduated: boolean;
  isMe: boolean;
}

interface RankingData {
  type: "alltime" | "monthly";
  month?: string;
  rankings: RankingEntry[];
}

export default function RankingPage() {
  const [tab, setTab] = useState("alltime");
  const [allTimeData, setAllTimeData] = useState<RankingData | null>(null);
  const [monthlyData, setMonthlyData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetchAllTime();
  }, []);

  useEffect(() => {
    if (tab === "monthly") {
      fetchMonthly(selectedMonth);
    }
  }, [tab, selectedMonth]);

  const fetchAllTime = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ranking?type=alltime");
      if (!res.ok) throw new Error("ランキングの取得に失敗しました");
      const data: RankingData = await res.json();
      setAllTimeData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthly = async (month: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/ranking?type=monthly&month=${month}`);
      if (!res.ok) throw new Error("ランキングの取得に失敗しました");
      const data: RankingData = await res.json();
      setMonthlyData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const getMonthOptions = () => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months;
  };

  const formatMonth = (yyyymm: string) => {
    const [year, month] = yyyymm.split("-");
    return `${year}年${parseInt(month)}月`;
  };

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">{rank}</span>;
  };

  const renderTable = (rankings: RankingEntry[]) => {
    if (rankings.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          ランキングデータがありません
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-16">順位</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">名前</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 w-24">XP</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 w-20">レベル</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-20">卒業</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((entry) => (
              <tr
                key={`${entry.rank}-${entry.name}`}
                className={cn(
                  "border-b border-gray-100 transition-colors",
                  entry.isMe
                    ? "bg-orange-50 hover:bg-orange-100"
                    : entry.rank % 2 === 0
                      ? "bg-gray-50/50 hover:bg-gray-100"
                      : "hover:bg-gray-50"
                )}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center">
                    {rankBadge(entry.rank)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium",
                      entry.isMe ? "text-orange-700 font-bold" : "text-gray-900"
                    )}>
                      {entry.name}
                    </span>
                    {entry.isMe && (
                      <Badge className="bg-orange-600 text-white text-xs">自分</Badge>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {entry.xp.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-gray-700">Lv.{entry.level}</span>
                </td>
                <td className="py-3 px-4 text-center">
                  {entry.isGraduated && (
                    <Badge className="bg-yellow-500 text-white text-xs">卒業</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ランキング</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full max-w-xs">
          <TabsTrigger value="alltime" className="flex-1">累計</TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1">月間</TabsTrigger>
        </TabsList>

        <TabsContent value="alltime">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">累計ランキング</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && !allTimeData ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : allTimeData ? (
                renderTable(allTimeData.rankings)
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="mt-4 space-y-4">
            {/* Month selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">対象月:</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {getMonthOptions().map((month) => (
                  <Button
                    key={month}
                    variant={selectedMonth === month ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "shrink-0",
                      selectedMonth === month && "bg-orange-600 hover:bg-orange-700"
                    )}
                    onClick={() => setSelectedMonth(month)}
                  >
                    {formatMonth(month)}
                  </Button>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {formatMonth(selectedMonth)}のランキング
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading && !monthlyData ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : monthlyData ? (
                  renderTable(monthlyData.rankings)
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
