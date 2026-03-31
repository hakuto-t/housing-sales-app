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
  orderingItems?: { id: string; text: string }[];
  incorrectDefinition?: string;
}

interface SubmitResult {
  submissionId: string;
  isCorrect: boolean;
  score: number;
  verdict: string;
  xpAwarded: number;
  comboCount: number;
  judgmentReason: string;
  explanation: string;
  correctAnswer?: string;
  correctOrder?: string[];
  modelAnswer?: string;
  newBadges: { name: string; description: string }[];
  // Detailed feedback for free-text
  missingPoints?: string[];
  misconception?: string[];
  aiModelAnswer?: string;
  mustInclude?: string[];
  relatedTerms?: string[];
}

type SessionPhase = "idle" | "loading" | "active" | "feedback" | "summary";

const TIME_LIMIT_SEC = 60;

export default function TestPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");

  // Answer state
  const [selectedOption, setSelectedOption] = useState("");
  const [freeTextAnswer, setFreeTextAnswer] = useState("");
  const [orderingItems, setOrderingItems] = useState<{ id: string; text: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Drag & drop state for ordering
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentIndex = useRef<number | null>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session stats
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  // Glossary popup state
  const [glossaryTerm, setGlossaryTerm] = useState<{
    term: string; definition: string; relatedDiff?: string;
    usageExample?: string; category: string; difficulty: number;
  } | null>(null);
  const [glossaryLoading, setGlossaryLoading] = useState(false);

  const openGlossary = async (termName: string) => {
    setGlossaryLoading(true);
    setGlossaryTerm(null);
    try {
      const res = await fetch(`/api/glossary?search=${encodeURIComponent(termName)}`);
      if (res.ok) {
        const data = await res.json();
        const match = data.terms?.find((t: { term: string }) => t.term === termName)
          || data.terms?.[0];
        if (match) {
          setGlossaryTerm(match);
        } else {
          setGlossaryTerm({ term: termName, definition: "この用語はまだ用語集に登録されていません。", category: "", difficulty: 0 });
        }
      }
    } catch {
      setGlossaryTerm({ term: termName, definition: "用語の取得に失敗しました。", category: "", difficulty: 0 });
    } finally {
      setGlossaryLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];

  const submitAnswerRef = useRef<() => void>(() => {});

  const buildAnswer = useCallback(() => {
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
  }, [currentQuestion, selectedOption, freeTextAnswer, orderingItems]);

  const submitAnswer = useCallback(async () => {
    if (submitting || phase !== "active") return;
    setSubmitting(true);
    setError("");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const timeSpentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          answer: buildAnswer(),
          timeSpentSec,
        }),
      });
      if (!res.ok) throw new Error("回答の送信に失敗しました");
      const data: SubmitResult = await res.json();
      setResult(data);
      if (data.isCorrect) setTotalCorrect((c) => c + 1);
      setTotalXp((x) => x + data.xpAwarded);
      setTotalScore((s) => s + data.score);
      setCurrentCombo(data.comboCount);
      if (data.comboCount > maxCombo) setMaxCombo(data.comboCount);
      setPhase("feedback");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, phase, sessionId, currentQuestion, buildAnswer, maxCombo]);

  submitAnswerRef.current = submitAnswer;

  // Timer effect
  useEffect(() => {
    if (phase === "active") {
      setTimeLeft(TIME_LIMIT_SEC);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Auto-submit on timeout
            submitAnswerRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, currentIndex]);

  const startSession = async () => {
    setPhase("loading");
    setError("");
    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 20 }),
      });
      if (!res.ok) throw new Error("テスト開始に失敗しました");
      const data = await res.json();
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setTotalCorrect(0);
      setTotalXp(0);
      setMaxCombo(0);
      setCurrentCombo(0);
      setTotalScore(0);
      setPhase("active");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setPhase("idle");
    }
  };

  useEffect(() => {
    if (phase === "active" && currentQuestion) {
      setSelectedOption("");
      setFreeTextAnswer("");
      setResult(null);
      if (currentQuestion.type === "ORDERING" && currentQuestion.orderingItems && currentQuestion.orderingItems.length > 0) {
        setOrderingItems([...currentQuestion.orderingItems]);
      }
    }
  }, [phase, currentIndex, currentQuestion]);

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

  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length) {
      setPhase("summary");
    } else {
      setCurrentIndex((i) => i + 1);
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

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const newItems = [...orderingItems];
      const [moved] = newItems.splice(dragIndex, 1);
      newItems.splice(dragOverIndex, 0, moved);
      setOrderingItems(newItems);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };
  // Touch drag support
  const orderListRef = useRef<HTMLDivElement>(null);
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentIndex.current = index;
    setDragIndex(index);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchCurrentIndex.current === null || !orderListRef.current) return;
    const touch = e.touches[0];
    const items = orderListRef.current.querySelectorAll("[data-order-item]");
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        setDragOverIndex(i);
        break;
      }
    }
  };
  const handleTouchEnd = () => {
    handleDragEnd();
    touchCurrentIndex.current = null;
  };

  const timerColor = timeLeft <= 10 ? "text-red-600" : timeLeft <= 30 ? "text-yellow-600" : "text-gray-700";

  // Idle screen
  if (phase === "idle") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">テストモード</h1>
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">テストに挑戦</h2>
              <p className="text-gray-500 mt-2">
                20問のテストに挑戦します。<br />
                1問あたり{TIME_LIMIT_SEC}秒の制限時間があります。<br />
                コンボを繋げてハイスコアを目指しましょう!
              </p>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button
              size="lg"
              className="bg-orange-600 hover:bg-orange-700 text-white px-8"
              onClick={startSession}
            >
              テスト開始
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">テストを準備中...</p>
        </div>
      </div>
    );
  }

  // Summary screen
  if (phase === "summary") {
    const avgScore = questions.length > 0 ? Math.round(totalScore / questions.length) : 0;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">テスト結果</h1>
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center space-y-6">
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto",
              avgScore >= 80 ? "bg-green-100" : avgScore >= 60 ? "bg-yellow-100" : "bg-red-100"
            )}>
              <span className={cn(
                "text-3xl font-bold",
                avgScore >= 80 ? "text-green-600" : avgScore >= 60 ? "text-yellow-600" : "text-red-600"
              )}>
                {avgScore}点
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {avgScore >= 80 ? "素晴らしい!" : avgScore >= 60 ? "いい調子です!" : "もう少し頑張りましょう"}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">正解数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalCorrect} / {questions.length}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">獲得XP</p>
                <p className="text-2xl font-bold text-orange-600">+{totalXp}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">正答率</p>
                <p className="text-2xl font-bold text-gray-900">
                  {questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0}%
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">最大コンボ</p>
                <p className="text-2xl font-bold text-orange-500">{maxCombo}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => { setPhase("idle"); setError(""); }}
              >
                もう一度挑戦する
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                ダッシュボードへ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active / Feedback
  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">テストモード</h1>
        <div className="flex items-center gap-4">
          {currentCombo > 0 && (
            <Badge className="bg-orange-500 text-white text-sm animate-pulse">
              {currentCombo}コンボ
            </Badge>
          )}
          <Badge variant="secondary" className="text-sm">
            {currentIndex + 1} / {questions.length}
          </Badge>
        </div>
      </div>

      {/* Timer & Progress */}
      <div className="flex items-center gap-4">
        <Progress value={currentIndex + 1} max={questions.length} className="flex-1 h-2" />
        {phase === "active" && (
          <div className={cn("flex items-center gap-1 font-mono font-bold text-lg tabular-nums min-w-[60px] justify-end", timerColor)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Timer bar */}
      {phase === "active" && (
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all duration-1000",
              timeLeft <= 10 ? "bg-red-500" : timeLeft <= 30 ? "bg-yellow-500" : "bg-orange-500"
            )}
            style={{ width: `${(timeLeft / TIME_LIMIT_SEC) * 100}%` }}
          />
        </div>
      )}

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
                  .map((opt) => {
                    const isSelected = selectedOption === opt.id;
                    const disabled = phase === "feedback";
                    let optionStyle = "border-gray-200 hover:border-orange-300 hover:bg-orange-50";
                    if (isSelected && phase === "active") {
                      optionStyle = "border-orange-600 bg-orange-50 ring-1 ring-orange-600";
                    }
                    if (phase === "feedback" && result) {
                      if (opt.text === result.correctAnswer) {
                        optionStyle = "border-green-500 bg-green-50";
                      } else if (isSelected && !result.isCorrect) {
                        optionStyle = "border-red-500 bg-red-50";
                      }
                    }
                    return (
                      <button
                        key={opt.id}
                        disabled={disabled}
                        onClick={() => setSelectedOption(opt.id)}
                        className={cn(
                          "w-full text-left p-4 rounded-lg border-2 transition-all",
                          optionStyle,
                          disabled && "cursor-default"
                        )}
                      >
                        <span className="text-sm">{opt.text}</span>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Free Text / Case Multi / Definition Fix */}
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
                disabled={phase === "feedback"}
                className="resize-none"
              />
            )}

            {/* Ordering - Drag & Drop */}
            {currentQuestion.type === "ORDERING" && (
              <div className="space-y-1" ref={orderListRef}>
                <p className="text-sm text-gray-500 mb-3">
                  ドラッグして正しい順序に並べ替えてください:
                </p>
                {orderingItems.map((item, index) => (
                  <div
                    key={item.id}
                    data-order-item
                    draggable={phase === "active"}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(index, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 transition-all select-none",
                      phase === "feedback"
                        ? "bg-gray-50 border-gray-200"
                        : dragIndex === index
                          ? "bg-orange-50 border-orange-400 shadow-lg scale-[1.02] opacity-90"
                          : dragOverIndex === index && dragIndex !== null
                            ? "border-orange-300 bg-orange-50/50 border-dashed"
                            : "bg-white border-gray-200 hover:border-orange-200 hover:shadow-sm",
                      phase === "active" && "cursor-grab active:cursor-grabbing"
                    )}
                  >
                    {/* Drag handle */}
                    {phase === "active" && (
                      <div className="text-gray-400 shrink-0 touch-none">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="6" r="1.5" />
                          <circle cx="15" cy="6" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" />
                          <circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="18" r="1.5" />
                          <circle cx="15" cy="18" r="1.5" />
                        </svg>
                      </div>
                    )}
                    <span className="w-8 h-8 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium">{item.text}</span>
                    {phase === "active" && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveOrderItem(index, "up"); }}
                          disabled={index === 0}
                          className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveOrderItem(index, "down"); }}
                          disabled={index === orderingItems.length - 1}
                          className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Feedback section */}
            {phase === "feedback" && result && (
              <div className="mt-6 space-y-4">
                {/* Score header */}
                <div className={cn(
                  "p-4 rounded-lg border-2",
                  result.isCorrect
                    ? "bg-green-50 border-green-300"
                    : result.verdict === "PARTIAL"
                      ? "bg-yellow-50 border-yellow-300"
                      : "bg-red-50 border-red-300"
                )}>
                  <div className="flex items-center gap-2">
                    {result.isCorrect ? (
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : result.verdict === "PARTIAL" ? (
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span className={cn(
                      "font-bold text-lg",
                      result.isCorrect ? "text-green-700" : result.verdict === "PARTIAL" ? "text-yellow-700" : "text-red-700"
                    )}>
                      {result.isCorrect ? "正解!" : result.verdict === "PARTIAL" ? "部分正解" : "不正解"}
                      {result.score !== undefined && !result.isCorrect && (
                        <span className="text-sm font-normal ml-2">（スコア: {result.score}/100）</span>
                      )}
                    </span>
                    <Badge className="bg-orange-600 text-white ml-auto">+{result.xpAwarded} XP</Badge>
                  </div>
                </div>

                {/* MCQ: correct answer */}
                {result.correctAnswer && !result.isCorrect && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-bold">正解: </span>{result.correctAnswer}
                    </p>
                  </div>
                )}

                {/* ORDERING: correct order */}
                {result.correctOrder && result.correctOrder.length > 0 && !result.isCorrect && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-bold text-blue-800 mb-3">正しい順序:</p>
                    <div className="space-y-2">
                      {result.correctOrder.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-600 text-white text-sm font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm text-blue-900">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing points */}
                {result.missingPoints && result.missingPoints.length > 0 && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm font-bold text-orange-800 mb-2">あなたの回答に不足している点:</p>
                    <ul className="space-y-1">
                      {result.missingPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-orange-700">
                          <span className="mt-0.5 shrink-0">▸</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Misconceptions */}
                {result.misconception && result.misconception.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-bold text-red-800 mb-2">注意すべき誤り:</p>
                    <ul className="space-y-1">
                      {result.misconception.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                          <span className="mt-0.5 shrink-0">✕</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Model answer */}
                {(result.modelAnswer || result.aiModelAnswer) && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-bold text-green-800 mb-2">模範解答:</p>
                    <p className="text-sm text-green-700 leading-relaxed">{result.aiModelAnswer || result.modelAnswer}</p>
                  </div>
                )}

                {/* Must-include keywords */}
                {result.mustInclude && result.mustInclude.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-bold text-blue-800 mb-2">この問題で押さえるべきキーワード:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.mustInclude.map((kw, i) => (
                        <span key={i} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explanation */}
                {result.explanation && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm font-bold text-gray-800 mb-2">解説・学習ポイント:</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{result.explanation}</p>
                  </div>
                )}

                {/* Related terms */}
                {result.relatedTerms && result.relatedTerms.length > 0 && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-xs font-bold text-purple-700 mb-1">関連用語（タップで解説を表示）:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.relatedTerms.map((term, i) => (
                        <button
                          key={i}
                          className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 hover:underline transition-colors cursor-pointer"
                          onClick={() => openGlossary(term)}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* New badges */}
                {result.newBadges && result.newBadges.length > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                    <p className="text-sm font-bold text-yellow-700 mb-2">新しいバッジを獲得!</p>
                    {result.newBadges.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 mt-1">
                        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-medium">{b.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-3 mt-4">
              {phase === "active" && (
                <Button
                  className="bg-orange-600 hover:bg-orange-700 text-white px-8"
                  disabled={!canSubmit() || submitting}
                  onClick={submitAnswer}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      送信中...
                    </span>
                  ) : (
                    "回答する"
                  )}
                </Button>
              )}
              {phase === "feedback" && (
                <Button
                  className="bg-orange-600 hover:bg-orange-700 text-white px-8"
                  onClick={nextQuestion}
                >
                  {currentIndex + 1 >= questions.length ? "結果を見る" : "次の問題へ"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Glossary Popup Modal */}
      {(glossaryTerm || glossaryLoading) && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => { setGlossaryTerm(null); setGlossaryLoading(false); }}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {glossaryLoading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="mt-3 text-sm text-gray-500">用語を検索中...</p>
              </div>
            ) : glossaryTerm ? (
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{glossaryTerm.term}</h3>
                    {glossaryTerm.category && (
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{glossaryTerm.category}</Badge>
                        {glossaryTerm.difficulty > 0 && (
                          <Badge className="text-xs bg-orange-100 text-orange-700">
                            {"★".repeat(glossaryTerm.difficulty)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="p-1 hover:bg-gray-100 rounded-full"
                    onClick={() => setGlossaryTerm(null)}
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{glossaryTerm.definition}</p>
                {glossaryTerm.relatedDiff && (
                  <div className="p-3 bg-gray-50 rounded-lg mb-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">関連用語との違い</p>
                    <p className="text-sm text-gray-700">{glossaryTerm.relatedDiff}</p>
                  </div>
                )}
                {glossaryTerm.usageExample && (
                  <div className="p-3 bg-green-50 rounded-lg mb-2">
                    <p className="text-xs font-medium text-green-700 mb-1">使用例</p>
                    <p className="text-sm text-green-800">{glossaryTerm.usageExample}</p>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 text-xs"
                  onClick={() => setGlossaryTerm(null)}
                >
                  閉じる
                </Button>
              </div>
            ) : null}
          </div>
        </div>
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
