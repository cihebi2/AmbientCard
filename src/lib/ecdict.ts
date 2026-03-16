import type { ImportSummary } from "../types";
import { clearCustomWordLibrary, importWordsFromCsvText } from "./study";

const ECDICT_FULL_SOURCES = [
  {
    label: "GitHub Raw",
    url: "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv",
  },
  {
    label: "jsDelivr",
    url: "https://cdn.jsdelivr.net/gh/skywind3000/ECDICT@master/ecdict.csv",
  },
] as const;

const REQUEST_TIMEOUT_MS = 45_000;
const TARGET_WORD_COUNT = 3000;
const FOCUS_TAGS = ["gk", "cet4", "cet6", "ky", "ielts", "toefl", "gre"] as const;
const BLOCKED_TRANSLATION_MARKERS = [
  "abbr.",
  "pref.",
  "suf.",
  "comb.",
  "缩写",
  "前缀",
  "后缀",
  "词缀",
  "表示：",
  "表示“",
  "表示:",
] as const;

type EcdictSource = (typeof ECDICT_FULL_SOURCES)[number];

interface EcdictRow {
  word: string;
  phonetic: string;
  definition: string;
  translation: string;
  pos: string;
  collins: string;
  oxford: string;
  tag: string;
  bnc: string;
  frq: string;
  exchange: string;
}

export interface RemoteDictionaryImportSummary extends ImportSummary {
  sourceLabel: string;
  sourceUrl: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeCell(value: string) {
  return value
    .replace(/\uFEFF/g, "")
    .replace(/\r\n|\n|\r/g, " / ")
    .trim();
}

function parseDelimitedRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows
    .map((row) => row.map(normalizeCell))
    .filter((row) => row.some((cell) => cell.length > 0));
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildNote(row: EcdictRow) {
  return [row.definition, row.pos ? `词性: ${row.pos}` : "", row.tag ? `标签: ${row.tag}` : "", row.exchange ? `词形: ${row.exchange}` : ""]
    .map((part) => normalizeCell(part))
    .filter((part) => part.length > 0)
    .join(" | ");
}

function hasFocusTag(tag: string) {
  const normalized = ` ${tag.toLowerCase()} `;
  return FOCUS_TAGS.some((focusTag) => normalized.includes(` ${focusTag} `));
}

function isCandidateWord(row: EcdictRow) {
  const word = normalizeCell(row.word);
  const translation = normalizeCell(row.translation);

  if (!word || !translation) {
    return false;
  }

  if (!/^[A-Za-z]+$/.test(word)) {
    return false;
  }

  if (word.length < 3 || word.length > 16) {
    return false;
  }

  const lowerTranslation = translation.toLowerCase();

  if (BLOCKED_TRANSLATION_MARKERS.some((marker) => lowerTranslation.includes(marker))) {
    return false;
  }

  const collins = toNumber(row.collins, 0);
  const oxford = toNumber(row.oxford, 0);
  const frq = toNumber(row.frq, 999_999);
  const bnc = toNumber(row.bnc, 999_999);
  const tagMatch = hasFocusTag(row.tag);

  return oxford === 1 || collins >= 2 || tagMatch || frq <= 12_000 || bnc <= 12_000;
}

function scoreCandidate(row: EcdictRow) {
  const collins = toNumber(row.collins, 0);
  const oxford = toNumber(row.oxford, 0);
  const frq = toNumber(row.frq, 999_999);
  const bnc = toNumber(row.bnc, 999_999);
  const tagText = row.tag.toLowerCase();
  const matchedTags = FOCUS_TAGS.filter((focusTag) => (` ${tagText} `).includes(` ${focusTag} `)).length;
  const lengthBonus = row.word.length >= 4 && row.word.length <= 10 ? 14 : 0;

  return (
    oxford * 220 +
    collins * 40 +
    matchedTags * 28 +
    Math.max(0, 12_000 - frq) / 18 +
    Math.max(0, 10_000 - bnc) / 30 +
    lengthBonus
  );
}

function buildCuratedCsv(text: string) {
  const rows = parseDelimitedRows(text, ",");

  if (rows.length < 2) {
    throw new Error("ECDICT 数据为空。");
  }

  const header = rows[0];
  const indexMap = new Map(header.map((key, index) => [key.trim().toLowerCase(), index]));
  const selected = rows
    .slice(1)
    .map((row) => {
      const item: EcdictRow = {
        word: row[indexMap.get("word") ?? -1] ?? "",
        phonetic: row[indexMap.get("phonetic") ?? -1] ?? "",
        definition: row[indexMap.get("definition") ?? -1] ?? "",
        translation: row[indexMap.get("translation") ?? -1] ?? "",
        pos: row[indexMap.get("pos") ?? -1] ?? "",
        collins: row[indexMap.get("collins") ?? -1] ?? "",
        oxford: row[indexMap.get("oxford") ?? -1] ?? "",
        tag: row[indexMap.get("tag") ?? -1] ?? "",
        bnc: row[indexMap.get("bnc") ?? -1] ?? "",
        frq: row[indexMap.get("frq") ?? -1] ?? "",
        exchange: row[indexMap.get("exchange") ?? -1] ?? "",
      };

      return item;
    })
    .filter(isCandidateWord)
    .sort((left, right) => {
      const scoreDiff = scoreCandidate(right) - scoreCandidate(left);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return left.word.localeCompare(right.word);
    });

  const deduped = new Map<string, EcdictRow>();

  for (const row of selected) {
    const key = normalizeCell(row.word).toLowerCase();

    if (!deduped.has(key)) {
      deduped.set(key, row);
    }

    if (deduped.size >= TARGET_WORD_COUNT) {
      break;
    }
  }

  if (deduped.size === 0) {
    throw new Error("没有筛出可用的 ECDICT 常用词。");
  }

  const csvRows = ["word,phonetic,meaning,note"];

  for (const row of deduped.values()) {
    const fields = [normalizeCell(row.word), normalizeCell(row.phonetic), normalizeCell(row.translation), buildNote(row)]
      .map((field) => `"${field.replace(/"/g, "\"\"")}"`);
    csvRows.push(fields.join(","));
  }

  return csvRows.join("\n");
}

async function fetchSourceText(source: EcdictSource) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/csv,text/plain,*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    if (!text.includes("word,phonetic,definition,translation")) {
      throw new Error("下载结果不是预期的 ECDICT 完整 CSV。");
    }

    return text;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function importEcdictMiniDictionary(): Promise<RemoteDictionaryImportSummary> {
  let lastError: unknown = null;

  for (const source of ECDICT_FULL_SOURCES) {
    try {
      const csvText = await fetchSourceText(source);
      const curatedCsv = buildCuratedCsv(csvText);

      await clearCustomWordLibrary();
      const summary = await importWordsFromCsvText(curatedCsv);

      return {
        ...summary,
        sourceLabel: `${source.label} / curated 3000`,
        sourceUrl: source.url,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`ECDICT 精选词库导入失败：${getErrorMessage(lastError)}`);
}
