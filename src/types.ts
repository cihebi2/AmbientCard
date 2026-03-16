export type OverlayPosition = "top-right" | "center-right" | "bottom-right" | "manual";
export type WordSource = "builtin" | "imported";
export type ReviewResult = "again" | "hard" | "good";

export interface OverlayPoint {
  x: number;
  y: number;
}

export interface AppSettings {
  autostartEnabled: boolean;
  intervalMs: number;
  opacity: number;
  position: OverlayPosition;
  manualPosition: OverlayPoint | null;
  showOnLaunch: boolean;
}

export interface WordCard {
  id: string;
  word: string;
  phonetic: string;
  meaningZh: string;
  note: string;
}

export interface WordDraft {
  word: string;
  phonetic: string;
  meaningZh: string;
  note: string;
}

export interface WordEntry extends WordCard {
  fingerprint: string;
  source: WordSource;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewState {
  wordId: string;
  dueAt: string;
  intervalMinutes: number;
  stage: number;
  seenCount: number;
  correctCount: number;
  lapseCount: number;
  lastReviewedAt: string | null;
  lastResult: ReviewResult | null;
}

export interface StudySnapshot {
  totalCount: number;
  dueCount: number;
  newCount: number;
  learningCount: number;
  masteredCount: number;
  nextDueAt: string | null;
}

export interface StudyData {
  activeWords: WordEntry[];
  customWords: WordEntry[];
  reviewStates: Record<string, ReviewState>;
  snapshot: StudySnapshot;
  usingCustomLibrary: boolean;
}

export interface ImportSummary {
  addedCount: number;
  updatedCount: number;
  ignoredCount: number;
  totalCustomCount: number;
}

export interface Option<T> {
  value: T;
  label: string;
  caption: string;
}

export const SETTINGS_STORE_PATH = "deskvocab-settings.json";
export const SETTINGS_KEY = "app-settings";
export const CUSTOM_LIBRARY_KEY = "custom-word-library";
export const REVIEW_STATES_KEY = "review-states";
export const SETTINGS_UPDATED_EVENT = "deskvocab:settings-updated";
export const LIBRARY_UPDATED_EVENT = "deskvocab:library-updated";
export const REVIEW_UPDATED_EVENT = "deskvocab:review-updated";

export const DEFAULT_SETTINGS: AppSettings = {
  autostartEnabled: false,
  intervalMs: 20_000,
  opacity: 0.84,
  position: "center-right",
  manualPosition: null,
  showOnLaunch: true,
};

export const INTERVAL_OPTIONS: Option<number>[] = [
  { value: 10_000, label: "10 秒", caption: "快速轮播，方便立即看到设置是否生效。" },
  { value: 20_000, label: "20 秒", caption: "更适合桌面常驻，不会一直停在同一张卡片。" },
  { value: 30_000, label: "30 秒", caption: "轻提醒节奏，适合持续工作时扫一眼。" },
  { value: 60_000, label: "1 分钟", caption: "默认节奏，存在感更弱一些。" },
  { value: 180_000, label: "3 分钟", caption: "最低打扰，适合长时间后台悬浮。" },
];

export const POSITION_OPTIONS: Option<OverlayPosition>[] = [
  { value: "top-right", label: "右上", caption: "更像系统提醒，抬眼就能看到。" },
  { value: "center-right", label: "右中", caption: "最像桌面歌词，视觉存在感最稳。" },
  { value: "bottom-right", label: "右下", caption: "对主工作区侵入最小。" },
  { value: "manual", label: "手动", caption: "直接在卡片上拖动后会自动切到这里。" },
];

export const REVIEW_RESULT_OPTIONS: Option<ReviewResult>[] = [
  { value: "again", label: "忘了", caption: "尽快回来，再看一次。" },
  { value: "hard", label: "模糊", caption: "缩短间隔，稍后再确认。" },
  { value: "good", label: "认识", caption: "延长间隔，进入下一轮。" },
];

export function normalizeSettings(
  raw?: Partial<AppSettings> | null,
  autostartOverride?: boolean,
): AppSettings {
  const allowedIntervals = new Set(INTERVAL_OPTIONS.map((item) => item.value));
  const allowedPositions = new Set(POSITION_OPTIONS.map((item) => item.value));
  const candidate = raw ?? {};
  const candidateInterval = typeof candidate.intervalMs === "number" ? candidate.intervalMs : null;
  const candidatePosition = typeof candidate.position === "string" ? candidate.position : null;
  const candidateManualPosition = candidate.manualPosition;
  const manualPosition =
    candidateManualPosition &&
      typeof candidateManualPosition.x === "number" &&
      typeof candidateManualPosition.y === "number"
      ? {
        x: Math.round(candidateManualPosition.x),
        y: Math.round(candidateManualPosition.y),
      }
      : null;

  return {
    autostartEnabled:
      autostartOverride ?? candidate.autostartEnabled ?? DEFAULT_SETTINGS.autostartEnabled,
    intervalMs: candidateInterval !== null && allowedIntervals.has(candidateInterval)
      ? candidateInterval
      : DEFAULT_SETTINGS.intervalMs,
    opacity: Number.isFinite(candidate.opacity)
      ? Math.min(1, Math.max(0.25, candidate.opacity as number))
      : DEFAULT_SETTINGS.opacity,
    position: candidatePosition !== null && allowedPositions.has(candidatePosition as OverlayPosition)
      ? (candidatePosition as OverlayPosition)
      : DEFAULT_SETTINGS.position,
    manualPosition,
    showOnLaunch: candidate.showOnLaunch ?? DEFAULT_SETTINGS.showOnLaunch,
  };
}

export function formatInterval(intervalMs: number) {
  const seconds = Math.round(intervalMs / 1000);

  if (seconds < 60) {
    return `${seconds} 秒`;
  }

  return `${Math.round(seconds / 60)} 分钟`;
}
