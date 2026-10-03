import { invokeLLM } from "./llm";
import { withAiResponseCache, type AiCacheSource } from "./ai-response-cache";

export type MeasurementKind = "length" | "weight" | "volume";

export interface CatalogAiUsageEvent {
  feature: "catalog_invoice_matching";
  operation: "search_term_expansion" | "semantic_rerank";
  phase?: "shortlist" | "fallback";
  source: "deepseek" | Exclude<AiCacheSource, "producer">;
  success: boolean;
  model?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens: number;
  promptCacheMissTokens: number;
  durationMs: number;
}

export type CatalogAiUsageReporter = (event: CatalogAiUsageEvent) => void;

const CATALOG_AI_TIMEOUT_MS = 15_000;

const CATALOG_AI_FEATURE = "catalog_invoice_matching" as const;
const SEARCH_TERMS_CACHE_VERSION = "catalog-search-terms-v1";
const SEMANTIC_RERANK_CACHE_VERSION = "catalog-semantic-rerank-v1";

function llmUsageEvent(params: {
  operation: CatalogAiUsageEvent["operation"];
  phase?: CatalogAiUsageEvent["phase"];
  response?: any;
  durationMs: number;
  success: boolean;
}): CatalogAiUsageEvent {
  const usage = params.response?.usage || {};
  return {
    feature: CATALOG_AI_FEATURE,
    operation: params.operation,
    phase: params.phase,
    source: "deepseek",
    success: params.success,
    model: params.response?.model ?? null,
    promptTokens: Number(usage.prompt_tokens || 0),
    completionTokens: Number(usage.completion_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0),
    promptCacheHitTokens: Number(usage.prompt_cache_hit_tokens || usage.prompt_cache_hit_tokens_count || 0),
    promptCacheMissTokens: Number(usage.prompt_cache_miss_tokens || usage.prompt_cache_miss_tokens_count || 0),
    durationMs: params.durationMs,
  };
}

function cachedUsageEvent(params: {
  operation: CatalogAiUsageEvent["operation"];
  phase?: CatalogAiUsageEvent["phase"];
  source: Exclude<AiCacheSource, "producer">;
}): CatalogAiUsageEvent {
  return {
    feature: CATALOG_AI_FEATURE,
    operation: params.operation,
    phase: params.phase,
    source: params.source,
    success: true,
    model: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 0,
    durationMs: 0,
  };
}

export interface NormalizedMeasurement {
  kind: MeasurementKind;
  value: number;
  baseUnit: "mm" | "g" | "ml";
  raw: string;
}

export interface CatalogItemCandidateInput {
  id: number;
  code?: string | null;
  nameAr: string;
  nameEn?: string | null;
  unit?: string | null;
  manufacturer?: string | null;
}

export interface SupplierItemAliasInput {
  id: number;
  supplierId: number;
  catalogItemId: number;
  supplierItemName: string;
  normalizedName: string;
  supplierItemCode?: string | null;
  normalizedItemCode?: string | null;
  normalizedMeasurements?: unknown;
}

export interface ItemMatchQuery {
  itemName: string;
  itemNameEn?: string | null;
  supplierItemCode?: string | null;
  unit?: string | null;
}

export type MeasurementStatus = "compatible" | "conflict" | "unknown";
export type ItemMatchReason =
  | "supplier_code_exact"
  | "supplier_alias_exact"
  | "supplier_alias_similar"
  | "catalog_name_exact"
  | "catalog_semantic"
  | "catalog_local_strong"
  | "ai_semantic";

export interface RankedCatalogItemMatch {
  catalogItemId: number;
  code?: string | null;
  nameAr: string;
  nameEn?: string | null;
  unit?: string | null;
  score: number;
  reason: ItemMatchReason;
  measurementStatus: MeasurementStatus;
  measurementNote?: string | null;
  matchedAlias?: string | null;
  supplierItemCode?: string | null;
  autoSelect: boolean;
  aiUsed?: boolean;
}

const ARABIC_CHAR_MAP: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي",
};

const SEMANTIC_TOKEN_MAP: Record<string, string> = {
  // Gauze / bandage family
  "شاش": "gauze",
  "رباط": "bandage",
  "باندج": "bandage",
  "باندينج": "bandage",
  "ضماد": "bandage",
  "gauze": "gauze",
  "bandage": "bandage",
  "dressing": "bandage",
  // Common medical/product terms. This dictionary is intentionally conservative;
  // AI is only used later for ambiguous semantic cases.
  "طبي": "medical",
  "طبيه": "medical",
  "medical": "medical",
  "قفاز": "glove",
  "قفازات": "glove",
  "glove": "glove",
  "gloves": "glove",
  "كمامه": "mask",
  "كمامات": "mask",
  "mask": "mask",
  "masks": "mask",
  "لاصق": "tape",
  "شريط": "tape",
  "tape": "tape",
};

function normalizeArabicChars(value: string): string {
  return value.replace(/[أإآىةؤئ]/g, ch => ARABIC_CHAR_MAP[ch] || ch);
}

