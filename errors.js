/**
 * @fileoverview Custom error classes for the Liferay Headless SDK.
 */

/**
 * Represents an error returned by the Liferay API or network layer.
 */
export class LiferayAPIError extends Error {
  /**
   * @param {object} options
   * @param {number} options.statusCode - HTTP status code
   * @param {string} options.message - Human-readable error message
   * @param {string} options.endpoint - The API endpoint that was called
   * @param {*} [options.requestPayload] - The request body/params that were sent
   * @param {*} [options.responseBody] - The raw response body from the server
   */
  constructor({ statusCode, message, endpoint, requestPayload = null, responseBody = null }) {
    super(message);
    this.name = 'LiferayAPIError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.requestPayload = requestPayload;
    this.responseBody = responseBody;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LiferayAPIError);
    }
  }

  toString() {
    return `[LiferayAPIError ${this.statusCode}] ${this.message} @ ${this.endpoint}`;
  }
}

/**
 * Represents a network-level failure (no response received).
 */
export class LiferayNetworkError extends Error {
  /**
   * @param {string} message
   * @param {string} endpoint
   * @param {Error} [cause]
   */
  constructor(message, endpoint, cause = null) {
    super(message);
    this.name = 'LiferayNetworkError';
    this.endpoint = endpoint;
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LiferayNetworkError);
    }
  }
}

/**
 * Represents a request timeout.
 */
export class LiferayTimeoutError extends Error {
  /**
   * @param {string} endpoint
   * @param {number} timeoutMs
   */
  constructor(endpoint, timeoutMs) {
    super(`Request timed out after ${timeoutMs}ms: ${endpoint}`);
    this.name = 'LiferayTimeoutError';
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LiferayTimeoutError);
    }
  }
}
