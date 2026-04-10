/**
 * @fileoverview Swagger/OpenAPI schema loader with in-memory and localStorage caching.
 */

import { cacheKey, hasLocalStorage, joinUrl } from './utils.js';

/** Cache version — increment to bust all cached schemas */
const CACHE_VERSION = '1';
const LOCAL_STORAGE_VERSION_KEY = 'liferay_sdk_cache_version';

/**
 * Loads and caches OpenAPI/Swagger JSON definitions.
 */
export class SwaggerLoader {
  constructor() {
    /** @type {Map<string, object>} In-memory cache keyed by URL */
    this._memoryCache = new Map();
    this._initLocalStorageVersion();
  }

  /**
   * Bust localStorage cache if version has changed.
   * @private
   */
  _initLocalStorageVersion() {
    if (!hasLocalStorage()) return;
    try {
      const storedVersion = localStorage.getItem(LOCAL_STORAGE_VERSION_KEY);
      if (storedVersion !== CACHE_VERSION) {
        this._clearLocalStorageCache();
        localStorage.setItem(LOCAL_STORAGE_VERSION_KEY, CACHE_VERSION);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Removes all liferay_sdk_schema_* keys from localStorage.
   * @private
   */
  _clearLocalStorageCache() {
    if (!hasLocalStorage()) return;
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('liferay_sdk_schema_'));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  /**
   * Fetches a single OpenAPI schema JSON from the given URL.
   * Uses in-memory cache first, then localStorage, then network.
   *
   * @param {string} schemaUrl - Absolute or relative URL
   * @param {string} [baseUrl] - Base URL to prefix relative schemaUrl
   * @param {Record<string, string>} [authHeaders] - Optional auth headers
   * @returns {Promise<object>} Parsed OpenAPI schema object
   */
  async load(schemaUrl, baseUrl = '', authHeaders = {}) {
    const absoluteUrl = schemaUrl.startsWith('http') ? schemaUrl : joinUrl(baseUrl, schemaUrl);
    const key = cacheKey(absoluteUrl);

    // 1. In-memory cache
    if (this._memoryCache.has(key)) {
      return this._memoryCache.get(key);
    }

    // 2. localStorage cache
    const fromStorage = this._readFromLocalStorage(key);
    if (fromStorage) {
      this._memoryCache.set(key, fromStorage);
      return fromStorage;
    }

    // 3. Network fetch
    const schema = await this._fetchSchema(absoluteUrl, authHeaders);
    this._memoryCache.set(key, schema);
    this._writeToLocalStorage(key, schema);
    return schema;
  }

  /**
   * Loads multiple schema URLs in parallel.
   *
   * @param {string[]} schemaUrls
   * @param {string} baseUrl
   * @param {Record<string, string>} [authHeaders]
   * @returns {Promise<Array<{ url: string, schema: object }>>}
   */
  async loadAll(schemaUrls, baseUrl, authHeaders = {}) {
    const results = await Promise.allSettled(
      schemaUrls.map(async (url) => ({
        url,
        schema: await this.load(url, baseUrl, authHeaders),
      }))
    );

    const schemas = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        schemas.push(result.value);
      } else {
        console.warn(`[LiferaySDK] Failed to load schema: ${result.reason?.message}`);
      }
    }
    return schemas;
  }

  /**
   * Clears both in-memory and localStorage caches.
   */
  clearCache() {
    this._memoryCache.clear();
    this._clearLocalStorageCache();
  }

  /**
   * Invalidate cache for a single URL.
   * @param {string} absoluteUrl
   */
  invalidate(absoluteUrl) {
    const key = cacheKey(absoluteUrl);
    this._memoryCache.delete(key);
    if (hasLocalStorage()) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * @private
   */
  async _fetchSchema(url, authHeaders) {
    const headers = { Accept: 'application/json', ...authHeaders };
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch OpenAPI schema from ${url}: HTTP ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && !contentType.includes('text/')) {
      throw new Error(`Unexpected content-type "${contentType}" from ${url}`);
    }

    return response.json();
  }

  /**
   * @private
   * @param {string} key
   * @returns {object | null}
   */
  _readFromLocalStorage(key) {
    if (!hasLocalStorage()) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * @private
   * @param {string} key
   * @param {object} schema
   */
  _writeToLocalStorage(key, schema) {
    if (!hasLocalStorage()) return;
    try {
      localStorage.setItem(key, JSON.stringify(schema));
    } catch {
      // Ignore quota errors
    }
  }
}
