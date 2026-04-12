/**
 * @fileoverview Main entry point for the Liferay Headless SDK client.
 * Orchestrates auth, HTTP transport, schema loading, and dynamic API generation.
 */

import { AuthManager } from './auth.js';
import { HttpClient } from './http.js';
import { SwaggerLoader } from './swagger-loader.js';
import { generateServicesFromSchema } from './api-generator.js';
import { tagToPropertyName } from './utils.js';

/**
 * @typedef {object} LiferayClientOptions
 * @property {string} baseUrl - Base URL of the Liferay instance (e.g. "https://liferay.example.com")
 * @property {string[]} [swaggerUrls] - List of OpenAPI JSON endpoint paths or URLs
 * @property {string} [username] - Username for Basic Auth
 * @property {string} [password] - Password for Basic Auth
 * @property {string} [oauthToken] - Bearer token for OAuth2
 * @property {number} [timeout=30000] - Request timeout in milliseconds
 * @property {number} [retries=2] - Number of automatic retries on transient errors
 * @property {boolean} [autoGenerate=true] - If true, load and generate APIs on construction
 */

/**
 * Main Liferay Headless API client.
 *
 * @example
 * const client = new LiferayHeadlessClient({
 *   baseUrl: "https://your-liferay.com",
 *   swaggerUrls: ["/o/headless-delivery/v1.0/openapi.json"],
 *   username: "test@liferay.com",
 *   password: "test",
 * });
 * await client.init();
 *
 * const sites = await client.headlessDelivery.getSites();
 */
export class LiferayHeadlessClient {
  /**
   * @param {LiferayClientOptions} options
   */
  constructor(options = {}) {
    const {
      baseUrl = '',
      swaggerUrls = [],
      username,
      password,
      oauthToken,
      authToken,
      timeout = 30000,
      retries = 2,
      autoGenerate = true,
    } = options;

    // if (!baseUrl) throw new Error('[LiferaySDK] baseUrl is required');

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this._swaggerUrls = swaggerUrls;
    this._autoGenerate = autoGenerate;

    // Sub-modules
    this._auth = new AuthManager();
    this._http = new HttpClient({ baseUrl: this.baseUrl, timeout, retries, auth: this._auth });
    this._loader = new SwaggerLoader();

    /** @type {Record<string, Record<string, Function>>} Dynamically populated service modules */
    this._services = {};

    /** @type {boolean} Whether init() has been called */
    this._initialized = false;

    // Configure auth
    if (oauthToken) {
      this._auth.setOAuthToken(oauthToken);
    } else if (username && password) {
      this._auth.setBasicAuth(username, password);
    } else if (authToken) {
      this._auth.setAuthToken(authToken);
    }

    // Auto-generate: return a Proxy that lazily triggers init on first service access
    if (autoGenerate) {
      return this._proxied();
    }
  }

  /**
   * Load all configured Swagger schemas and generate service modules.
   * Must be called before using dynamically generated methods (unless autoGenerate=false).
   *
   * @returns {Promise<LiferayHeadlessClient>} this, for chaining
   */
  async init() {
    if (this._initialized) return this;

    const authHeaders = {};
    this._auth.injectAuthHeaders(authHeaders);
    
    const schemas = await this._loader.loadAll(this._swaggerUrls, this.baseUrl, authHeaders);

    for (const { url, schema } of schemas) {
      this._mergeServices(generateServicesFromSchema(schema, this._http), url);
    }

    this._initialized = true;
    return this;
  }

  /**
   * Load a single additional Swagger URL and merge its services into the client.
   *
   * @param {string} swaggerUrl
   * @returns {Promise<void>}
   */
  async loadSchema(swaggerUrl) {
    const authHeaders = {};
    this._auth.injectAuthHeaders(authHeaders);

    const schema = await this._loader.load(swaggerUrl, this.baseUrl, authHeaders);
    this._mergeServices(generateServicesFromSchema(schema, this._http), swaggerUrl);
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Switch to Basic Authentication.
   * @param {string} username
   * @param {string} password
   */
  setBasicAuth(username, password) {
    this._auth.setBasicAuth(username, password);
  }

  /**
   * Switch to OAuth2 Bearer token.
   * @param {string} token
   */
  setOAuthToken(token) {
    this._auth.setOAuthToken(token);
  }

  /** Clear all auth credentials. */
  clearAuth() {
    this._auth.clearAuth();
  }

  // ─── Interceptors ──────────────────────────────────────────────────────────

  /**
   * Add a request interceptor. Receives and must return the request config object.
   * @param {(config: object) => object | Promise<object>} fn
   */
  addRequestInterceptor(fn) {
    this._http.addRequestInterceptor(fn);
  }

  /**
   * Add a response interceptor. Receives and must return the response object.
   * @param {(response: object) => object | Promise<object>} fn
   */
  addResponseInterceptor(fn) {
    this._http.addResponseInterceptor(fn);
  }

  // ─── Raw HTTP ──────────────────────────────────────────────────────────────

  /**
   * Make a raw HTTP request bypassing generated methods.
   * @param {object} config
   * @returns {Promise<{ status: number, data: * }>}
   */
  request(config) {
    return this._http.request(config);
  }

  // ─── Cache ─────────────────────────────────────────────────────────────────

  /** Clear all cached Swagger schemas. */
  clearSchemaCache() {
    this._loader.clearCache();
    this._initialized = false;
    this._services = {};
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /**
   * Merges a generated service map into this._services.
   * Existing methods on an existing tag are preserved; new ones are added.
   * @private
   */
  _mergeServices(newServices) {
    for (const [tag, methods] of Object.entries(newServices)) {
      if (!this._services[tag]) {
        this._services[tag] = {};
      }
      Object.assign(this._services[tag], methods);
    }
  }

  /**
   * Returns a Proxy of this client that auto-calls init() when an unknown
   * service property is accessed (lazy initialization).
   * @private
   * @returns {LiferayHeadlessClient}
   */
  _proxied() {
    const self = this;
    let initPromise = null;

    return new Proxy(this, {
      get(target, prop) {
        // Pass through own properties and methods
        if (prop in target) return Reflect.get(target, prop);

        // Accessing a service namespace triggers lazy init
        if (typeof prop === 'string' && !prop.startsWith('_')) {
          if (!self._initialized) {
            if (!initPromise) {
              initPromise = self.init().then(() => { initPromise = null; });
            }
            // Return a lazy proxy for the service namespace
            return new Proxy(
              {},
              {
                get(_, methodName) {
                  return async (...args) => {
                    await initPromise;
                    const service = self._services[prop];
                    if (!service) {
                      throw new Error(`[LiferaySDK] Service namespace "${prop}" not found. Available: ${Object.keys(self._services).join(', ')}`);
                    }
                    const fn = service[methodName];
                    if (typeof fn !== 'function') {
                      throw new Error(`[LiferaySDK] Method "${methodName}" not found in service "${prop}". Available: ${Object.keys(service).join(', ')}`);
                    }
                    return fn(...args);
                  };
                },
              }
            );
          }

          // Already initialized — return service directly
          if (self._services[prop]) return self._services[prop];
        }

        return Reflect.get(target, prop);
      },
    });
  }

  /**
   * Returns all available service names (tags).
   * @returns {string[]}
   */
  getServiceNames() {
    return Object.keys(this._services);
  }

  /**
   * Returns all method names for a given service.
   * @param {string} serviceName
   * @returns {string[]}
   */
  getMethodNames(serviceName) {
    const service = this._services[serviceName];
    return service ? Object.keys(service) : [];
  }
}
