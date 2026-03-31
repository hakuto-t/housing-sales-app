"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Question {
  id: string;
  type: "MCQ" | "FREE_TEXT" | "CASE_MULTI" | "DEFINITION_FIX" | "ORDERING";
  category: string;
  difficulty: number;
  text: string;
  options: { id: string; text: string; position: number }[];
  incorrectDefinition?: string;
}

interface ExamEligibility {
  canTake: boolean;
  reason?: string;
  cooldownUntil?: string;
  lastAttempt?: string;
}

interface ExamStartData {
  examId: string;
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: Question | null;
}

interface ExamResult {
  passed: boolean;
  totalScore: number;
  categoryScores: { category: string; score: number; passed: boolean }[];
  weakCategories: string[];
  remedialQuestionIds?: string[];
}

type ExamPhase = "checking" | "eligible" | "cooldown" | "active" | "submitting_all" | "results";

const TOTAL_QUESTIONS = 120;

export default function ExamPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<ExamPhase>("checking");
  const [eligibility, setEligibility] = useState<ExamEligibility | null>(null);
  const [error, setError] = useState("");

  // Exam state
  const [examId, setExamId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  // Current answer state
  const [selectedOption, setSelectedOption] = useState("");
  const [freeTextAnswer, setFreeTextAnswer] = useState("");
  const [orderingItems, setOrderingItems] = useState<{ id: string; text: string }[]>([]);

  // Results
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  // Cooldown timer
  const [cooldownLeft, setCooldownLeft] = useState("");

  const currentQuestion = questions[currentIndex];

  // Check eligibility
  useEffect(() => {
    async function checkEligibility() {
      try {
        const res = await fetch("/api/exam");
        if (!res.ok) throw new Error("確認に失敗しました");
        const data: ExamEligibility = await res.json();
        setEligibility(data);
        if (data.canTake) {
          setPhase("eligible");
        } else {
          setPhase("cooldown");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
        setPhase("eligible");
      }
    }
    checkEligibility();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (phase !== "cooldown" || !eligibility?.cooldownUntil) return;
    const updateCooldown = () => {
      const now = new Date().getTime();
      const until = new Date(eligibility.cooldownUntil!).getTime();
      const diff = until - now;
      if (diff <= 0) {
        setCooldownLeft("");
        setPhase("eligible");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCooldownLeft(`${hours}時間 ${minutes}分 ${seconds}秒`);
    };
    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [phase, eligibility]);

  const startExam = async () => {
    setError("");
    try {
      const res = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "試験開始に失敗しました");
      }
      const data: ExamStartData = await res.json();
      setExamId(data.examId);

      // For exam, we fetch questions one at a time via the start response
      // The API returns currentQuestion, so we collect them as we go
      if (data.currentQuestion) {
        setQuestions([data.currentQuestion]);
        setCurrentIndex(0);
      }
      setPhase("active");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  useEffect(() => {
    if (phase === "active" && currentQuestion) {
      setSelectedOption("");
      setFreeTextAnswer("");
      if (currentQuestion.type === "ORDERING" && currentQuestion.options.length > 0) {
        const shuffled = [...currentQuestion.options].sort(() => Math.random() - 0.5);
        setOrderingItems(shuffled);
      }
    }
  }, [phase, currentIndex, currentQuestion]);

  const buildAnswer = () => {
    if (!currentQuestion) return null;
    switch (currentQuestion.type) {
      case "MCQ":
        return { optionId: selectedOption };
      case "FREE_TEXT":
      case "CASE_MULTI":
        return { text: freeTextAnswer };
      case "DEFINITION_FIX":
        return { text: freeTextAnswer };
      case "ORDERING":
        return { order: orderingItems.map((item) => item.id) };
      default:
        return null;
    }
  };

  const canSubmit = () => {
    if (!currentQuestion) return false;
    switch (currentQuestion.type) {
      case "MCQ":
        return selectedOption !== "";
      case "FREE_TEXT":
      case "CASE_MULTI":
      case "DEFINITION_FIX":
        return freeTextAnswer.trim() !== "";
      case "ORDERING":
        return orderingItems.length > 0;
      default:
        return false;
    }
  };

  const submitAndNext = async () => {
    if (!canSubmit()) return;
    setError("");

    // Submit current answer to exam API
    try {
      const answer = buildAnswer();
      const res = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          examId,
          questionId: currentQuestion.id,
          answer,
          score: 0, // Server will calculate
        }),
      });
      if (!res.ok) throw new Error("回答の送信に失敗しました");
      const data = await res.json();

      const answeredCount = data.answeredCount || currentIndex + 1;

      if (answeredCount >= TOTAL_QUESTIONS) {
        // Complete exam
        completeExam();
      } else {
        // Get next question by re-starting (the API should track position)
        const nextRes = await fetch("/api/exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
        if (!nextRes.ok) throw new Error("次の問題の取得に失敗しました");
        const nextData: ExamStartData = await nextRes.json();
        if (nextData.currentQuestion) {
          setQuestions((prev) => [...prev, nextData.currentQuestion!]);
          setCurrentIndex((i) => i + 1);
        } else {
          completeExam();
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  const completeExam = async () => {
    setPhase("submitting_all");
    try {
      const res = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", examId }),
      });
      if (!res.ok) throw new Error("試験完了処理に失敗しました");
      const data: ExamResult = await res.json();
      setExamResult(data);
      setPhase("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setPhase("active");
    }
  };

  const moveOrderItem = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= orderingItems.length) return;
    const newItems = [...orderingItems];
    const temp = newItems[fromIndex];
    newItems[fromIndex] = newItems[toIndex];
    newItems[toIndex] = temp;
    setOrderingItems(newItems);
  };

  // Checking eligibility
  if (phase === "checking") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">受験資格を確認中...</p>
        </div>
      </div>
    );
  }

  // Cooldown
  if (phase === "cooldown") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">卒業検定</h1>
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">クールダウン中</h2>
              <p className="text-gray-500 mt-2">
                {eligibility?.reason || "次の受験まで待つ必要があります。"}
              </p>
            </div>
            {cooldownLeft && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">次に受験可能になるまで</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{cooldownLeft}</p>
              </div>
            )}
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              ダッシュボードへ戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Eligible - start screen
  if (phase === "eligible") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">卒業検定</h1>
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">卒業検定に挑戦</h2>
              <p className="text-gray-500 mt-2">
                全{TOTAL_QUESTIONS}問の検定試験です。<br />
                全カテゴリで90%以上の正答率が求められます。<br />
                合格すると「卒業」ステータスが付与されます。
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-yellow-800">注意事項:</p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                <li>一度開始すると途中終了できません</li>
                <li>不合格の場合、24時間のクールダウンがあります</li>
                <li>全カテゴリで90点以上が合格条件です</li>
              </ul>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button
              size="lg"
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-8"
              onClick={startExam}
            >
              検定を開始する
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitting all answers
  if (phase === "submitting_all") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">採点中...</p>
          <p className="mt-2 text-xs text-gray-400">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  // Results
  if (phase === "results" && examResult) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">卒業検定結果</h1>
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8 space-y-6">
            {/* Pass/Fail banner */}
            <div className={cn(
              "text-center p-6 rounded-lg",
              examResult.passed ? "bg-green-50 border-2 border-green-300" : "bg-red-50 border-2 border-red-300"
            )}>
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
                examResult.passed ? "bg-green-100" : "bg-red-100"
              )}>
                {examResult.passed ? (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <h2 className={cn(
                "text-2xl font-bold",
                examResult.passed ? "text-green-700" : "text-red-700"
              )}>
                {examResult.passed ? "合格おめでとうございます!" : "不合格"}
              </h2>
              <p className="text-4xl font-bold mt-2">
                {examResult.totalScore}点
              </p>
            </div>

            {/* Category scores */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3">カテゴリ別スコア</h3>
              <div className="space-y-3">
                {examResult.categoryScores.map((cs) => (
                  <div key={cs.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{cs.category}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-semibold",
                          cs.passed ? "text-green-600" : "text-red-600"
                        )}>
                          {cs.score}点
                        </span>
                        {cs.passed ? (
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <Progress
                      value={cs.score}
                      max={100}
                      className={cn(
                        "h-2",
                        !cs.passed && "[&>div]:bg-red-500"
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Weak categories / Remedial */}
            {!examResult.passed && examResult.weakCategories.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-bold text-yellow-800 mb-2">改善が必要なカテゴリ</h3>
                <ul className="space-y-1">
                  {examResult.weakCategories.map((cat) => (
                    <li key={cat} className="text-sm text-yellow-700 flex items-center gap-2">
                      <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {cat} - 集中的に学習することをおすすめします
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white"
                  onClick={() => router.push("/learn")}
                >
                  苦手分野を学習する
                </Button>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                ダッシュボードへ
              </Button>
              {examResult.passed && (
                <Button
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  onClick={() => router.push("/badges")}
                >
                  バッジを確認する
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active exam question
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">卒業検定</h1>
        <Badge variant="secondary" className="text-sm font-mono">
          {currentIndex + 1} / {TOTAL_QUESTIONS}
        </Badge>
      </div>

      <Progress value={currentIndex + 1} max={TOTAL_QUESTIONS} className="h-3" />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {currentQuestion && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">{currentQuestion.category}</Badge>
              <Badge variant="secondary" className="text-xs">
                難易度 {"★".repeat(currentQuestion.difficulty)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {questionTypeLabel(currentQuestion.type)}
              </Badge>
            </div>
            <CardTitle className="text-lg leading-relaxed">{currentQuestion.text}</CardTitle>
            {currentQuestion.type === "DEFINITION_FIX" && currentQuestion.incorrectDefinition && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700">以下の定義の誤りを修正してください:</p>
                <p className="text-sm text-red-800 mt-1">{currentQuestion.incorrectDefinition}</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* MCQ Options */}
            {currentQuestion.type === "MCQ" && (
              <div className="space-y-3">
                {currentQuestion.options
                  .sort((a, b) => a.position - b.position)
                  .map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedOption(opt.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-lg border-2 transition-all",
                        selectedOption === opt.id
                          ? "border-yellow-600 bg-yellow-50 ring-1 ring-yellow-600"
                          : "border-gray-200 hover:border-yellow-300 hover:bg-yellow-50"
                      )}
                    >
                      <span className="text-sm">{opt.text}</span>
                    </button>
                  ))}
              </div>
            )}

            {/* Free Text */}
            {(currentQuestion.type === "FREE_TEXT" ||
              currentQuestion.type === "CASE_MULTI" ||
              currentQuestion.type === "DEFINITION_FIX") && (
              <Textarea
                value={freeTextAnswer}
                onChange={(e) => setFreeTextAnswer(e.target.value)}
                placeholder={
                  currentQuestion.type === "DEFINITION_FIX"
                    ? "正しい定義を入力してください..."
                    : "回答を入力してください..."
                }
                rows={5}
                className="resize-none"
              />
            )}

            {/* Ordering */}
            {currentQuestion.type === "ORDERING" && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-3">正しい順序に並べ替えてください:</p>
                {orderingItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-white"
                  >
                    <span className="w-8 h-8 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm">{item.text}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveOrderItem(index, "up")}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveOrderItem(index, "down")}
                        disabled={index === orderingItems.length - 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-8"
                disabled={!canSubmit()}
                onClick={submitAndNext}
              >
                {currentIndex + 1 >= TOTAL_QUESTIONS ? "検定を終了する" : "次の問題へ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function questionTypeLabel(type: string): string {
  switch (type) {
    case "MCQ": return "選択問題";
    case "FREE_TEXT": return "記述問題";
    case "CASE_MULTI": return "ケース問題";
    case "DEFINITION_FIX": return "定義修正";
    case "ORDERING": return "並べ替え";
    default: return type;
  }
}
