import test from 'node:test';
import assert from 'node:assert/strict';
import { blobStorage, computeBlobCacheKey } from './blob.ts';

test('computeBlobCacheKey normalizes volatile exported_at timestamps', () => {
  const payloadA = JSON.stringify({
    version: '1.0',
    exported_at: '2026-10-18T10:00:00.000Z',
    stats: { totalXP: 100 },
  });
  const payloadB = JSON.stringify({
    version: '1.0',
    exported_at: '2026-10-18T14:30:00.000Z',
    stats: { totalXP: 100 },
  });
  const payloadC = JSON.stringify({
    version: '1.0',
    exported_at: '2026-10-18T14:30:00.000Z',
    stats: { totalXP: 110 },
  });

  const hashA = computeBlobCacheKey(payloadA, 'application/json');
  const hashB = computeBlobCacheKey(payloadB, 'application/json');
  const hashC = computeBlobCacheKey(payloadC, 'application/json');

  assert.equal(hashA, hashB, 'Identical data with different exported_at timestamps must produce the same hash');
  assert.notEqual(hashA, hashC, 'Changed data must produce a different hash');
});

test('blobStorage.uploadFile deduplicates identical uploads via cache and passes cacheControlMaxAge', async () => {
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = 'test_blob_token';
  blobStorage.clearCache();

  let uploadCalls = 0;
  let capturedMaxAge = 0;

  blobStorage.setUploaderForTesting(async (filename, _content, options) => {
    uploadCalls++;
    capturedMaxAge = options.cacheControlMaxAge;
    return {
      url: `https://example.public.blob.vercel-storage.com/${filename}`,
      pathname: filename,
      contentType: options.contentType,
    };
  });

  try {
    const json1 = JSON.stringify({ exported_at: '2026-10-18T01:00:00Z', tasks: [{ id: 't1', completed: true }] });
    const json2 = JSON.stringify({ exported_at: '2026-10-18T02:00:00Z', tasks: [{ id: 't1', completed: true }] });

    const firstRes = await blobStorage.uploadFile('export_1.json', json1, 'application/json');
    assert.equal(firstRes.fromCache, false);
    assert.equal(uploadCalls, 1);
    assert.equal(capturedMaxAge, 31536000);

    // Second upload with identical data (except volatile exported_at) should be served from cache!
    const secondRes = await blobStorage.uploadFile('export_2.json', json2, 'application/json');
    assert.equal(secondRes.fromCache, true);
    assert.equal(uploadCalls, 1, 'Uploader must not be called a second time for identical content');
    assert.equal(secondRes.url, firstRes.url);
    assert.equal(secondRes.contentHash, firstRes.contentHash);

    // Verify cache stats and content lookup
    const stats = blobStorage.getCacheStats();
    assert.equal(stats.entries, 1);
    assert.equal(stats.hits, 1);
    assert.equal(stats.misses, 1);
    assert.equal(stats.savedRequests, 1);

    const cachedByUrl = blobStorage.getCachedContentByUrl(firstRes.url);
    assert.ok(cachedByUrl);
    assert.equal(cachedByUrl.contentType, 'application/json');
  } finally {
    blobStorage.setUploaderForTesting(null);
    blobStorage.clearCache();
    if (prevToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = prevToken;
    }
  }
});
