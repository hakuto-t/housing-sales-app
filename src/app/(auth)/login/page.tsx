"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const [companyCode, setCompanyCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(companyCode, name);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-border p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">住宅営業育成</h1>
            <p className="text-sm text-muted-foreground mt-2">
              会社コードと氏名を入力してログイン
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="companyCode" className="block text-sm font-medium text-foreground mb-1.5">
                会社コード
              </label>
              <input
                id="companyCode"
                type="text"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
                className="w-full px-3 py-2.5 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="例: LIFEFUND"
                required
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                氏名（フルネーム）
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="例: 山田太郎"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              初回ログイン時は自動でアカウントが作成されます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
