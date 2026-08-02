import { LRUCache } from "lru-cache";
import { logger } from "../utils/logger.js";

const queryCache = new LRUCache({
  max: 500, // Maximum 500 cached entries
  ttl: 1000 * 60 * 60, // 1 Hour TTL
});

export function getCachedQuery(key) {
  const normalizedKey = key.toLowerCase().trim();
  const cached = queryCache.get(normalizedKey);
  if (cached) {
    logger.info({ key: normalizedKey }, "Cache Hit: Retrospective query retrieved from LRU Cache.");
    return cached;
  }
  return null;
}

export function setCachedQuery(key, value) {
  const normalizedKey = key.toLowerCase().trim();
  queryCache.set(normalizedKey, value);
  logger.info({ key: normalizedKey }, "Cache Store: Query response cached in LRU Cache.");
}

export function clearQueryCache() {
  queryCache.clear();
}