function normalizeDigits(value: string): string {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return value
    .replace(/[٠-٩]/g, digit => String(arabic.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(persian.indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

export function normalizeCatalogItemText(value?: string | null): string {
  if (!value) return "";
  return normalizeDigits(normalizeArabicChars(value))
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[_/\\|,+;:()\[\]{}]/g, " ")
    .replace(/[^\p{L}\p{N}.\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSupplierItemCode(value?: string | null): string {
  return normalizeDigits(value || "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

function semanticTokens(value?: string | null): Set<string> {
  const normalized = normalizeCatalogItemText(value);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return new Set(tokens.map(token => SEMANTIC_TOKEN_MAP[token] || token));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function parseNumber(raw: string): number | null {
  const normalized = normalizeDigits(raw).replace(/,/g, ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

const MEASUREMENT_PATTERNS: Array<{
  regex: RegExp;
  kind: MeasurementKind;
  baseUnit: "mm" | "g" | "ml";
  factor: number;
}> = [
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:mm|مم|ملم|مليمتر|ملي\s*متر)/giu, kind: "length", baseUnit: "mm", factor: 1 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:cm|سم|سنتيمتر)/giu, kind: "length", baseUnit: "mm", factor: 10 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:inch|inches|in\b|"|بوصه|بوصة|انش)/giu, kind: "length", baseUnit: "mm", factor: 25.4 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:meter|metre|meters|metres|m\b|متر)/giu, kind: "length", baseUnit: "mm", factor: 1000 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:kg|كجم|كيلو(?:جرام)?)/giu, kind: "weight", baseUnit: "g", factor: 1000 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:g\b|gm\b|جرام)/giu, kind: "weight", baseUnit: "g", factor: 1 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:l\b|liter|litre|لتر)/giu, kind: "volume", baseUnit: "ml", factor: 1000 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:ml|مل|مليلتر)/giu, kind: "volume", baseUnit: "ml", factor: 1 },
];

export function extractNormalizedMeasurements(value?: string | null): NormalizedMeasurement[] {
  if (!value) return [];
  const text = normalizeDigits(normalizeArabicChars(value)).toLowerCase();
  const results: NormalizedMeasurement[] = [];
  for (const pattern of MEASUREMENT_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const numeric = parseNumber(match[1]);
      if (numeric == null) continue;
      results.push({
        kind: pattern.kind,
        value: numeric * pattern.factor,
        baseUnit: pattern.baseUnit,
        raw: match[0],
      });
    }
  }
  return results;
}

function almostEqual(a: number, b: number): boolean {
  const absoluteTolerance = 0.0001;
  const relativeTolerance = 0.005; // 0.5% to absorb decimal formatting only
  return Math.abs(a - b) <= Math.max(absoluteTolerance, Math.max(Math.abs(a), Math.abs(b)) * relativeTolerance);
}

export function compareMeasurements(queryText: string, candidateText: string): {
  status: MeasurementStatus;
  note?: string;
} {
  const query = extractNormalizedMeasurements(queryText);
  const candidate = extractNormalizedMeasurements(candidateText);
  if (query.length === 0 || candidate.length === 0) return { status: "unknown" };

  const sharedKinds = new Set(query.map(m => m.kind).filter(kind => candidate.some(c => c.kind === kind)));
  if (sharedKinds.size === 0) return { status: "unknown" };

  for (const kind of sharedKinds) {
    const qValues = query.filter(m => m.kind === kind).map(m => m.value).sort((a, b) => a - b);
    const cValues = candidate.filter(m => m.kind === kind).map(m => m.value).sort((a, b) => a - b);
    const sameCount = qValues.length === cValues.length;
    const sameValues = sameCount && qValues.every((value, idx) => almostEqual(value, cValues[idx]));
    if (!sameValues) {
      const baseUnit = kind === "length" ? "mm" : kind === "weight" ? "g" : "ml";
      return {
        status: "conflict",
        note: `المواصفة تختلف بعد توحيد الوحدة: ${qValues.join(" × ")} ${baseUnit} مقابل ${cValues.join(" × ")} ${baseUnit}`,
      };
    }
  }

  return { status: "compatible" };
}

// Names/aliases are alternative descriptions, not additional physical dimensions.
// Compare each description separately so translations do not double the dimensions.
// A conflict in ANY description still wins; repeated dimensions within a name stay intact.
function compareMeasurementDescriptions(
  queryTexts: Array<string | null | undefined>,
  candidateTexts: Array<string | null | undefined>,
): ReturnType<typeof compareMeasurements> {
  let result: ReturnType<typeof compareMeasurements> = { status: "unknown" };
  for (const queryText of queryTexts) {
    if (!queryText) continue;
    for (const candidateText of candidateTexts) {
      if (!candidateText) continue;
      const comparison = compareMeasurements(queryText, candidateText);
      if (comparison.status === "conflict") return comparison;
      if (comparison.status === "compatible") result = comparison;
    }
  }
  return result;
}

function candidateMeasurementTexts(candidate: CatalogItemCandidateInput): Array<string | null | undefined> {
  return [candidate.nameAr, candidate.nameEn, candidate.unit, candidate.manufacturer];
}

function nameSimilarity(query: ItemMatchQuery, candidate: CatalogItemCandidateInput): number {
  const queryTexts = [query.itemName, query.itemNameEn].filter(Boolean) as string[];
  const candidateTexts = [candidate.nameAr, candidate.nameEn].filter(Boolean) as string[];
  let best = 0;

  for (const q of queryTexts) {
    const qNorm = normalizeCatalogItemText(q);
    const qTokens = semanticTokens(q);
    for (const c of candidateTexts) {
      const cNorm = normalizeCatalogItemText(c);
      if (!qNorm || !cNorm) continue;
      if (qNorm === cNorm) best = Math.max(best, 1);
      else if (qNorm.includes(cNorm) || cNorm.includes(qNorm)) best = Math.max(best, 0.88);
      best = Math.max(best, jaccard(qTokens, semanticTokens(c)));
    }
  }

  return best;
}

function aliasSimilarity(query: ItemMatchQuery, alias: SupplierItemAliasInput): number {
  const qNorm = normalizeCatalogItemText(query.itemName);
  const qEnNorm = normalizeCatalogItemText(query.itemNameEn);
  if (qNorm && qNorm === alias.normalizedName) return 1;
  if (qEnNorm && qEnNorm === alias.normalizedName) return 1;
  const tokens = semanticTokens(query.itemName);
  return jaccard(tokens, semanticTokens(alias.supplierItemName));
}

export function rankCatalogItemMatches(params: {
  query: ItemMatchQuery;
  catalogItems: CatalogItemCandidateInput[];
  supplierAliases?: SupplierItemAliasInput[];
  limit?: number;
}): RankedCatalogItemMatch[] {
  const { query, catalogItems, supplierAliases = [], limit = 5 } = params;
  const normalizedCode = normalizeSupplierItemCode(query.supplierItemCode);
  const itemById = new Map(catalogItems.map(item => [item.id, item]));
  const ranked = new Map<number, RankedCatalogItemMatch>();

  for (const alias of supplierAliases) {
    const candidate = itemById.get(alias.catalogItemId);
    if (!candidate) continue;
    const aliasCode = normalizeSupplierItemCode(alias.supplierItemCode);
    const exactCode = !!normalizedCode && !!aliasCode && normalizedCode === aliasCode;
    const similarity = aliasSimilarity(query, alias);
    if (!exactCode && similarity < 0.28) continue;

    const measurement = compareMeasurementDescriptions(
      [query.itemName, query.itemNameEn, query.unit],
      [alias.supplierItemName, ...candidateMeasurementTexts(candidate)],
    );
    const baseScore = exactCode ? 100 : similarity === 1 ? 98 : Math.round(78 + similarity * 18);
    const score = measurement.status === "conflict" ? Math.min(baseScore, 59) : baseScore;
    const queryHasMeasurements = extractNormalizedMeasurements(
      [query.itemName, query.itemNameEn, query.unit].filter(Boolean).join(" "),
    ).length > 0;
    const candidateHasMeasurements = extractNormalizedMeasurements(
      [alias.supplierItemName, ...candidateMeasurementTexts(candidate)].filter(Boolean).join(" "),
    ).length > 0;
    const safeAliasAutoSelect = similarity === 1 && (
      measurement.status === "compatible" || (!queryHasMeasurements && !candidateHasMeasurements)
    );
    ranked.set(candidate.id, {
      catalogItemId: candidate.id,
      code: candidate.code,
      nameAr: candidate.nameAr,
      nameEn: candidate.nameEn,
      unit: candidate.unit,
      score,
      reason: exactCode ? "supplier_code_exact" : similarity === 1 ? "supplier_alias_exact" : "supplier_alias_similar",
      measurementStatus: measurement.status,
      measurementNote: measurement.note,
      matchedAlias: alias.supplierItemName,
      supplierItemCode: alias.supplierItemCode,
      autoSelect: measurement.status !== "conflict" && (exactCode || safeAliasAutoSelect),
    });
  }

  for (const candidate of catalogItems) {
    const similarity = nameSimilarity(query, candidate);
    if (similarity < 0.2) continue;
    const measurement = compareMeasurementDescriptions(
      [query.itemName, query.itemNameEn, query.unit],
      candidateMeasurementTexts(candidate),
    );
    const exact = similarity >= 0.999;
    let score = exact ? 93 : Math.round(45 + similarity * 45);
    if (measurement.status === "compatible") score = Math.min(96, score + 4);
    if (measurement.status === "conflict") score = Math.min(score, 55);

    const current = ranked.get(candidate.id);
    const proposed: RankedCatalogItemMatch = {
      catalogItemId: candidate.id,
      code: candidate.code,
      nameAr: candidate.nameAr,
      nameEn: candidate.nameEn,
      unit: candidate.unit,
      score,
      reason: exact ? "catalog_name_exact" : "catalog_semantic",
      measurementStatus: measurement.status,
      measurementNote: measurement.note,
      matchedAlias: null,
      supplierItemCode: null,
      // Catalog-only semantic matches are suggestions. User confirms them before saving.
      autoSelect: false,
    };
    if (!current || proposed.score > current.score) ranked.set(candidate.id, proposed);
  }

  return [...ranked.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

const AI_DISCOVERY_MIN_SCORE = 0.58;
const HYBRID_SHORTLIST_SIZE = 100;
const HYBRID_EXPANDED_SHORTLIST_SIZE = 120;
const HYBRID_WIDE_FALLBACK_SIZE = 180;
const HYBRID_EXPANSION_TRIGGER_SCORE = 0.72;
const HYBRID_RELIABLE_RESULT_SCORE = 75;
const HYBRID_LOCAL_STRONG_SCORE = 0.85;

type AiSemanticScore = {
  catalogItemId: number;
  semanticScore: number;
};

export interface HybridCatalogShortlist {
  items: CatalogItemCandidateInput[];
  topRetrievalScore: number;
  topCandidate: CatalogItemCandidateInput | null;
}

function charNgrams(value: string, size = 3): Set<string> {
  const compact = normalizeCatalogItemText(value).replace(/\s+/g, " ");
  if (!compact) return new Set();
  if (compact.length <= size) return new Set([compact]);
  const grams = new Set<string>();
  for (let i = 0; i <= compact.length - size; i++) grams.add(compact.slice(i, i + size));
  return grams;
}

function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return (2 * intersection) / (a.size + b.size);
}

function tokenSoftSimilarity(queryText: string, candidateText: string): number {
  const queryTokens = normalizeCatalogItemText(queryText).split(/\s+/).filter(Boolean);
  const candidateTokens = normalizeCatalogItemText(candidateText).split(/\s+/).filter(Boolean);
  if (!queryTokens.length || !candidateTokens.length) return 0;

  let total = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const candidateToken of candidateTokens) {
      if (queryToken === candidateToken) {
        best = 1;
        break;
      }
      const minLength = Math.min(queryToken.length, candidateToken.length);
      if (minLength >= 3 && (queryToken.startsWith(candidateToken) || candidateToken.startsWith(queryToken))) {
        best = Math.max(best, 0.9);
      } else if (minLength >= 4 && (queryToken.includes(candidateToken) || candidateToken.includes(queryToken))) {
        best = Math.max(best, 0.82);
      }
      best = Math.max(best, diceCoefficient(charNgrams(queryToken, 2), charNgrams(candidateToken, 2)) * 0.8);
    }
    total += best;
  }
  return total / queryTokens.length;
}

function retrievalTextSimilarity(queryText: string, candidateText: string): number {
  const queryNorm = normalizeCatalogItemText(queryText);
  const candidateNorm = normalizeCatalogItemText(candidateText);
  if (!queryNorm || !candidateNorm) return 0;
  if (queryNorm === candidateNorm) return 1;
  if (queryNorm.includes(candidateNorm) || candidateNorm.includes(queryNorm)) return 0.92;

  const semantic = jaccard(semanticTokens(queryText), semanticTokens(candidateText));
  const softTokens = tokenSoftSimilarity(queryText, candidateText);
  const character = diceCoefficient(charNgrams(queryText), charNgrams(candidateText));
  return Math.max(semantic, softTokens * 0.9, character * 0.72);
}

function hybridRetrievalScore(params: {
  query: ItemMatchQuery;
  candidate: CatalogItemCandidateInput;
  extraSearchTerms?: string[];
}): number {
  const { query, candidate, extraSearchTerms = [] } = params;
  const queryTexts = [query.itemName, query.itemNameEn, ...extraSearchTerms].filter(Boolean) as string[];
  const candidateTexts = [candidate.nameAr, candidate.nameEn, candidate.manufacturer].filter(Boolean) as string[];
  let best = 0;

  for (const queryText of queryTexts) {
    for (const candidateText of candidateTexts) {
      best = Math.max(best, retrievalTextSimilarity(queryText, candidateText));
    }
  }

  const measurement = compareMeasurementDescriptions(
    [query.itemName, query.itemNameEn, query.unit],
    candidateMeasurementTexts(candidate),
  );
  if (measurement.status === "compatible") best = Math.min(1, best + 0.08);
  if (measurement.status === "conflict") best *= 0.78;

  const queryUnit = normalizeCatalogItemText(query.unit);
  const candidateUnit = normalizeCatalogItemText(candidate.unit);
  if (queryUnit && candidateUnit && queryUnit === candidateUnit) best = Math.min(1, best + 0.04);

  return best;
}

/**
 * Fast in-process retrieval used before DeepSeek. It keeps supplier/deterministic
 * candidates pinned, then ranks the active Catalog lexically/fuzzily across Arabic,
 * English, manufacturer text and normalized measurements. No DB schema/index is
 * required for the current catalog size because the Catalog is already loaded once
 * for matchInvoiceItems.
 */
export function buildHybridCatalogShortlist(params: {
  query: ItemMatchQuery;
  catalogItems: CatalogItemCandidateInput[];
  deterministicCandidates?: RankedCatalogItemMatch[];
  extraSearchTerms?: string[];
  size?: number;
}): HybridCatalogShortlist {
  const {
    query,
    catalogItems,
    deterministicCandidates = [],
    extraSearchTerms = [],
    size = HYBRID_SHORTLIST_SIZE,
  } = params;
  const deterministicIds = new Set(deterministicCandidates.map(item => item.catalogItemId));
  const scored = catalogItems.map(item => ({
    item,
    score: hybridRetrievalScore({ query, candidate: item, extraSearchTerms }),
    pinned: deterministicIds.has(item.id),
  }));

  scored.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.item.id - b.item.id;
  });

  const topRetrievalRow = scored.reduce<{ item: CatalogItemCandidateInput; score: number } | null>((best, row) => {
    if (!best || row.score > best.score) return { item: row.item, score: row.score };
    return best;
  }, null);
  return {
    items: scored.slice(0, Math.max(1, size)).map(row => row.item),
    topRetrievalScore: topRetrievalRow?.score ?? 0,
    topCandidate: topRetrievalRow?.item ?? null,
  };
}

export function buildStrongLocalFallbackMatch(params: {
  query: ItemMatchQuery;
  shortlist: HybridCatalogShortlist;
}): RankedCatalogItemMatch | null {
  const { query, shortlist } = params;
  const candidate = shortlist.topCandidate;
  if (!candidate || shortlist.topRetrievalScore < HYBRID_LOCAL_STRONG_SCORE) return null;

  const measurement = compareMeasurementDescriptions(
    [query.itemName, query.itemNameEn, query.unit],
    candidateMeasurementTexts(candidate),
  );

  return {
    catalogItemId: candidate.id,
    code: candidate.code,
    nameAr: candidate.nameAr,
    nameEn: candidate.nameEn,
    unit: candidate.unit,
    score: Math.min(96, Math.max(75, Math.round(shortlist.topRetrievalScore * 100))),
    reason: "catalog_local_strong",
    measurementStatus: measurement.status,
    measurementNote: measurement.note,
    matchedAlias: null,
    supplierItemCode: null,
    autoSelect: false,
    aiUsed: false,
  };
}

function mergeStrongLocalFallback(
  matches: RankedCatalogItemMatch[],
  localFallback: RankedCatalogItemMatch | null,
  limit: number,
): RankedCatalogItemMatch[] {
  if (!localFallback) return matches;
  const merged = new Map(matches.map(match => [match.catalogItemId, match]));
  const existing = merged.get(localFallback.catalogItemId);
  if (!existing || existing.score < localFallback.score) merged.set(localFallback.catalogItemId, localFallback);
  return [...merged.values()]
    .sort((a, b) => {
      if (a.autoSelect !== b.autoSelect) return a.autoSelect ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, limit);
}

function logHybridDiagnostics(params: {
  phase: "shortlist" | "fallback";
  shortlist: HybridCatalogShortlist;
  aiScores: AiSemanticScore[];
}) {
  const { phase, shortlist, aiScores } = params;
  const localId = shortlist.topCandidate?.id ?? "none";
  console.info(
    `[CatalogItemMatch] Local top (${phase}): catalogItemId=${localId} score=${shortlist.topRetrievalScore.toFixed(2)}`,
  );
  const topAi = [...aiScores].sort((a, b) => b.semanticScore - a.semanticScore)[0];
  console.info(
    topAi
      ? `[CatalogItemMatch] DeepSeek returned (${phase}): catalogItemId=${topAi.catalogItemId} score=${topAi.semanticScore.toFixed(2)}`
      : `[CatalogItemMatch] DeepSeek returned (${phase}): none`,
  );
}

function toRankedCatalogItemMatch(params: {
  query: ItemMatchQuery;
  candidate: CatalogItemCandidateInput;
  semanticScore: number;
  deterministic?: RankedCatalogItemMatch;
}): RankedCatalogItemMatch {
  const { query, candidate, semanticScore, deterministic } = params;
  const measurement = compareMeasurementDescriptions(
    [query.itemName, query.itemNameEn, query.unit],
    candidateMeasurementTexts(candidate),
  );

  const semanticPercent = Math.round(semanticScore * 100);
  const aiOnlyScore = Math.round(55 + semanticScore * 40);
  const blendedScore = deterministic
    ? Math.round(deterministic.score * 0.35 + semanticPercent * 0.65)
    : aiOnlyScore;
  let score = Math.max(aiOnlyScore, blendedScore);

  if (measurement.status === "compatible") score = Math.min(98, score + 3);

  return {
    catalogItemId: candidate.id,
    code: candidate.code,
    nameAr: candidate.nameAr,
    nameEn: candidate.nameEn,
    unit: candidate.unit,
    score,
    reason: "ai_semantic",
    measurementStatus: measurement.status,
    measurementNote: measurement.note,
    matchedAlias: deterministic?.matchedAlias ?? null,
    supplierItemCode: deterministic?.supplierItemCode ?? null,
    autoSelect: false,
    aiUsed: true,
  };
}

/**
 * Pure merge step used by semantic discovery and unit tests.
 * AI may introduce a Catalog Item that was absent from deterministic candidates,
 * while supplier memory / deterministic candidates are preserved as fallbacks.
 */
export function mergeAiSemanticDiscoveryResults(params: {
  query: ItemMatchQuery;
  catalogItems: CatalogItemCandidateInput[];
  deterministicCandidates: RankedCatalogItemMatch[];
  aiScores: AiSemanticScore[];
  limit?: number;
}): RankedCatalogItemMatch[] {
  const { query, catalogItems, deterministicCandidates, limit = 5 } = params;
  const catalogById = new Map(catalogItems.map(item => [item.id, item]));
  const deterministicById = new Map(deterministicCandidates.map(item => [item.catalogItemId, item]));
  const merged = new Map<number, RankedCatalogItemMatch>(
    deterministicCandidates.map(item => [item.catalogItemId, item]),
  );

  for (const row of params.aiScores) {
    if (!Number.isFinite(row.catalogItemId) || !Number.isFinite(row.semanticScore)) continue;
    const semanticScore = Math.max(0, Math.min(1, row.semanticScore));
    if (semanticScore < AI_DISCOVERY_MIN_SCORE) continue;
    const candidate = catalogById.get(row.catalogItemId);
    if (!candidate) continue;

    const ranked = toRankedCatalogItemMatch({
      query,
      candidate,
      semanticScore,
      deterministic: deterministicById.get(candidate.id),
    });
    const existing = merged.get(candidate.id);
    if (!existing || ranked.score > existing.score || existing.reason === "catalog_semantic") {
      merged.set(candidate.id, ranked);
    }
  }

  return [...merged.values()]
    .sort((a, b) => {
      if (a.autoSelect !== b.autoSelect) return a.autoSelect ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, limit);
}

function parseAiRankedRows(raw: unknown, allowedIds: Set<number>): AiSemanticScore[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const parsed = JSON.parse(stripJsonFence(raw));
  const ranked = Array.isArray(parsed?.ranked) ? parsed.ranked : [];
  const rows: AiSemanticScore[] = [];
  for (const row of ranked) {
    const catalogItemId = Number(row?.catalogItemId);
    const semanticScore = Number(row?.semanticScore);
    if (!Number.isFinite(catalogItemId) || !Number.isFinite(semanticScore)) continue;
    if (!allowedIds.has(catalogItemId)) continue;
    rows.push({
      catalogItemId,
      semanticScore: Math.max(0, Math.min(1, semanticScore)),
    });
  }
  return rows;
}

function parseAiSearchTerms(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const parsed = JSON.parse(stripJsonFence(raw));
  const terms = Array.isArray(parsed?.terms) ? parsed.terms : [];
  const validTerms: string[] = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    const trimmed = term.trim();
    if (!trimmed || trimmed.length > 120) continue;
    validTerms.push(trimmed);
  }
  return [...new Set<string>(validTerms)].slice(0, 8);
}

async function expandHybridSearchTerms(
  query: ItemMatchQuery,
  reportUsage?: CatalogAiUsageReporter,
): Promise<string[]> {
  const cached = await withAiResponseCache<string[]>({
    feature: CATALOG_AI_FEATURE,
    operation: "search_term_expansion",
    cacheVersion: SEARCH_TERMS_CACHE_VERSION,
    input: { invoiceItem: query },
    producer: async () => {
      const startedAt = Date.now();
      try {
        const response = await invokeLLM({
          timeoutMs: CATALOG_AI_TIMEOUT_MS,
          maxTokens: 350,
          messages: [
            {
              role: "system",
              content:
                "أنت مساعد استرجاع لكتالوج CMMS. حوّل وصف الصنف إلى عبارات بحث قصيرة ومرادفات مفيدة بالعربية والإنجليزية. " +
                "ركز على نوع المنتج ووظيفته والمرادفات الشائعة ولا تخترع ماركة أو مقاساً غير موجود في الوصف. " +
                "أعد JSON فقط بالشكل {\"terms\":[\"...\"]} وبحد أقصى 8 عبارات.",
            },
            { role: "user", content: JSON.stringify({ invoiceItem: query }) },
          ],
        });
        reportUsage?.(llmUsageEvent({
          operation: "search_term_expansion",
          response,
          durationMs: Date.now() - startedAt,
          success: true,
        }));
        return parseAiSearchTerms(response.choices?.[0]?.message?.content);
      } catch (error) {
        reportUsage?.(llmUsageEvent({
          operation: "search_term_expansion",
          durationMs: Date.now() - startedAt,
          success: false,
        }));
        throw error;
      }
    },
  });

  if (cached.source !== "producer") {
    reportUsage?.(cachedUsageEvent({
      operation: "search_term_expansion",
      source: cached.source,
    }));
  }
  return cached.value;
}

async function rerankHybridShortlist(params: {
  query: ItemMatchQuery;
  shortlist: CatalogItemCandidateInput[];
  phase: "shortlist" | "fallback";
  reportUsage?: CatalogAiUsageReporter;
}): Promise<AiSemanticScore[]> {
  const { query, shortlist, phase, reportUsage } = params;
  if (!shortlist.length) return [];
  const allowedIds = new Set(shortlist.map(item => item.id));
  const cacheInput = {
    invoiceItem: query,
    catalogCandidates: shortlist.map(item => ({
      catalogItemId: item.id,
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      unit: item.unit,
      manufacturer: item.manufacturer,
    })),
  };

  const cached = await withAiResponseCache<AiSemanticScore[]>({
    feature: CATALOG_AI_FEATURE,
    operation: "semantic_rerank",
    cacheVersion: SEMANTIC_RERANK_CACHE_VERSION,
    input: cacheInput,
    producer: async () => {
      const startedAt = Date.now();
      try {
        const response = await invokeLLM({
          timeoutMs: CATALOG_AI_TIMEOUT_MS,
          maxTokens: 900,
          messages: [
            {
              role: "system",
              content:
                "أنت محرك ترتيب دلالي لأصناف كتالوج CMMS. اختر من القائمة المعطاة فقط الأصناف التي يمكن أن تعني نفس صنف الفاتورة، " +
                "حتى عند اختلاف العربية/الإنجليزية أو ترتيب الكلمات أو الصياغة. لا تخترع catalogItemId ولا تنشئ صنفاً جديداً. " +
                "ركز على نوع المنتج ووظيفته ومعناه والماركة/المصنع إن وُجد؛ المقاسات والوحدات ستُفحص خوارزمياً بعد ردك. " +
                "أعد JSON فقط بالشكل {\"ranked\":[{\"catalogItemId\":123,\"semanticScore\":0.92,\"reason\":\"سبب مختصر\"}]}. " +
                "أعد بحد أقصى 5 مرشحين ولا ترفع semanticScore للتشابه الضعيف.",
            },
            { role: "user", content: JSON.stringify(cacheInput) },
          ],
        });
        reportUsage?.(llmUsageEvent({
          operation: "semantic_rerank",
          phase,
          response,
          durationMs: Date.now() - startedAt,
          success: true,
        }));
        return parseAiRankedRows(response.choices?.[0]?.message?.content, allowedIds);
      } catch (error) {
        reportUsage?.(llmUsageEvent({
          operation: "semantic_rerank",
          phase,
          durationMs: Date.now() - startedAt,
          success: false,
        }));
        throw error;
      }
    },
  });

  if (cached.source !== "producer") {
    reportUsage?.(cachedUsageEvent({
      operation: "semantic_rerank",
      phase,
      source: cached.source,
    }));
  }
  return cached.value;
}

export function shouldExpandHybridSearch(topRetrievalScore: number): boolean {
  return !Number.isFinite(topRetrievalScore) || topRetrievalScore < HYBRID_EXPANSION_TRIGGER_SCORE;
}

function hasReliableHybridResult(matches: RankedCatalogItemMatch[]): boolean {
  return matches.some(match =>
    match.score >= HYBRID_RELIABLE_RESULT_SCORE && match.measurementStatus !== "conflict",
  );
}

/**
 * 2B-3 hybrid semantic discovery tuned after UAT:
 * 1) supplier memory/deterministic evidence remains first,
 * 2) the server builds a wider local fuzzy shortlist from the active Catalog,
 * 3) local retrieval below 0.72 is not considered strong enough by itself; DeepSeek
 *    first expands Arabic/English search terms and the shortlist is rebuilt,
 * 4) DeepSeek reranks the resulting shortlist,
 * 5) only when no reliable non-conflicting result survives, one wider fallback
 *    shortlist is reranked instead of scanning the whole Catalog in many batches.
 *
 * Typical ambiguous item: up to two DeepSeek calls (expansion + rerank).
 * A difficult failed rerank may use one additional wide fallback call.
 * AI never auto-selects and measurement checks remain deterministic.
 */
export async function applyAiSemanticDiscovery(params: {
  query: ItemMatchQuery;
  catalogItems: CatalogItemCandidateInput[];
  deterministicCandidates: RankedCatalogItemMatch[];
  limit?: number;
  reportUsage?: CatalogAiUsageReporter;
}): Promise<RankedCatalogItemMatch[]> {
  const { query, catalogItems, deterministicCandidates, limit = 5, reportUsage } = params;
  const top = deterministicCandidates[0];

  if (top && (
    top.reason === "supplier_code_exact" ||
    top.reason === "supplier_alias_exact" ||
    top.score >= 92
  )) {
    return deterministicCandidates;
  }
  if (catalogItems.length === 0) return deterministicCandidates;

  try {
    let extraSearchTerms: string[] = [];
    let expanded = false;
    let shortlist = buildHybridCatalogShortlist({
      query,
      catalogItems,
      deterministicCandidates,
      size: HYBRID_SHORTLIST_SIZE,
    });

    if (shouldExpandHybridSearch(shortlist.topRetrievalScore)) {
      try {
        extraSearchTerms = await expandHybridSearchTerms(query, reportUsage);
        if (extraSearchTerms.length) {
          shortlist = buildHybridCatalogShortlist({
            query,
            catalogItems,
            deterministicCandidates,
            extraSearchTerms,
            size: HYBRID_EXPANDED_SHORTLIST_SIZE,
          });
          expanded = true;
        }
      } catch (error) {
        console.warn("[CatalogItemMatch] AI search-term expansion unavailable; local shortlist kept", error);
      }
    }

    console.info(
      `[CatalogItemMatch] Hybrid shortlist ${shortlist.items.length}/${catalogItems.length}; ` +
      `localTop=${shortlist.topRetrievalScore.toFixed(2)}; expanded=${expanded ? "yes" : "no"}; fallback=no`,
    );

    const firstAiScores = await rerankHybridShortlist({ query, shortlist: shortlist.items, phase: "shortlist", reportUsage });
    logHybridDiagnostics({ phase: "shortlist", shortlist, aiScores: firstAiScores });
    let merged = mergeAiSemanticDiscoveryResults({
      query,
      catalogItems,
      deterministicCandidates,
      aiScores: firstAiScores,
      limit,
    });
    const firstLocalFallback = buildStrongLocalFallbackMatch({ query, shortlist });

    if (hasReliableHybridResult(merged)) {
      return merged;
    }
    if (catalogItems.length <= shortlist.items.length) {
      return mergeStrongLocalFallback(merged, firstLocalFallback, limit);
    }

    // إذا كان البحث المحلي نفسه قويًا (>= 0.85) لكن DeepSeek لم يُرجع
    // نتيجة موثوقة، لا نسقط الدليل المحلي ولا ندفع طلب fallback إضافيًا.
    // نعرضه كاقتراح للمستخدم فقط؛ لا Auto-link.
    if (firstLocalFallback) {
      return mergeStrongLocalFallback(merged, firstLocalFallback, limit);
    }

    // If the first rerank still has no reliable result, widen once. If expansion was
    // skipped because lexical retrieval looked deceptively strong, generate semantic
    // search terms now before the fallback so a wrong localTop cannot block recall.
    if (!expanded && extraSearchTerms.length === 0) {
      try {
        extraSearchTerms = await expandHybridSearchTerms(query, reportUsage);
        expanded = extraSearchTerms.length > 0;
      } catch (error) {
        console.warn("[CatalogItemMatch] AI fallback search-term expansion unavailable", error);
      }
    }

    const fallbackShortlist = buildHybridCatalogShortlist({
      query,
      catalogItems,
      deterministicCandidates,
      extraSearchTerms,
      size: HYBRID_WIDE_FALLBACK_SIZE,
    });

    console.info(
      `[CatalogItemMatch] Hybrid fallback ${fallbackShortlist.items.length}/${catalogItems.length}; ` +
      `localTop=${fallbackShortlist.topRetrievalScore.toFixed(2)}; expanded=${expanded ? "yes" : "no"}; fallback=yes`,
    );

    const fallbackAiScores = await rerankHybridShortlist({ query, shortlist: fallbackShortlist.items, phase: "fallback", reportUsage });
    logHybridDiagnostics({ phase: "fallback", shortlist: fallbackShortlist, aiScores: fallbackAiScores });
    merged = mergeAiSemanticDiscoveryResults({
      query,
      catalogItems,
      deterministicCandidates,
      aiScores: [...firstAiScores, ...fallbackAiScores],
      limit,
    });
    const fallbackLocal = buildStrongLocalFallbackMatch({ query, shortlist: fallbackShortlist });
    return mergeStrongLocalFallback(merged, fallbackLocal, limit);
  } catch (error) {
    console.warn("[CatalogItemMatch] AI hybrid semantic discovery unavailable; deterministic ranking kept", error);
    return deterministicCandidates;
  }
}

/**
 * Backwards-compatible alias for callers that still only provide a small candidate
 * set. New 2B-3 code should use applyAiSemanticDiscovery with the active Catalog.
 */
export async function applyAiSemanticFallback(params: {
  query: ItemMatchQuery;
  candidates: RankedCatalogItemMatch[];
}): Promise<RankedCatalogItemMatch[]> {
  const catalogItems: CatalogItemCandidateInput[] = params.candidates.map(candidate => ({
    id: candidate.catalogItemId,
    code: candidate.code,
    nameAr: candidate.nameAr,
    nameEn: candidate.nameEn,
    unit: candidate.unit,
  }));
  return applyAiSemanticDiscovery({
    query: params.query,
    catalogItems,
    deterministicCandidates: params.candidates,
    limit: params.candidates.length || 5,
  });
}
