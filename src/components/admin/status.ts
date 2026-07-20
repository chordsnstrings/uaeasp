import type { Lead } from "@/db/schema";

export const LEAD_STATUSES: Lead["status"][] = [
  "new",
  "contacted",
  "qualified",
  "matched",
  "closed_won",
  "closed_lost",
];

export const STATUS_META: Record<
  Lead["status"],
  { label: string; badge: string; dot: string }
> = {
  new: { label: "New", badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  contacted: { label: "Contacted", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  qualified: { label: "Qualified", badge: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  matched: { label: "Matched", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  closed_won: { label: "Closed · Won", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  closed_lost: { label: "Closed · Lost", badge: "bg-rose-50 text-rose-600 ring-rose-200", dot: "bg-rose-400" },
};

export const EMIRATE_LABELS: Record<string, string> = {
  "abu-dhabi": "Abu Dhabi",
  dubai: "Dubai",
  sharjah: "Sharjah",
  ajman: "Ajman",
  "umm-al-quwain": "Umm Al Quwain",
  "ras-al-khaimah": "Ras Al Khaimah",
  fujairah: "Fujairah",
};

export const VOLUME_LABELS: Record<string, string> = {
  lt100: "< 100 / mo",
  "100-1000": "100–1k / mo",
  "1000-10000": "1k–10k / mo",
  gt10000: "> 10k / mo",
};

export const BUDGET_LABELS: Record<string, string> = {
  economy: "Most affordable",
  mid: "Balanced",
  premium: "Premium",
  unsure: "Unsure",
};

export const TIMELINE_LABELS: Record<string, string> = {
  asap: "ASAP",
  "3months": "< 3 months",
  "6months": "< 6 months",
  exploring: "Exploring",
};

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Dubai",
  }).format(date);
}
