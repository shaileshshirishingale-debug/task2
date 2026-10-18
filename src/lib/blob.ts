import { put } from '@vercel/blob';
import crypto from 'crypto';

export interface VercelBlobUploadResult {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
  contentHash: string;
  fromCache: boolean;
}

export interface BlobCacheStats {
  entries: number;
  hits: number;
  misses: number;
  savedRequests: number;
  cacheControlMaxAgeSeconds: number;
}

interface CachedBlobEntry {
  result: Omit<VercelBlobUploadResult, 'fromCache'>;
  rawContent: string;
  cachedAt: number;
  hitCount: number;
}

export type BlobUploaderFn = (
  filename: string,
  content: string | Buffer,
  options: {
    access: 'public';
    contentType: string;
    token: string;
    cacheControlMaxAge: number;
  }
) => Promise<{ url: string; pathname: string; contentType: string }>;

const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in-memory TTL
const EDGE_CACHE_MAX_AGE_SECONDS = 31536000; // 1 year immutable CDN cache for snapshots

const hashCache = new Map<string, CachedBlobEntry>();
const urlToHashCache = new Map<string, string>();

let cacheHits = 0;
let cacheMisses = 0;

/**
 * Computes a deterministic SHA-256 hash of export content while stripping volatile
 * timestamps (like `"exported_at": "..."`) so identical program states reuse the cached blob.
 */
export function computeBlobCacheKey(
  content: string | Buffer,
  contentType: string = 'text/plain',
  customCacheKey?: string
): string {
  if (customCacheKey) {
    return crypto.createHash('sha256').update(`${contentType}:${customCacheKey}`).digest('hex');
  }

  const rawStr = typeof content === 'string' ? content : content.toString('utf-8');
  const normalized = rawStr.replace(/"exported_at"\s*:\s*"[^"]*"/g, '"exported_at":"NORMALIZED"');
  return crypto.createHash('sha256').update(`${contentType}:${normalized}`).digest('hex');
}

function evictExpiredOrOverflow(): void {
  const now = Date.now();
  for (const [key, entry] of hashCache.entries()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      urlToHashCache.delete(entry.result.url);
      hashCache.delete(key);
    }
  }

  while (hashCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = hashCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = hashCache.get(oldestKey);
    if (oldest) {
      urlToHashCache.delete(oldest.result.url);
    }
    hashCache.delete(oldestKey);
  }
}

const defaultUploader: BlobUploaderFn = async (filename, content, options) => {
  const blob = await put(filename, content, options);
  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: blob.contentType || options.contentType,
  };
};

let activeUploader: BlobUploaderFn = defaultUploader;

export const blobStorage = {
  isConfigured(): boolean {
    return !!process.env.BLOB_READ_WRITE_TOKEN;
  },

  setUploaderForTesting(uploader: BlobUploaderFn | null): void {
    activeUploader = uploader || defaultUploader;
  },

  clearCache(): void {
    hashCache.clear();
    urlToHashCache.clear();
    cacheHits = 0;
    cacheMisses = 0;
  },

  getCacheStats(): BlobCacheStats {
    return {
      entries: hashCache.size,
      hits: cacheHits,
      misses: cacheMisses,
      savedRequests: cacheHits,
      cacheControlMaxAgeSeconds: EDGE_CACHE_MAX_AGE_SECONDS,
    };
  },

  getCachedContentByHash(contentHash: string): { rawContent: string; contentType: string; url: string } | null {
    const entry = hashCache.get(contentHash);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      urlToHashCache.delete(entry.result.url);
      hashCache.delete(contentHash);
      return null;
    }
    cacheHits++;
    entry.hitCount++;
    return {
      rawContent: entry.rawContent,
      contentType: entry.result.contentType,
      url: entry.result.url,
    };
  },

  getCachedContentByUrl(url: string): { rawContent: string; contentType: string; contentHash: string } | null {
    const hash = urlToHashCache.get(url);
    if (!hash) return null;
    const entry = hashCache.get(hash);
    if (!entry) return null;
    cacheHits++;
    entry.hitCount++;
    return {
      rawContent: entry.rawContent,
      contentType: entry.result.contentType,
      contentHash: hash,
    };
  },

  /**
   * Uploads file/data to Vercel Blob securely on server-side with SHA-256 content-hash
   * deduplication and long-lived Edge Cache-Control headers to minimize Vercel Blob requests.
   */
  async uploadFile(
    filename: string,
    content: string | Buffer,
    contentType: string = 'text/plain',
    options?: { cacheKey?: string; bypassCache?: boolean }
  ): Promise<VercelBlobUploadResult> {
    const contentHash = computeBlobCacheKey(content, contentType, options?.cacheKey);
    const rawStr = typeof content === 'string' ? content : content.toString('utf-8');
    const byteSize = typeof content === 'string' ? Buffer.byteLength(content) : content.length;

    if (!options?.bypassCache) {
      const existing = hashCache.get(contentHash);
      if (existing && Date.now() - existing.cachedAt <= CACHE_TTL_MS) {
        cacheHits++;
        existing.hitCount++;
        return {
          ...existing.result,
          fromCache: true,
        };
      }
    }

    cacheMisses++;
    evictExpiredOrOverflow();

    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (token) {
      try {
        const blob = await activeUploader(filename, content, {
          access: 'public',
          contentType,
          token,
          cacheControlMaxAge: EDGE_CACHE_MAX_AGE_SECONDS,
        });

        const resultObj: Omit<VercelBlobUploadResult, 'fromCache'> = {
          url: blob.url,
          pathname: blob.pathname,
          contentType: blob.contentType,
          size: byteSize,
          contentHash,
        };

        hashCache.set(contentHash, {
          result: resultObj,
          rawContent: rawStr,
          cachedAt: Date.now(),
          hitCount: 0,
        });
        urlToHashCache.set(blob.url, contentHash);

        return {
          ...resultObj,
          fromCache: false,
        };
      } catch (err) {
        console.warn('Vercel Blob upload failed, falling back to local data URI snapshot:', err);
      }
    }

    // Fallback mode when BLOB_READ_WRITE_TOKEN is not configured or unreachable
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    const fallbackResult: Omit<VercelBlobUploadResult, 'fromCache'> = {
      url: dataUrl,
      pathname: `local-dev/${filename}`,
      contentType,
      size: buffer.length,
      contentHash,
    };

    hashCache.set(contentHash, {
      result: fallbackResult,
      rawContent: rawStr,
      cachedAt: Date.now(),
      hitCount: 0,
    });
    urlToHashCache.set(dataUrl, contentHash);

    return {
      ...fallbackResult,
      fromCache: false,
    };
  },
};
