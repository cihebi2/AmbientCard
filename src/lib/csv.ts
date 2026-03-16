import type { WordDraft } from "../types";

const HEADER_ALIASES = {
  word: ["word", "term", "vocab", "单词", "词汇", "词语"],
  phonetic: ["phonetic", "ipa", "pronunciation", "音标", "发音"],
  meaningZh: ["meaning", "translation", "translationzh", "释义", "中文", "中文释义", "含义"],
  note: ["note", "notes", "remark", "memo", "mnemonic", "备注", "提示", "记忆", "例句"],
  definition: ["definition", "englishdefinition", "def", "英文释义"],
  pos: ["pos", "partofspeech", "词性"],
  tag: ["tag", "tags", "标签"],
  exchange: ["exchange", "inflection", "wordform", "变形", "词形变化"],
} as const;

type ColumnKey = keyof typeof HEADER_ALIASES;

function normalizeCell(value: string) {
  return value
    .replace(/\uFEFF/g, "")
    .replace(/\\r\\n|\\n|\\r/g, " / ")
    .trim();
}

function normalizeHeader(value: string) {
  return normalizeCell(value).toLowerCase().replace(/[\s_\-./]+/g, "");
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const delimiters = [",", "\t", ";"];
  let best = ",";
  let bestScore = -1;

  for (const delimiter of delimiters) {
    const score = sample.split(delimiter).length;

    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }

  return best;
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

function detectHeaderMap(row: string[]) {
  const headerMap: Partial<Record<ColumnKey, number>> = {};
  let matches = 0;

  row.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);

    (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach((key) => {
      if (HEADER_ALIASES[key].includes(normalized as never)) {
        headerMap[key] = index;
        matches += 1;
      }
    });
  });

  return matches > 0 ? headerMap : null;
}

function getCell(row: string[], index: number | undefined) {
  if (index === undefined || index < 0 || index >= row.length) {
    return "";
  }

  return normalizeCell(row[index]);
}

function buildFallbackNote(
  row: string[],
  headerMap: Partial<Record<ColumnKey, number>> | null,
  wordIndex: number,
  phoneticIndex: number,
  meaningIndex: number,
) {
  const explicitNote = getCell(row, headerMap?.note);

  if (explicitNote) {
    return explicitNote;
  }

  if (!headerMap) {
    return getCell(row, 3);
  }

  const noteSegments = [
    getCell(row, headerMap.definition),
    headerMap.pos !== undefined ? `词性: ${getCell(row, headerMap.pos)}` : "",
    headerMap.tag !== undefined ? `标签: ${getCell(row, headerMap.tag)}` : "",
    headerMap.exchange !== undefined ? `词形: ${getCell(row, headerMap.exchange)}` : "",
  ]
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (noteSegments.length > 0) {
    return noteSegments.join(" | ");
  }

  const reservedIndexes = new Set([wordIndex, phoneticIndex, meaningIndex]);
  const fallbackIndex = row.findIndex((cell, index) => !reservedIndexes.has(index) && normalizeCell(cell).length > 0);

  return fallbackIndex >= 0 ? getCell(row, fallbackIndex) : "";
}

export function parseWordDraftsFromCsv(text: string) {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimitedRows(text.replace(/\uFEFF/g, ""), delimiter);

  if (rows.length === 0) {
    return [];
  }

  const headerMap = detectHeaderMap(rows[0]);
  const dataRows = headerMap ? rows.slice(1) : rows;
  const wordIndex = headerMap?.word ?? 0;
  const phoneticIndex = headerMap?.phonetic ?? 1;
  const meaningIndex = headerMap?.meaningZh ?? 2;
  const uniqueRows = new Map<string, WordDraft>();

  for (const row of dataRows) {
    const draft: WordDraft = {
      word: getCell(row, wordIndex),
      phonetic: getCell(row, phoneticIndex),
      meaningZh: getCell(row, meaningIndex),
      note: buildFallbackNote(row, headerMap, wordIndex, phoneticIndex, meaningIndex),
    };

    if (!draft.word || !draft.meaningZh) {
      continue;
    }

    const key = `${draft.word.toLowerCase()}::${draft.meaningZh.toLowerCase()}`;

    if (!uniqueRows.has(key)) {
      uniqueRows.set(key, draft);
    }
  }

  return [...uniqueRows.values()];
}
