/**
 * @fileoverview HTTP transport layer with retry logic, timeout, interceptors,
 * multipart/form-data, and standardized error handling.
 */

import { LiferayAPIError, LiferayNetworkError, LiferayTimeoutError } from './errors.js';
import { buildQueryString, joinUrl, sleep } from './utils.js';

/** @type {number} Default number of retry attempts for transient errors */
const DEFAULT_RETRIES = 2;
/** @type {number} Base delay in ms for exponential backoff */
const RETRY_BASE_DELAY = 300;

/**
 * Core HTTP client for the Liferay SDK.
 */
export class HttpClient {
  /**
   * @param {object} options
   * @param {string} options.baseUrl
   * @param {number} [options.timeout=30000] - Request timeout in ms
   * @param {number} [options.retries=2] - Number of retries on transient failures
   * @param {import('./auth.js').AuthManager} options.auth
   */
  constructor({ baseUrl, timeout = 30000, retries = DEFAULT_RETRIES, auth }) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.retries = retries;
    this.auth = auth;

    /** @type {Array<(config: object) => object | Promise<object>>} */
    this._requestInterceptors = [];
    /** @type {Array<(response: object) => object | Promise<object>>} */
    this._responseInterceptors = [];
  }

  /**
   * Register a request interceptor.
   * @param {(config: object) => object | Promise<object>} fn
   */
  addRequestInterceptor(fn) {
    this._requestInterceptors.push(fn);
  }

  /**
   * Register a response interceptor.
   * @param {(response: object) => object | Promise<object>} fn
   */
  addResponseInterceptor(fn) {
    this._responseInterceptors.push(fn);
  }

  /**
   * Execute an HTTP request.
   *
   * @param {object} config
   * @param {string} config.method - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param {string} config.path - Path relative to baseUrl (already interpolated)
   * @param {Record<string, *>} [config.query] - Query parameters
   * @param {*} [config.body] - Request body (object → JSON, FormData → multipart)
   * @param {Record<string, string>} [config.headers] - Additional headers
   * @returns {Promise<{ status: number, data: *, headers: Headers }>}
   */
  async request(config) {
    // Run request interceptors
    let finalConfig = { ...config };
    for (const interceptor of this._requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }

    const { method, path, query = {}, body, headers: extraHeaders = {} } = finalConfig;

    // Build URL
    const qs = buildQueryString(query);
    const fullPath = qs ? `${path}?${qs}` : path;
    const url = joinUrl(this.baseUrl, fullPath);

    // Build headers
    const headers = { ...extraHeaders };
    this.auth.injectAuthHeaders(headers);

    // Determine content type and body
    let fetchBody;
    if (body instanceof FormData) {
      // Let fetch set content-type with boundary automatically
      fetchBody = body;
    } else if (body !== undefined && body !== null) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      fetchBody = JSON.stringify(body);
    }

    // Retry loop
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt - 1));
      }
      try {
        const result = await this._fetchWithTimeout({ url, method, headers, body: fetchBody });

        // Run response interceptors
        let finalResult = result;
        for (const interceptor of this._responseInterceptors) {
          finalResult = await interceptor(finalResult);
        }

        return finalResult;
      } catch (err) {
        lastError = err;

        // Don't retry on 4xx client errors
        if (err instanceof LiferayAPIError && err.statusCode < 500) {
          throw err;
        }
        // Don't retry on timeout if we've exhausted attempts
        if (attempt === this.retries) {
          throw err;
        }
      }
    }

    throw lastError;
  }

  /**
   * Wraps fetch with a timeout using AbortController.
   * @private
   */
  async _fetchWithTimeout({ url, method, headers, body }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      return await this._parseResponse(response, url);
    } catch (err) {
      clearTimeout(timer);

      if (err.name === 'AbortError') {
        throw new LiferayTimeoutError(url, this.timeout);
      }
      if (err instanceof LiferayAPIError || err instanceof LiferayTimeoutError) {
        throw err;
      }
      throw new LiferayNetworkError(err.message || 'Network request failed', url, err);
    }
  }

  /**
   * Parses an HTTP Response into a standardized object.
   * @private
   * @param {Response} response
   * @param {string} url
   * @returns {Promise<{ status: number, data: *, headers: Headers }>}
   */
  async _parseResponse(response, url) {
    const contentType = response.headers.get('content-type') || '';
    let data;

    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new LiferayAPIError({
        statusCode: response.status,
        message: (data && (data.message || data.title)) || response.statusText || 'API Error',
        endpoint: url,
        responseBody: data,
      });
    }

    return { status: response.status, data, headers: response.headers };
  }

  // ─── Convenience methods ────────────────────────────────────────────────────

  /** @param {string} path @param {object} [query] @param {object} [headers] */
  get(path, query, headers) {
    return this.request({ method: 'GET', path, query, headers });
  }

  /** @param {string} path @param {*} body @param {object} [query] @param {object} [headers] */
  post(path, body, query, headers) {
    return this.request({ method: 'POST', path, body, query, headers });
  }

  /** @param {string} path @param {*} body @param {object} [query] @param {object} [headers] */
  put(path, body, query, headers) {
    return this.request({ method: 'PUT', path, body, query, headers });
  }

  /** @param {string} path @param {*} body @param {object} [query] @param {object} [headers] */
  patch(path, body, query, headers) {
    return this.request({ method: 'PATCH', path, body, query, headers });
  }

  /** @param {string} path @param {object} [query] @param {object} [headers] */
  delete(path, query, headers) {
    return this.request({ method: 'DELETE', path, query, headers });
  }
}
