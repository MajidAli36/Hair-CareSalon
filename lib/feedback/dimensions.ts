export const FEEDBACK_DIMENSIONS = [
  {
    key: "overall",
    column: "rating_overall",
    label: "Overall experience",
    hint: "How was the visit from start to finish?",
  },
  {
    key: "behaviour",
    column: "rating_behaviour",
    label: "Staff behaviour",
    hint: "Politeness, friendliness, and professionalism",
  },
  {
    key: "expertise",
    column: "rating_expertise",
    label: "Expertise & skill",
    hint: "Haircut / service quality and technique",
  },
  {
    key: "service",
    column: "rating_service",
    label: "Service quality",
    hint: "Attention to detail and result",
  },
  {
    key: "cleanliness",
    column: "rating_cleanliness",
    label: "Cleanliness",
    hint: "Salon hygiene, tools, and workspace",
  },
  {
    key: "value",
    column: "rating_value",
    label: "Value for money",
    hint: "Was the price fair for what they got?",
  },
  {
    key: "wait_time",
    column: "rating_wait_time",
    label: "Wait time",
    hint: "How acceptable was the waiting time?",
  },
] as const;

export type FeedbackDimensionKey = (typeof FEEDBACK_DIMENSIONS)[number]["key"];

export type FeedbackRatings = Record<FeedbackDimensionKey, number>;

export const IMPROVEMENT_THRESHOLD = 7;

export function scoreTone(score: number): "good" | "ok" | "bad" {
  if (score >= 8) return "good";
  if (score >= IMPROVEMENT_THRESHOLD) return "ok";
  return "bad";
}

export function average(nums: number[], decimals = 1): number {
  if (!nums.length) return 0;
  const raw = nums.reduce((a, b) => a + b, 0) / nums.length;
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}

/** Unrounded mean — use when averaging already-rounded values would compound error. */
export function averageExact(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
