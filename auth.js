/**
 * @fileoverview Authentication manager for Liferay API requests.
 * Supports Basic Auth and OAuth2 Bearer tokens with dynamic switching.
 */

/**
 * @typedef {'basic' | 'oauth'} AuthType
 */

/**
 * Manages authentication headers for the SDK.
 */
export class AuthManager {
  constructor() {
    /** @type {AuthType | null} */
    this._authType = null;
    this._credentials = null;
  }

  /**
   * Configure Basic Authentication.
   * @param {string} username
   * @param {string} password
   */
  setBasicAuth(username, password) {
    this._authType = 'basic';
    const encoded =
      typeof btoa !== 'undefined'
        ? btoa(`${username}:${password}`)
        : Buffer.from(`${username}:${password}`).toString('base64');
    this._credentials = `Basic ${encoded}`;
  }

  /**
   * Configure OAuth2 Bearer token authentication.
   * @param {string} token
   */
  setOAuthToken(token) {
    this._authType = 'oauth';
    this._credentials = `Bearer ${token}`;
  }

  /**
   * Clear all authentication credentials.
   */
  clearAuth() {
    this._authType = null;
    this._credentials = null;
  }

  /**
   * Returns the current Authorization header value, or null if not set.
   * @returns {string | null}
   */
  getAuthHeader() {
    return this._credentials;
  }

  /**
   * Returns the current auth type.
   * @returns {AuthType | null}
   */
  getAuthType() {
    return this._authType;
  }

  /**
   * Injects auth headers into the provided headers object (mutates in place).
   * @param {Record<string, string>} headers
   * @returns {Record<string, string>}
   */
  injectAuthHeaders(headers) {
    const authHeader = this.getAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    return headers;
  }
}
