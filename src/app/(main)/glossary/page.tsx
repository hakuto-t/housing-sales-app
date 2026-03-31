"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}

function GlossaryContent() {
  const searchParams = useSearchParams();
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const initialSearch = searchParams.get("search") || "";
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  // Auto-expand and scroll to matched term from URL param
  useEffect(() => {
    if (initialSearch && terms.length > 0) {
      const match = terms.find((t) => t.term === initialSearch);
      if (match) {
        setExpandedId(match.id);
        setTimeout(() => {
          highlightedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [initialSearch, terms]);

  const fetchTerms = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch ALL terms (no server-side filter), then filter client-side
      const res = await fetch("/api/glossary");
      if (!res.ok) throw new Error("用語の取得に失敗しました");
      const data = await res.json();
      setTerms(data.terms ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering for immediate response
  const filteredTerms = useMemo(() => {
    return terms.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.term.toLowerCase().includes(q) &&
          !t.definition.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (difficultyFilter && t.difficulty !== parseInt(difficultyFilter)) return false;
      return true;
    });
  }, [terms, search, categoryFilter, difficultyFilter]);

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

  const difficultyColor = (d: number) => {
    switch (d) {
      case 1: return "bg-green-100 text-green-700";
      case 2: return "bg-orange-100 text-orange-700";
      case 3: return "bg-yellow-100 text-yellow-700";
      case 4: return "bg-orange-100 text-orange-700";
      case 5: return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">用語集</h1>
        <span className="text-sm text-gray-500">{filteredTerms.length}件</span>
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
            <div className="flex-1">
              <Input
                placeholder="用語を検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full md:w-48"
            >
              <option value="">全カテゴリ</option>
              {GLOSSARY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
            <Select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="w-full md:w-36"
            >
              <option value="">全難易度</option>
              <option value="1">初級</option>
              <option value="2">中級</option>
              <option value="3">上級</option>
              <option value="4">専門</option>
              <option value="5">達人</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Terms Grid */}
      {filteredTerms.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">該当する用語が見つかりません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTerms.map((term) => {
            const isExpanded = expandedId === term.id;
            return (
              <Card
                key={term.id}
                ref={term.term === initialSearch ? highlightedRef : undefined}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  isExpanded && "md:col-span-2 ring-2 ring-orange-300"
                )}
                onClick={() => setExpandedId(isExpanded ? null : term.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 text-lg">{term.term}</h3>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {term.category}
                        </Badge>
                        <Badge className={cn("text-xs shrink-0", difficultyColor(term.difficulty))}>
                          {difficultyLabel(term.difficulty)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {term.definition}
                      </p>
                    </div>
                    <svg
                      className={cn(
                        "w-5 h-5 text-gray-400 shrink-0 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                      {term.relatedDiff && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">関連用語との違い</p>
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{term.relatedDiff}</p>
                        </div>
                      )}
                      {term.usageExample && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">正しい使用例</p>
                          <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{term.usageExample}</p>
                        </div>
                      )}
                      {term.misuseExample && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">よくある誤用例</p>
                          <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{term.misuseExample}</p>
                        </div>
                      )}
                      {term.imageUrl && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">参考画像</p>
                          <img
                            src={term.imageUrl}
                            alt={term.term}
                            className="rounded-lg max-h-48 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GlossaryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    }>
      <GlossaryContent />
    </Suspense>
  );
}
