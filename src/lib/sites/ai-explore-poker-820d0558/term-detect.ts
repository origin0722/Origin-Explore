/**
 * Explore — document term detection (client-side heuristics + glossary).
 * Layer 1 of the term pipeline: candidate extraction. Personalization
 * (asked/mastered states) lives in app-context termStates; real AI term
 * understanding is a future BYOK layer — this stays as the offline fallback.
 */
import { GLOSSARY } from "./mock";

export interface TermCandidate {
  term: string;
  score: number;
  kind: "glossary" | "heuristic";
}

/** ~150 common English words never treated as terms. */
const STOPWORDS = new Set(
  `a an the and or but if then else for with without from into onto over under of in on at by to is are was were be been being am do does did have has had will would can could shall should may might must ought need dare used get got getting give given making made take taken using used about above after again against all almost along also always among any anyone anything around as because before behind below beneath beside between beyond both both but by case certain come could dear did different do does doing done down each either else every everyone everything few first for from further get got great had has have having he her here hers herself him himself his how however i if in into is it its itself just know last least less let like likely long made make many may me might more most much must my myself near need never new next no none not nothing now of off often old on once one only or other our ours ourselves out over own per put rather same say see seem seemed seeming seen several shall she should since so some somebody someone something sometimes still such than that the their theirs them themselves then there therefore these they this those though through throughout thus till to too toward under unless until up upon us used usual via was way we well were what whatever when where whereas wherever whether which while who whoever whom whose why will with within without would yes yet you your yours yourself yourselves`.split(
    /\s+/
  )
);

/** Technical-ish suffixes: -ics, -ism, -ology, -ance, -tion, -ment, -phism … */
const TECH_SUFFIX = /(ics|ism|ology|ography|ometry|ometry|ation|ition|ence|ance|ment|phism|stats|netics|matrix|field|state|theory|lemma|theorem)$/i;

const CJK_RE = /[一-鿿]{2,}/g;
const LATIN_RE = /[A-Za-z][A-Za-z'-]{2,}/g;

/** Split a paper into paragraphs (for section-weighting). */
function paragraphs(text: string): string[] {
  return text.split(/\n{2,}|\r\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

/**
 * Extract candidate terms from a document.
 * Glossary hits always qualify; other words qualify by frequency +
 * technical-shape heuristics. Returns sorted by score, top `limit`.
 */
export function detectTerms(text: string, limit = 60): TermCandidate[] {
  const paragraphsList = paragraphs(text);
  const head = paragraphsList.slice(0, Math.max(3, Math.floor(paragraphsList.length * 0.1)));
  const headText = head.join(" ");

  // ---- glossary matches (en + zh) ----
  const glossary: TermCandidate[] = [];
  for (const g of GLOSSARY) {
    const enRe = new RegExp(`\\b${escapeRe(g.en)}\\b`, "gi");
    const zhRe = new RegExp(escapeRe(g.zh), "g");
    const enHits = (text.match(enRe) ?? []).length;
    const zhHits = (text.match(zhRe) ?? []).length;
    const hits = enHits + zhHits;
    if (hits > 0) {
      const inHead = enRe.test(headText) || zhRe.test(headText);
      glossary.push({
        term: g.zh,
        score: 10 + Math.min(hits, 8) + (inHead ? 3 : 0),
        kind: "glossary",
      });
    }
  }

  // ---- frequency-based heuristic ----
  const freq = new Map<string, number>();
  const headFreq = new Map<string, number>();
  const upperCount = new Map<string, number>();
  const count = (map: Map<string, number>, w: string) => map.set(w, (map.get(w) ?? 0) + 1);

  for (const m of text.matchAll(LATIN_RE)) {
    const w = m[0];
    const key = w.toLowerCase();
    count(freq, key);
    if (/[A-Z]/.test(w)) count(upperCount, key);
  }
  for (const m of headText.matchAll(LATIN_RE)) count(headFreq, m[0].toLowerCase());

  const heuristic: TermCandidate[] = [];
  const total = text.length;
  for (const [word, n] of freq) {
    if (STOPWORDS.has(word) || word.length < 4 || n < 2 || n > 40) continue;
    // 技术词特征：标题式大写出现、学科后缀、首字母缩写
    let score = 0;
    if ((upperCount.get(word) ?? 0) >= 1) score += 4; // 文中以大写形式出现（名词性）
    if (TECH_SUFFIX.test(word)) score += 3;
    if ((headFreq.get(word) ?? 0) > 0) score += 2; // 出现在开头/摘要区
    if (word.length >= 10) score += 1;
    score += Math.min(n, 6);
    if (score < 6) continue;
    heuristic.push({ term: word, score, kind: "heuristic" });
  }

  // CJK 连续词（中文论文）
  for (const m of text.matchAll(CJK_RE)) {
    const w = m[0];
    if (w.length > 14) continue;
    const n = (text.match(new RegExp(escapeRe(w), "g")) ?? []).length;
    if (n >= 2) heuristic.push({ term: w, score: Math.min(n, 6) + 1, kind: "heuristic" });
  }

  const all = [...glossary, ...heuristic];
  const seen = new Set<string>();
  const unique = all
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      if (seen.has(c.term.toLowerCase())) return false;
      seen.add(c.term.toLowerCase());
      return true;
    })
    .slice(0, limit);
  return unique;
}

/** Highlight-safe regex escape. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
