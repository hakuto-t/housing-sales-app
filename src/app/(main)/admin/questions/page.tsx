"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QUESTION_CATEGORIES } from "@/lib/constants";

const QUESTION_TYPES = [
  { value: "MCQ", label: "選択問題 (MCQ)" },
  { value: "FREE_TEXT", label: "記述問題" },
  { value: "CASE_MULTI", label: "ケース問題" },
  { value: "DEFINITION_FIX", label: "定義修正" },
  { value: "ORDERING", label: "並べ替え" },
];

interface QuestionOption {
  id?: string;
  text: string;
  isCorrect: boolean;
  position: number;
  explanation?: string;
}

interface QuestionTag {
  id?: string;
  tag: string;
}

interface Question {
  id: string;
  type: string;
  category: string;
  difficulty: number;
  text: string;
  explanation?: string;
  mustInclude: string[];
  forbiddenPoints: string[];
  relatedTerms: string[];
  modelAnswer?: string;
  correctOrder: string[];
  incorrectDefinition?: string;
  correctDefinition?: string;
  options: QuestionOption[];
  tags: QuestionTag[];
  createdAt: string;
}

interface NewQuestionForm {
  type: string;
  category: string;
  difficulty: number;
  text: string;
  explanation: string;
  mustInclude: string;
  forbiddenPoints: string;
  relatedTerms: string;
  modelAnswer: string;
  correctOrder: string;
  incorrectDefinition: string;
  correctDefinition: string;
  tags: string;
  options: { text: string; isCorrect: boolean; explanation: string }[];
}

