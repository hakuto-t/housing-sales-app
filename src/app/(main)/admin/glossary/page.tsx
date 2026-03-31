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
import { GLOSSARY_CATEGORIES } from "@/lib/constants";

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  relatedDiff?: string;
  usageExample?: string;
  misuseExample?: string;
  imageUrl?: string;
  category: string;
  difficulty: number;
  createdAt?: string;
}

interface TermForm {
  term: string;
  definition: string;
  relatedDiff: string;
  usageExample: string;
  misuseExample: string;
  imageUrl: string;
  category: string;
  difficulty: number;
}

const defaultForm: TermForm = {
  term: "",
  definition: "",
  relatedDiff: "",
  usageExample: "",
  misuseExample: "",
  imageUrl: "",
  category: GLOSSARY_CATEGORIES[0],
  difficulty: 1,
};

export default function AdminGlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TermForm>({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/glossary");
      if (!res.ok) throw new Error("用語の取得に失敗しました");
      const data = await res.json();
      setTerms(data.terms);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  };

  const openEditDialog = (term: GlossaryTerm) => {
    setEditingId(term.id);
    setForm({
      term: term.term,
      definition: term.definition,
      relatedDiff: term.relatedDiff || "",
      usageExample: term.usageExample || "",
      misuseExample: term.misuseExample || "",
      imageUrl: term.imageUrl || "",
      category: term.category,
      difficulty: term.difficulty,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        term: form.term,
        definition: form.definition,
        relatedDiff: form.relatedDiff || undefined,
        usageExample: form.usageExample || undefined,
        misuseExample: form.misuseExample || undefined,
        imageUrl: form.imageUrl || undefined,
        category: form.category,
        difficulty: form.difficulty,
      };

      if (editingId) {
        body.id = editingId;
        const res = await fetch("/api/admin/glossary", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("用語の更新に失敗しました");
      } else {
        const res = await fetch("/api/admin/glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("用語の作成に失敗しました");
      }

      setDialogOpen(false);
      setForm({ ...defaultForm });
      setEditingId(null);
      fetchTerms();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const difficultyLabel = (d: number) => {
    switch (d) {
      case 1: return "初級";
      case 2: return "中級";
      case 3: return "上級";
      case 4: return "専門";
      case 5: return "達人";
      default: return `Lv.${d}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">用語管理</h1>
        <Button
          className="bg-orange-600 hover:bg-orange-700 text-white"
          onClick={openCreateDialog}
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

      {/* Terms Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : terms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              用語がありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">用語</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">定義</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-28">カテゴリ</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-16">難易度</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-20">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((term, i) => (
                    <tr
                      key={term.id}
                      className={cn(
                        "border-b border-gray-100 hover:bg-gray-50",
                        i % 2 === 1 && "bg-gray-50/50"
                      )}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 text-sm">{term.term}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-600 truncate max-w-sm">{term.definition}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">{term.category}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm">{difficultyLabel(term.difficulty)}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(term)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "用語を編集" : "新しい用語を作成"}</DialogTitle>
            <DialogDescription>
              用語の詳細を入力してください
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>用語</Label>
                <Input
                  value={form.term}
                  onChange={(e) => setForm((prev) => ({ ...prev, term: e.target.value }))}
                  placeholder="用語を入力..."
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>カテゴリ</Label>
                  <Select
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="mt-1"
                  >
                    {GLOSSARY_CATEGORIES.map((cat) => (
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
            </div>

            <div>
              <Label>定義</Label>
              <Textarea
                value={form.definition}
                onChange={(e) => setForm((prev) => ({ ...prev, definition: e.target.value }))}
                rows={3}
                className="mt-1"
                placeholder="用語の定義を入力..."
              />
            </div>

            <div>
              <Label>関連用語との違い</Label>
              <Textarea
                value={form.relatedDiff}
                onChange={(e) => setForm((prev) => ({ ...prev, relatedDiff: e.target.value }))}
                rows={2}
                className="mt-1"
                placeholder="類似用語との違いを説明..."
              />
            </div>

            <div>
              <Label>正しい使用例</Label>
              <Textarea
                value={form.usageExample}
                onChange={(e) => setForm((prev) => ({ ...prev, usageExample: e.target.value }))}
                rows={2}
                className="mt-1"
                placeholder="営業での正しい使い方..."
              />
            </div>

            <div>
              <Label>よくある誤用例</Label>
              <Textarea
                value={form.misuseExample}
                onChange={(e) => setForm((prev) => ({ ...prev, misuseExample: e.target.value }))}
                rows={2}
                className="mt-1"
                placeholder="よくある間違った使い方..."
              />
            </div>

            <div>
              <Label>画像URL (任意)</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://..."
                className="mt-1"
              />
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
                onClick={handleSave}
                disabled={saving || !form.term.trim() || !form.definition.trim()}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    保存中...
                  </span>
                ) : editingId ? (
                  "更新する"
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
