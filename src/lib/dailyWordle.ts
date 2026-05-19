// Server-only: picks today's Wordle word from a live dictionary corpus
// (Datamuse) and caches it in memory until the next UTC day rolls over.
//
//   - Datamuse returns up to 1000 5-letter English words sorted by frequency.
//   - We hash the UTC date → deterministic index so everyone on this server
//     gets the same word for the same day.
//   - Cache is in-memory only. Worst case after a restart is one extra
//     Datamuse call that day; the day's word stays stable because the
//     index is derived from the date, not from the API response order.
//
// Fallback list covers the API being unreachable so the game never breaks.

const FALLBACK = [
  "apple", "brave", "crane", "earth", "flame", "ghost", "horse", "input",
  "knife", "lemon", "mango", "noble", "ocean", "piano", "river", "stone",
  "tiger", "whale", "amber", "frost",
];

let cachedKey: string | null = null;
let cachedWord: string | null = null;
let cachedCorpus: string[] | null = null;

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function fetchCorpus(): Promise<string[]> {
  try {
    const res = await fetch("https://api.datamuse.com/words?sp=?????&max=1000");
    if (!res.ok) return FALLBACK;
    const data = (await res.json()) as Array<{ word: string }>;
    const valid = data
      .map((d) => d.word.toLowerCase())
      .filter((w) => /^[a-z]{5}$/.test(w));
    return valid.length > 0 ? valid : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export async function getTodaysWordleWord(): Promise<string> {
  const key = todayKey();
  if (cachedKey === key && cachedWord) return cachedWord;
  if (!cachedCorpus || cachedCorpus.length === 0) {
    cachedCorpus = await fetchCorpus();
  }
  const word = cachedCorpus[hashKey(key) % cachedCorpus.length];
  cachedKey = key;
  cachedWord = word;
  return word;
}
