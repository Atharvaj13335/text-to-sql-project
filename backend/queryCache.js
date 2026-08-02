import { LRUCache } from "lru-cache";

// LRU Cache for SQL generation — max 500 items, TTL 1 hour
const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

/**
 * Normalize question string by trimming, lowercasing, and removing redundant spaces.
 */
export function normalizeQuestion(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getCachedQuery(question) {
  const key = normalizeQuestion(question);
  return cache.get(key) || null;
}

export function setCachedQuery(question, resultData) {
  const key = normalizeQuestion(question);
  cache.set(key, resultData);
}

export function clearQueryCache() {
  cache.clear();
}