const defaultForm: NewQuestionForm = {
  type: "MCQ",
  category: QUESTION_CATEGORIES[0],
  difficulty: 1,
  text: "",
  explanation: "",
  mustInclude: "",
  forbiddenPoints: "",
  relatedTerms: "",
  modelAnswer: "",
  correctOrder: "",
  incorrectDefinition: "",
  correctDefinition: "",
  tags: "",
  options: [
    { text: "", isCorrect: true, explanation: "" },
    { text: "", isCorrect: false, explanation: "" },
    { text: "", isCorrect: false, explanation: "" },
    { text: "", isCorrect: false, explanation: "" },
  ],
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewQuestionForm>({ ...defaultForm });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, [filterCategory, filterType]);

  const fetchQuestions = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterType) params.set("type", filterType);
      const res = await fetch(`/api/admin/questions?${params.toString()}`);
      if (!res.ok) throw new Error("問題の取得に失敗しました");
      const data = await res.json();
      setQuestions(data.questions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async () => {
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        category: form.category,
        difficulty: form.difficulty,
        text: form.text,
        explanation: form.explanation || undefined,
        modelAnswer: form.modelAnswer || undefined,
        mustInclude: form.mustInclude ? form.mustInclude.split(",").map((s) => s.trim()) : [],
        forbiddenPoints: form.forbiddenPoints ? form.forbiddenPoints.split(",").map((s) => s.trim()) : [],
        relatedTerms: form.relatedTerms ? form.relatedTerms.split(",").map((s) => s.trim()) : [],
        tags: form.tags ? form.tags.split(",").map((s) => s.trim()) : undefined,
      };

      if (form.type === "MCQ" || form.type === "CASE_MULTI") {
        body.options = form.options.map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect,
          explanation: o.explanation || undefined,
        }));
      }

      if (form.type === "ORDERING") {
        body.correctOrder = form.correctOrder ? form.correctOrder.split(",").map((s) => s.trim()) : [];
        body.options = form.options.map((o) => ({
          text: o.text,
          isCorrect: false,
        }));
      }

      if (form.type === "DEFINITION_FIX") {
        body.incorrectDefinition = form.incorrectDefinition;
        body.correctDefinition = form.correctDefinition;
      }

      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "問題の作成に失敗しました");
      }
      setDialogOpen(false);
      setForm({ ...defaultForm });
      fetchQuestions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setCreating(false);
    }
  };

  const updateOption = (index: number, field: string, value: string | boolean) => {
    setForm((prev) => {
      const newOptions = [...prev.options];
      newOptions[index] = { ...newOptions[index], [field]: value };
      // For MCQ, ensure only one correct option
      if (field === "isCorrect" && value === true && prev.type === "MCQ") {
        newOptions.forEach((o, i) => {
          if (i !== index) o.isCorrect = false;
        });
      }
      return { ...prev, options: newOptions };
    });
  };

  const typeLabel = (type: string) =>
    QUESTION_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">問題管理</h1>
        <Button
          className="bg-orange-600 hover:bg-orange-700 text-white"
          onClick={() => {
            setForm({ ...defaultForm });
            setDialogOpen(true);
          }}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新規作成
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full md:w-48"
            >
              <option value="">全カテゴリ</option>
              {QUESTION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full md:w-48"
            >
              <option value="">全タイプ</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
            <span className="text-sm text-gray-500 self-center ml-auto">
              {questions.length}件
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Questions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              問題がありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-28">タイプ</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-28">カテゴリ</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">問題文</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-16">難易度</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-24">作成日</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr
                      key={q.id}
                      className={cn(
                        "border-b border-gray-100 hover:bg-gray-50",
                        i % 2 === 1 && "bg-gray-50/50"
                      )}
                    >
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {typeLabel(q.type)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700">{q.category}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900 truncate max-w-md">{q.text}</p>
                        {q.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {q.tags.map((t) => (
                              <Badge key={t.id || t.tag} variant="secondary" className="text-xs">
                                {t.tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm">{"★".repeat(q.difficulty)}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs text-gray-500">
                          {new Date(q.createdAt).toLocaleDateString("ja-JP")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Question Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新しい問題を作成</DialogTitle>
            <DialogDescription>
              問題の詳細を入力してください
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Type & Category & Difficulty */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>問題タイプ</Label>
                <Select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="mt-1"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>カテゴリ</Label>
                <Select
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="mt-1"
                >
                  {QUESTION_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>難易度</Label>
                <Select
                  value={String(form.difficulty)}
                  onChange={(e) => setForm((prev) => ({ ...prev, difficulty: parseInt(e.target.value) }))}
                  className="mt-1"
                >
                  <option value="1">1 - 初級</option>
                  <option value="2">2 - 中級</option>
                  <option value="3">3 - 上級</option>
                  <option value="4">4 - 専門</option>
                  <option value="5">5 - 達人</option>
                </Select>
              </div>
            </div>

            {/* Question Text */}
            <div>
              <Label>問題文</Label>
              <Textarea
                value={form.text}
                onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
                rows={3}
                className="mt-1"
                placeholder="問題文を入力..."
              />
            </div>

            {/* MCQ & CASE_MULTI Options */}
            {(form.type === "MCQ" || form.type === "CASE_MULTI") && (
              <div>
                <Label>選択肢</Label>
                <div className="space-y-3 mt-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="pt-2">
                        <input
                          type={form.type === "MCQ" ? "radio" : "checkbox"}
                          name="correct-option"
                          checked={opt.isCorrect}
                          onChange={(e) => updateOption(i, "isCorrect", e.target.checked)}
                          className="w-4 h-4"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={opt.text}
                          onChange={(e) => updateOption(i, "text", e.target.value)}
                          placeholder={`選択肢 ${i + 1}`}
                        />
                        <Input
                          value={opt.explanation}
                          onChange={(e) => updateOption(i, "explanation", e.target.value)}
                          placeholder="解説 (任意)"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ORDERING specific */}
            {form.type === "ORDERING" && (
              <div className="space-y-3">
                <div>
                  <Label>選択肢 (並べ替え用)</Label>
                  <div className="space-y-2 mt-2">
                    {form.options.map((opt, i) => (
                      <Input
                        key={i}
                        value={opt.text}
                        onChange={(e) => updateOption(i, "text", e.target.value)}
                        placeholder={`項目 ${i + 1}`}
                      />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      options: [...prev.options, { text: "", isCorrect: false, explanation: "" }],
                    }))}
                  >
                    項目を追加
                  </Button>
                </div>
                <div>
                  <Label>正しい順序 (カンマ区切り)</Label>
                  <Input
                    value={form.correctOrder}
                    onChange={(e) => setForm((prev) => ({ ...prev, correctOrder: e.target.value }))}
                    placeholder="項目1, 項目2, 項目3..."
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* DEFINITION_FIX specific */}
            {form.type === "DEFINITION_FIX" && (
              <div className="space-y-3">
                <div>
                  <Label>誤った定義</Label>
                  <Textarea
                    value={form.incorrectDefinition}
                    onChange={(e) => setForm((prev) => ({ ...prev, incorrectDefinition: e.target.value }))}
                    rows={2}
                    className="mt-1"
                    placeholder="修正前の誤った定義..."
                  />
                </div>
                <div>
                  <Label>正しい定義</Label>
                  <Textarea
                    value={form.correctDefinition}
                    onChange={(e) => setForm((prev) => ({ ...prev, correctDefinition: e.target.value }))}
                    rows={2}
                    className="mt-1"
                    placeholder="正しい定義..."
                  />
                </div>
              </div>
            )}

            {/* FREE_TEXT & CASE_MULTI specific */}
            {(form.type === "FREE_TEXT" || form.type === "CASE_MULTI") && (
              <div className="space-y-3">
                <div>
                  <Label>必須キーワード (カンマ区切り)</Label>
                  <Input
                    value={form.mustInclude}
                    onChange={(e) => setForm((prev) => ({ ...prev, mustInclude: e.target.value }))}
                    placeholder="キーワード1, キーワード2..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>禁止事項 (カンマ区切り)</Label>
                  <Input
                    value={form.forbiddenPoints}
                    onChange={(e) => setForm((prev) => ({ ...prev, forbiddenPoints: e.target.value }))}
                    placeholder="禁止事項1, 禁止事項2..."
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Common fields */}
            <div>
              <Label>解説</Label>
              <Textarea
                value={form.explanation}
                onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))}
                rows={2}
                className="mt-1"
                placeholder="解説を入力..."
              />
            </div>

            <div>
              <Label>模範解答</Label>
              <Textarea
                value={form.modelAnswer}
                onChange={(e) => setForm((prev) => ({ ...prev, modelAnswer: e.target.value }))}
                rows={2}
                className="mt-1"
                placeholder="模範解答を入力..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>関連用語 (カンマ区切り)</Label>
                <Input
                  value={form.relatedTerms}
                  onChange={(e) => setForm((prev) => ({ ...prev, relatedTerms: e.target.value }))}
                  placeholder="用語1, 用語2..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>タグ (カンマ区切り)</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="タグ1, タグ2..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={handleCreateQuestion}
                disabled={creating || !form.text.trim()}
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    作成中...
                  </span>
                ) : (
                  "作成する"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
