import { BUILTIN_WORDS } from "../data/builtinWords";
import type {
  ImportSummary,
  ReviewResult,
  ReviewState,
  StudyData,
  StudySnapshot,
  WordCard,
  WordDraft,
  WordEntry,
} from "../types";
import {
  CUSTOM_LIBRARY_KEY,
  REVIEW_STATES_KEY,
} from "../types";
import { parseWordDraftsFromCsv } from "./csv";
import { getAppStore } from "./store";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MAX_STAGE = 4;

const AGAIN_INTERVALS = [10 * MINUTE, 30 * MINUTE, 2 * HOUR, 12 * HOUR, DAY];
const HARD_INTERVALS = [4 * HOUR, 12 * HOUR, DAY, 3 * DAY, 7 * DAY];
const GOOD_INTERVALS = [12 * HOUR, DAY, 3 * DAY, 7 * DAY, 14 * DAY];

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeComparable(value: string) {
  return normalizeText(value).toLowerCase();
}

function hashText(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function buildFingerprint(word: string, meaningZh: string) {
  return `${normalizeComparable(word)}::${normalizeComparable(meaningZh)}`;
}

function buildWordEntry(card: WordCard | WordDraft, source: WordEntry["source"], existing?: WordEntry): WordEntry {
  const word = normalizeText(card.word);
  const phonetic = normalizeText(card.phonetic);
  const meaningZh = normalizeText(card.meaningZh);
  const note = normalizeText(card.note);
  const fingerprint = buildFingerprint(word, meaningZh);
  const createdAt = existing?.createdAt ?? nowIso();

  return {
    id: existing?.id ?? `${source}:${hashText(fingerprint)}`,
    fingerprint,
    source,
    word,
    phonetic,
    meaningZh,
    note,
    createdAt,
    updatedAt: nowIso(),
  };
}

function normalizeWordEntry(raw: Partial<WordEntry> | null | undefined, fallbackSource: WordEntry["source"]) {
  if (!raw) {
    return null;
  }

  if (!raw.word || !raw.meaningZh) {
    return null;
  }

  return buildWordEntry(
    {
      id: raw.id ?? "",
      word: raw.word,
      phonetic: raw.phonetic ?? "",
      meaningZh: raw.meaningZh,
      note: raw.note ?? "",
    },
    raw.source ?? fallbackSource,
    raw.id
      ? {
        id: raw.id,
        fingerprint: raw.fingerprint ?? buildFingerprint(raw.word, raw.meaningZh),
        source: raw.source ?? fallbackSource,
        word: raw.word,
        phonetic: raw.phonetic ?? "",
        meaningZh: raw.meaningZh,
        note: raw.note ?? "",
        createdAt: raw.createdAt ?? nowIso(),
        updatedAt: raw.updatedAt ?? nowIso(),
      }
      : undefined,
  );
}

const BUILTIN_LIBRARY: WordEntry[] = BUILTIN_WORDS.map((word) => buildWordEntry(word, "builtin"));

function createDefaultReviewState(wordId: string): ReviewState {
  return {
    wordId,
    dueAt: nowIso(),
    intervalMinutes: 0,
    stage: 0,
    seenCount: 0,
    correctCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
    lastResult: null,
  };
}

function normalizeReviewState(raw: Partial<ReviewState> | null | undefined, wordId: string): ReviewState {
  const fallback = createDefaultReviewState(wordId);
  const dueAt = raw?.dueAt ? Date.parse(raw.dueAt) : Number.NaN;

  return {
    wordId,
    dueAt: Number.isFinite(dueAt) ? new Date(dueAt).toISOString() : fallback.dueAt,
    intervalMinutes: typeof raw?.intervalMinutes === "number" ? Math.max(0, raw.intervalMinutes) : 0,
    stage: typeof raw?.stage === "number" ? Math.min(MAX_STAGE, Math.max(0, raw.stage)) : 0,
    seenCount: typeof raw?.seenCount === "number" ? Math.max(0, raw.seenCount) : 0,
    correctCount: typeof raw?.correctCount === "number" ? Math.max(0, raw.correctCount) : 0,
    lapseCount: typeof raw?.lapseCount === "number" ? Math.max(0, raw.lapseCount) : 0,
    lastReviewedAt: raw?.lastReviewedAt ?? null,
    lastResult: raw?.lastResult ?? null,
  };
}

function buildReviewStateMap(words: WordEntry[], rawStates: Record<string, Partial<ReviewState>> | null | undefined) {
  const nextStates: Record<string, ReviewState> = {};
  const source = rawStates ?? {};

  for (const word of words) {
    nextStates[word.id] = normalizeReviewState(source[word.id], word.id);
  }

  return nextStates;
}

function getDueTimestamp(state: ReviewState) {
  return Date.parse(state.dueAt);
}

export function computeStudySnapshot(words: WordEntry[], reviewStates: Record<string, ReviewState>): StudySnapshot {
  const now = Date.now();
  let dueCount = 0;
  let newCount = 0;
  let learningCount = 0;
  let masteredCount = 0;
  let nextDueAt: string | null = null;

  for (const word of words) {
    const state = reviewStates[word.id] ?? createDefaultReviewState(word.id);
    const dueAt = getDueTimestamp(state);

    if (state.seenCount === 0) {
      newCount += 1;
    } else if (state.stage >= 3) {
      masteredCount += 1;
    } else {
      learningCount += 1;
    }

    if (!Number.isFinite(dueAt) || dueAt <= now) {
      dueCount += 1;
      if (!nextDueAt || Date.parse(nextDueAt) > now) {
        nextDueAt = new Date(now).toISOString();
      }
      continue;
    }

    if (!nextDueAt || dueAt < Date.parse(nextDueAt)) {
      nextDueAt = new Date(dueAt).toISOString();
    }
  }

  return {
    totalCount: words.length,
    dueCount,
    newCount,
    learningCount,
    masteredCount,
    nextDueAt,
  };
}

export function getStageLabel(stage: number) {
  if (stage <= 0) {
    return "新词";
  }
  if (stage === 1) {
    return "试记";
  }
  if (stage === 2) {
    return "熟悉";
  }
  if (stage === 3) {
    return "稳固";
  }
  return "长期";
}

export function formatDueLabel(dueAt: string | null) {
  if (!dueAt) {
    return "暂无计划";
  }

  const diff = Date.parse(dueAt) - Date.now();

  if (diff <= 0) {
    return "现在到期";
  }

  const minutes = Math.round(diff / MINUTE);

  if (minutes < 60) {
    return `${minutes} 分钟后`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} 小时后`;
  }

  return `${Math.round(hours / 24)} 天后`;
}

export function pickWordForOverlay(
  words: WordEntry[],
  reviewStates: Record<string, ReviewState>,
  currentWordId?: string | null,
) {
  if (words.length === 0) {
    return null;
  }

  const now = Date.now();
  const sorted = [...words].sort((left, right) => {
    const leftState = reviewStates[left.id] ?? createDefaultReviewState(left.id);
    const rightState = reviewStates[right.id] ?? createDefaultReviewState(right.id);
    const leftDueAt = getDueTimestamp(leftState);
    const rightDueAt = getDueTimestamp(rightState);
    const leftDue = !Number.isFinite(leftDueAt) || leftDueAt <= now;
    const rightDue = !Number.isFinite(rightDueAt) || rightDueAt <= now;

    if (leftDue !== rightDue) {
      return leftDue ? -1 : 1;
    }

    if (leftDueAt !== rightDueAt) {
      return leftDueAt - rightDueAt;
    }

    if (left.id === currentWordId) {
      return 1;
    }

    if (right.id === currentWordId) {
      return -1;
    }

    return left.word.localeCompare(right.word);
  });

  return sorted[0] ?? null;
}

export function applyReviewResult(state: ReviewState, result: ReviewResult) {
  const now = Date.now();
  const currentIntervalMs = Math.max(state.intervalMinutes * MINUTE, 0);
  let nextStage = state.stage;
  let nextIntervalMs = currentIntervalMs;

  if (result === "again") {
    nextStage = Math.max(0, state.stage - 1);
    nextIntervalMs = AGAIN_INTERVALS[Math.min(state.stage, AGAIN_INTERVALS.length - 1)];
  } else if (result === "hard") {
    nextStage = state.stage === 0 ? 1 : state.stage;
    nextIntervalMs = Math.max(
      HARD_INTERVALS[Math.min(state.stage, HARD_INTERVALS.length - 1)],
      currentIntervalMs > 0 ? Math.round(currentIntervalMs * 1.35) : 8 * HOUR,
    );
  } else {
    nextStage = Math.min(MAX_STAGE, state.stage + 1);
    nextIntervalMs = Math.max(
      GOOD_INTERVALS[Math.min(state.stage, GOOD_INTERVALS.length - 1)],
      currentIntervalMs > 0 ? Math.round(currentIntervalMs * 1.8) : 12 * HOUR,
    );
  }

  return {
    ...state,
    stage: nextStage,
    dueAt: new Date(now + nextIntervalMs).toISOString(),
    intervalMinutes: Math.round(nextIntervalMs / MINUTE),
    seenCount: state.seenCount + 1,
    correctCount: result === "again" ? state.correctCount : state.correctCount + 1,
    lapseCount: result === "again" ? state.lapseCount + 1 : state.lapseCount,
    lastReviewedAt: new Date(now).toISOString(),
    lastResult: result,
  };
}

async function loadStoredCustomWords() {
  const store = await getAppStore();
  const rawWords = await store.get<Partial<WordEntry>[]>(CUSTOM_LIBRARY_KEY);

  return (rawWords ?? [])
    .map((word) => normalizeWordEntry(word, "imported"))
    .filter((word): word is WordEntry => word !== null);
}

async function loadStoredReviewStates() {
  const store = await getAppStore();
  return (await store.get<Record<string, Partial<ReviewState>>>(REVIEW_STATES_KEY)) ?? {};
}

export async function saveReviewStates(reviewStates: Record<string, ReviewState>) {
  const store = await getAppStore();
  await store.set(REVIEW_STATES_KEY, reviewStates);
  await store.save();
}

async function saveCustomWords(words: WordEntry[]) {
  const store = await getAppStore();
  await store.set(CUSTOM_LIBRARY_KEY, words);
  await store.save();
}

export async function loadStudyData(): Promise<StudyData> {
  const [customWords, storedReviewStates] = await Promise.all([
    loadStoredCustomWords(),
    loadStoredReviewStates(),
  ]);
  const usingCustomLibrary = customWords.length > 0;
  const activeWords = usingCustomLibrary ? customWords : BUILTIN_LIBRARY;
  const reviewStates = buildReviewStateMap(activeWords, storedReviewStates);

  return {
    activeWords,
    customWords,
    reviewStates,
    snapshot: computeStudySnapshot(activeWords, reviewStates),
    usingCustomLibrary,
  };
}

export async function importWordsFromCsvText(text: string): Promise<ImportSummary> {
  const drafts = parseWordDraftsFromCsv(text);

  if (drafts.length === 0) {
    throw new Error("没有从 CSV 中解析到有效单词。至少需要 word 和 meaning 两列。");
  }

  const [customWords, storedReviewStates] = await Promise.all([
    loadStoredCustomWords(),
    loadStoredReviewStates(),
  ]);
  const nextWords = [...customWords];
  const wordsByFingerprint = new Map(nextWords.map((word) => [word.fingerprint, word]));
  const nextReviewStates: Record<string, ReviewState> = {};
  Object.entries(storedReviewStates).forEach(([wordId, state]) => {
    nextReviewStates[wordId] = normalizeReviewState(state, wordId);
  });
  let addedCount = 0;
  let updatedCount = 0;
  let ignoredCount = 0;

  for (const draft of drafts) {
    const fingerprint = buildFingerprint(draft.word, draft.meaningZh);
    const existing = wordsByFingerprint.get(fingerprint);

    if (existing) {
      const nextEntry = buildWordEntry(draft, "imported", existing);
      const unchanged =
        existing.word === nextEntry.word &&
        existing.phonetic === nextEntry.phonetic &&
        existing.meaningZh === nextEntry.meaningZh &&
        existing.note === nextEntry.note;

      if (unchanged) {
        ignoredCount += 1;
        continue;
      }

      const targetIndex = nextWords.findIndex((word) => word.id === existing.id);
      nextWords[targetIndex] = nextEntry;
      wordsByFingerprint.set(fingerprint, nextEntry);
      updatedCount += 1;
      continue;
    }

    const nextEntry = buildWordEntry(draft, "imported");
    nextWords.push(nextEntry);
    wordsByFingerprint.set(fingerprint, nextEntry);
    nextReviewStates[nextEntry.id] = nextReviewStates[nextEntry.id] ?? createDefaultReviewState(nextEntry.id);
    addedCount += 1;
  }

  await saveCustomWords(nextWords);
  await saveReviewStates(buildReviewStateMap(nextWords, nextReviewStates));

  return {
    addedCount,
    updatedCount,
    ignoredCount,
    totalCustomCount: nextWords.length,
  };
}

export async function clearCustomWordLibrary() {
  const [customWords, storedReviewStates] = await Promise.all([
    loadStoredCustomWords(),
    loadStoredReviewStates(),
  ]);
  const nextReviewStates: Record<string, ReviewState> = {};
  Object.entries(storedReviewStates).forEach(([wordId, state]) => {
    nextReviewStates[wordId] = normalizeReviewState(state, wordId);
  });

  customWords.forEach((word) => {
    delete nextReviewStates[word.id];
  });

  await saveCustomWords([]);
  await saveReviewStates(nextReviewStates);
}
