"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SessionSummary {
  session: {
    id: string;
    mode: string;
    totalQuestions: number;
    correctCount: number;
    xpEarned: number;
    comboMax: number;
    startedAt: string;
    endedAt?: string;
  };
  submissions: {
    id: string;
    questionText: string;
    questionType: string;
    category: string;
    isCorrect: boolean;
    score: number;
    verdict: string;
    xpAwarded: number;
    timeSpentSec: number;
  }[];
}

export default function SessionResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [data, setData] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/submit?sessionId=${sessionId}`);
        if (!res.ok) throw new Error("セッション情報の取得に失敗しました");
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    }
    if (sessionId) {
      fetchSession();
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">結果を読み込み中...</p>
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
            <Button className="mt-4" variant="outline" onClick={() => router.push("/dashboard")}>
              ダッシュボードへ戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { session, submissions } = data;
  const correctRate = session.totalQuestions > 0
    ? Math.round((session.correctCount / session.totalQuestions) * 100)
    : 0;

  const modeLabel = (mode: string) => {
    switch (mode) {
      case "LEARN": return "学習モード";
      case "TEST": return "テストモード";
      case "EXAM": return "卒業検定";
      default: return mode;
    }
  };

  const verdictColor = (verdict: string) => {
    switch (verdict) {
      case "CORRECT": return "text-green-600 bg-green-50";
      case "PARTIAL": return "text-yellow-600 bg-yellow-50";
      case "INCORRECT": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const verdictLabel = (verdict: string) => {
    switch (verdict) {
      case "CORRECT": return "正解";
      case "PARTIAL": return "部分正解";
      case "INCORRECT": return "不正解";
      default: return verdict;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">セッション結果</h1>
          <p className="text-sm text-gray-500 mt-1">
            {modeLabel(session.mode)} - {new Date(session.startedAt).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          ダッシュボードへ
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-gray-500">問題数</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{session.totalQuestions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-gray-500">正解数</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {session.correctCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-gray-500">獲得XP</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">+{session.xpEarned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-gray-500">最大コンボ</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{session.comboMax}</p>
          </CardContent>
        </Card>
      </div>

      {/* Correct rate bar */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">正答率</span>
            <span className={cn(
              "text-xl font-bold",
              correctRate >= 80 ? "text-green-600" : correctRate >= 60 ? "text-yellow-600" : "text-red-600"
            )}>
              {correctRate}%
            </span>
          </div>
          <Progress
            value={correctRate}
            max={100}
            className={cn(
              "h-3",
              correctRate < 60 && "[&>div]:bg-red-500",
              correctRate >= 60 && correctRate < 80 && "[&>div]:bg-yellow-500"
            )}
          />
        </CardContent>
      </Card>

      {/* Per-question breakdown */}
      {submissions && submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">問題別結果</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-10">#</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">問題</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-24">カテゴリ</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-20">結果</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 w-16">XP</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 w-16">時間</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub, i) => (
                    <tr
                      key={sub.id}
                      className={cn(
                        "border-b border-gray-100",
                        i % 2 === 1 ? "bg-gray-50/50" : "",
                        "hover:bg-gray-50"
                      )}
                    >
                      <td className="py-3 px-4 text-sm text-gray-500">{i + 1}</td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900 truncate max-w-md">{sub.questionText}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">{sub.category}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          verdictColor(sub.verdict)
                        )}>
                          {verdictLabel(sub.verdict)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-medium text-orange-600">+{sub.xpAwarded}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-gray-500">{sub.timeSpentSec}s</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom actions */}
      <div className="flex justify-center gap-3">
        <Button
          className="bg-orange-600 hover:bg-orange-700 text-white"
          onClick={() => router.push("/learn")}
        >
          学習を続ける
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
        >
          ダッシュボードへ
        </Button>
      </div>
    </div>
  );
}
