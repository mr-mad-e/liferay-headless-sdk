/**
 * @fileoverview General utility functions for the Liferay SDK.
 */

/**
 * Converts an operationId string to a camelCase JavaScript method name.
 * Examples:
 *   "getSite-Page" → "getSitePage"
 *   "create_structured-content" → "createStructuredContent"
 *   "GetSites" → "getSites"
 *
 * @param {string} operationId
 * @returns {string}
 */
export function operationIdToMethodName(operationId) {
  if (!operationId) return '';

  // If the operationId contains no delimiters, just lowercase the first char
  const cleaned = operationId
    .replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (char) => char.toLowerCase());

  return cleaned;
}

/**
 * Converts a tag string to a valid JavaScript property name (camelCase).
 * Examples:
 *   "Headless Delivery" → "headlessDelivery"
 *   "headless-admin-user" → "headlessAdminUser"
 *
 * @param {string} tag
 * @returns {string}
 */
export function tagToPropertyName(tag) {
  if (!tag) return 'default';
  return tag
    .replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (char) => char.toLowerCase())
    .replace(/[^a-zA-Z0-9_$]/g, '');
}

/**
 * Replaces path parameters in a URL template with values from params.
 * E.g. "/sites/{siteId}/pages/{pageId}" + { siteId: 1, pageId: 2 } → "/sites/1/pages/2"
 * Returns the URL with substitutions and a remainder object of unused params.
 *
 * @param {string} pathTemplate
 * @param {Record<string, *>} params
 * @returns {{ url: string, remaining: Record<string, *> }}
 */
export function interpolatePath(pathTemplate, params = {}) {
  const remaining = { ...params };
  const path = pathTemplate.replace(/\{([^}]+)\}/g, (_, key) => {
    if (key in remaining) {
      const val = remaining[key];
      delete remaining[key];
      return encodeURIComponent(String(val));
    }
    return `{${key}}`;
  });
  return { path, remaining };
}

/**
 * Builds a query string from an object, ignoring null/undefined values.
 * @param {Record<string, *>} params
 * @returns {string} Query string without leading "?"
 */
export function buildQueryString(params = {}) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join('&');
}

/**
 * Merges a base URL with a path, normalizing slashes.
 * @param {string} base
 * @param {string} path
 * @returns {string}
 */
export function joinUrl(base, path) {
  const b = base.replace(/\/$/, '');
  const p = path.replace(/^\//, '/');
  return `${b}${p}`;
}

/**
 * Generates a simple deterministic cache key from a URL string.
 * @param {string} url
 * @returns {string}
 */
export function cacheKey(url) {
  return `liferay_sdk_schema_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if the current environment has localStorage available.
 * @returns {boolean}
 */
export function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}
