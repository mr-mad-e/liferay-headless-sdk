/**
 * @fileoverview Authentication manager for Liferay API requests.
 * Supports Basic Auth and OAuth2 Client Credentials with token caching.
 */

export class AuthManager {
  constructor() {
    this.reset();
  }

  reset() {
    this._authType = null;
    this._authHeader = null;

    // OAuth state
    this._clientConfig = null;
    this._tokenData = null;
    this._tokenExpiry = null;

    // Prevent concurrent refresh storms
    this._refreshPromise = null;
  }

  /* -------------------------------------------------------------------------- */
  /* Basic Auth                                                                */
  /* -------------------------------------------------------------------------- */

  setBasicAuth(username, password) {
    this._authType = 'basic';
    this._authHeader = this._encodeBasic(username, password);
  }

  _encodeBasic(username, password) {
    const token =
      typeof btoa !== 'undefined'
        ? btoa(`${username}:${password}`)
        : Buffer.from(`${username}:${password}`).toString('base64');

    return `Basic ${token}`;
  }

  /* -------------------------------------------------------------------------- */
  /* OAuth (manual token)                                                      */
  /* -------------------------------------------------------------------------- */

  setOAuthToken(token) {
    this._authType = 'oauth';
    this._authHeader = `Bearer ${token}`;
  }

  /* -------------------------------------------------------------------------- */
  /* OAuth Client Credentials                                                  */
  /* -------------------------------------------------------------------------- */

  async setClientCredentials(config) {
    const { tokenUrl, clientId, clientSecret } = config;

    this._authType = 'oauth';
    this._clientConfig = { tokenUrl, clientId, clientSecret };

    await this._refreshToken();
  }

  async ensureValidToken() {
    if (!this._clientConfig) return;

    const isExpired =
      !this._tokenExpiry || Date.now() >= this._tokenExpiry;

    if (isExpired) {
      await this._refreshToken();
    }
  }

  async _refreshToken() {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = this._doRefreshToken();

    try {
      await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }

  async _doRefreshToken() {
    const { tokenUrl, clientId, clientSecret } = this._clientConfig;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('OAuth response missing access_token');
    }

    this._applyToken(data);
  }

  _applyToken(data) {
    this._tokenData = data;

    const expiresIn = data.expires_in ?? 3600;
    this._tokenExpiry = Date.now() + (expiresIn - 30) * 1000;

    this.setOAuthToken(data.access_token);
  }

  /* -------------------------------------------------------------------------- */
  /* Public API                                                                */
  /* -------------------------------------------------------------------------- */

  getAuthType() {
    return this._authType;
  }

  getAuthHeader() {
    return this._authHeader;
  }

  async injectAuthHeaders(headers = {}) {
    await this.ensureValidToken();

    if (this._authHeader) {
      headers.Authorization = this._authHeader;
    }

    return headers;
  }

  clearAuth() {
    this.reset();
  }
}