/**
 * HTTP transport layer with retry, timeout, interceptors, and error normalization.
 */

import { LiferayAPIError, LiferayNetworkError, LiferayTimeoutError } from './errors.js';
import { buildQueryString, resolveUrl, sleep } from './utils.js';

const DEFAULT_RETRIES = 2;
const RETRY_BASE_DELAY = 300;

export class HttpClient {
  constructor({ baseUrl, timeout = 30000, retries = DEFAULT_RETRIES, auth }) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.retries = retries;
    this.auth = auth;

    this._requestInterceptors = [];
    this._responseInterceptors = [];
  }

  /* -------------------------------------------------------------------------- */
  /* Interceptors                                                              */
  /* -------------------------------------------------------------------------- */

  addRequestInterceptor(fn) {
    this._requestInterceptors.push(fn);
  }

  addResponseInterceptor(fn) {
    this._responseInterceptors.push(fn);
  }

  async _runRequestInterceptors(config) {
    let next = config;
    for (const fn of this._requestInterceptors) {
      next = await fn(next);
    }
    return next;
  }

  async _runResponseInterceptors(response) {
    let next = response;
    for (const fn of this._responseInterceptors) {
      next = await fn(next);
    }
    return next;
  }

  /* -------------------------------------------------------------------------- */
  /* Public API                                                                */
  /* -------------------------------------------------------------------------- */

  request(config) {
    return this._execute(config);
  }

  get(path, query, headers) {
    return this.request({ method: 'GET', path, query, headers });
  }

  post(path, body, query, headers) {
    return this.request({ method: 'POST', path, body, query, headers });
  }

  put(path, body, query, headers) {
    return this.request({ method: 'PUT', path, body, query, headers });
  }

  patch(path, body, query, headers) {
    return this.request({ method: 'PATCH', path, body, query, headers });
  }

  delete(path, query, headers) {
    return this.request({ method: 'DELETE', path, query, headers });
  }

  /* -------------------------------------------------------------------------- */
  /* Core execution pipeline                                                   */
  /* -------------------------------------------------------------------------- */

  async _execute(config) {
    const finalConfig = await this._runRequestInterceptors({ ...config });

    const request = this._buildRequest(finalConfig);

    return this._withRetries(() => this._send(request));
  }

  _buildRequest(config) {
    const { method, path, query = {}, body, headers = {} } = config;

    const url = this._buildUrl(path, query);
    const finalHeaders = { ...headers };

    const payload = this._buildBody(body, finalHeaders);

    return { method, url, headers: finalHeaders, body: payload };
  }

  _buildUrl(path, query) {
    const qs = buildQueryString(query);
    const url = resolveUrl(path, this.baseUrl);
    return qs ? `${url}?${qs}` : url;
  }

  _buildBody(body, headers) {
    if (body == null) return undefined;

    if (body instanceof FormData) {
      return body;
    }

    headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    return JSON.stringify(body);
  }

  /* -------------------------------------------------------------------------- */
  /* Retry layer                                                               */
  /* -------------------------------------------------------------------------- */

  async _withRetries(fn) {
    let lastError;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_BASE_DELAY * 2 ** (attempt - 1));
      }

      try {
        return await fn();
      } catch (err) {
        lastError = err;

        if (this._isNonRetryable(err)) {
          throw err;
        }

        if (attempt === this.retries) {
          throw err;
        }
      }
    }

    throw lastError;
  }

  _isNonRetryable(err) {
    return err instanceof LiferayAPIError && err.statusCode < 500;
  }

  /* -------------------------------------------------------------------------- */
  /* Network layer                                                             */
  /* -------------------------------------------------------------------------- */

  async _send({ method, url, headers, body }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      await this.auth.injectAuthHeaders(headers);

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const parsed = await this._parse(response, url);

      return this._runResponseInterceptors(parsed);
    } catch (err) {
      clearTimeout(timer);
      throw this._normalizeError(err, url);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Response parsing                                                          */
  /* -------------------------------------------------------------------------- */

  async _parse(response, url) {
    const contentType = response.headers.get('content-type') || '';

    let data;

    try {
      data = contentType.includes('application/json') ? await response.json() : await response.text();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new LiferayAPIError({
        statusCode: response.status,
        message: data?.message || data?.title || response.statusText || 'API Error',
        endpoint: url,
        responseBody: data,
      });
    }

    return {
      status: response.status,
      data,
      headers: response.headers,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Error normalization                                                       */
  /* -------------------------------------------------------------------------- */

  _normalizeError(err, url) {
    if (err instanceof LiferayAPIError || err instanceof LiferayTimeoutError) {
      return err;
    }

    if (err.name === 'AbortError') {
      return new LiferayTimeoutError(url, this.timeout);
    }

    return new LiferayNetworkError(err?.message || 'Network request failed', url, err);
  }
}
