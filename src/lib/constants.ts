// XP Level thresholds
export const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 500,
  5: 800,
  6: 1200,
  7: 1700,
  8: 2300,
  9: 3000,
  10: 3800,
  11: 4800,
  12: 6000,
  13: 7500,
  14: 9200,
  15: 11200,
  16: 13500,
  17: 16000,
  18: 19000,
  19: 22500,
  20: 26500,
};

export function getLevelForXp(xp: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(LEVEL_THRESHOLDS)) {
    if (xp >= threshold) level = parseInt(lvl);
  }
  return level;
}

export function getXpForNextLevel(currentLevel: number): number {
  return LEVEL_THRESHOLDS[currentLevel + 1] ?? LEVEL_THRESHOLDS[20]! + 5000;
}

// XP rewards
export const XP_REWARDS = {
  CORRECT_BASE: 10,
  DIFFICULTY_MULTIPLIER: 2, // per difficulty level
  COMBO_BONUS: 5, // per consecutive correct
  SPEED_BONUS_MAX: 10, // max speed bonus
  LEARNING_CONTINUATION: 2, // XP for continuing after wrong answer
  EXAM_PASS_BONUS: 500,
} as const;

// Exam settings
export const EXAM_SETTINGS = {
  TOTAL_QUESTIONS: 120,
  PASS_TOTAL_SCORE: 90,
  PASS_CATEGORY_SCORE: 90,
  COOLDOWN_HOURS: 24,
  TYPE_DISTRIBUTION: {
    MCQ: 60,
    FREE_TEXT: 30,
    CASE_MULTI: 20,
    DEFINITION_FIX: 5,
    ORDERING: 5,
  },
} as const;

// Question type ratio limits for learn/test modes
export const DESCRIPTIVE_RATIO_MAX = 0.1; // 記述系は最大10%（10問中1問程度）
export const DESCRIPTIVE_TYPES = ["FREE_TEXT", "CASE_MULTI", "DEFINITION_FIX"] as const;

// Glossary categories
export const GLOSSARY_CATEGORIES = [
  "建築基礎",
  "法規・制度",
  "資金計画",
  "土地",
  "設計・プラン",
  "構造・工法",
  "設備・仕様",
  "契約・手続き",
  "税金・保険",
  "営業スキル",
] as const;

// Question categories (same as glossary for consistency)
export const QUESTION_CATEGORIES = GLOSSARY_CATEGORIES;
