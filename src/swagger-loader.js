/**
 * Swagger/OpenAPI schema loader with memory + persistent caching.
 */

import { cacheKey, hasLocalStorage, resolveUrl } from './utils.js';

const CACHE_VERSION = '1';
const CACHE_VERSION_KEY = 'liferay_sdk_cache_version';
const CACHE_PREFIX = 'liferay_sdk_schema_';

export class SwaggerLoader {
  constructor(authManager = null) {
    this._memoryCache = new Map();
    this._authManager = authManager;

    this._storageAvailable = hasLocalStorage();
    this._syncCacheVersion();
  }

  setAuthManager(authManager) {
    this._authManager = authManager;
  }

  /* -------------------------------------------------------------------------- */
  /* Public API                                                               */
  /* -------------------------------------------------------------------------- */

  async load(schemaUrl, baseUrl = '') {
    const url = resolveUrl(schemaUrl, baseUrl);
    const key = cacheKey(url);

    return this._fromMemory(key) || this._fromStorage(key) || (await this._fetchAndCache(url, key));
  }

  async loadAll(schemaUrls, baseUrl) {
    const results = [];

    for (const url of schemaUrls) {
      const schema = await this.load(url, baseUrl);
      if (schema) {
        results.push({ url, schema });
      }
    }

    return results;
  }

  clearCache() {
    this._memoryCache.clear();
    this._clearStorage();
  }

  invalidate(absoluteUrl) {
    const key = cacheKey(absoluteUrl);

    this._memoryCache.delete(key);
    this._removeFromStorage(key);
  }

  /* -------------------------------------------------------------------------- */
  /* Memory cache                                                            */
  /* -------------------------------------------------------------------------- */

  _fromMemory(key) {
    return this._memoryCache.get(key) || null;
  }

  _setMemory(key, value) {
    this._memoryCache.set(key, value);
  }

  /* -------------------------------------------------------------------------- */
  /* Local storage cache                                                     */
  /* -------------------------------------------------------------------------- */

  _fromStorage(key) {
    if (!this._storageAvailable) return null;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      this._setMemory(key, parsed);

      return parsed;
    } catch {
      return null;
    }
  }

  _setStorage(key, value) {
    if (!this._storageAvailable) return;

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / serialization errors
    }
  }

  _removeFromStorage(key) {
    if (!this._storageAvailable) return;

    try {
      localStorage.removeItem(key);
    } catch {}
  }

  _clearStorage() {
    if (!this._storageAvailable) return;

    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  }

  /* -------------------------------------------------------------------------- */
  /* Fetch + persistence                                                      */
  /* -------------------------------------------------------------------------- */

  async _fetchAndCache(url, key) {
    const schema = await this._fetch(url);

    if (!schema) return null;

    this._setMemory(key, schema);
    this._setStorage(key, schema);

    return schema;
  }

  async _fetch(url) {
    const headers = await this._buildHeaders();

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.log(`Failed to fetch schema (${response.status}): ${url}`);
        return;
      }

      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        console.log(`Invalid content-type "${contentType}" from ${url}`);
        return;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  async _buildHeaders() {
    let headers = { Accept: 'application/json' };

    if (this._authManager) {
      headers = await this._authManager.injectAuthHeaders(headers);
    }

    return headers;
  }

  /* -------------------------------------------------------------------------- */
  /* Cache versioning                                                         */
  /* -------------------------------------------------------------------------- */

  _syncCacheVersion() {
    if (!this._storageAvailable) return;

    try {
      const stored = localStorage.getItem(CACHE_VERSION_KEY);

      if (stored !== CACHE_VERSION) {
        this._clearStorage();
        localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
      }
    } catch {}
  }
}
