/**
 * Main Liferay Headless API client.
 */

import { AuthManager } from './auth.js';
import { HttpClient } from './http.js';
import { SwaggerLoader } from './swagger-loader.js';
import { generateServicesFromSchema } from './api-generator.js';

export class LiferayHeadlessClient {
  constructor(options = {}) {
    const {
      baseUrl = '',
      swaggerUrls = [],
      operationIds = [],
      tags = [],
      username,
      password,
      clientId,
      clientSecret,
      timeout = 30000,
      retries = 2,
      autoGenerate = true,
    } = options;

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this._swaggerUrls = swaggerUrls;
    this._operationIds = operationIds;
    this._tags = tags;
    this._autoGenerate = autoGenerate;

    this._initialized = false;
    this._initPromise = null;

    this._services = Object.create(null);

    // Core modules
    this._auth = new AuthManager();
    this._http = new HttpClient({
      baseUrl: this.baseUrl,
      timeout,
      retries,
      auth: this._auth,
    });

    this._loader = new SwaggerLoader(this._auth);

    this._configureAuth({ username, password, clientId, clientSecret });

    if (autoGenerate) {
      return this._createLazyProxy();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Init                                                                       */
  /* -------------------------------------------------------------------------- */

  async init() {
    if (this._initialized) return this;

    if (!this._initPromise) {
      this._initPromise = this._doInit();
    }

    await this._initPromise;
    return this;
  }

  async _doInit() {
    const schemas = await this._loader.loadAll(this._swaggerUrls, this.baseUrl);

    for (const { url, schema } of schemas) {
      const services = generateServicesFromSchema(schema, this._operationIds, this._tags, this._http);

      this._mergeServices(services, url);
    }

    this._initialized = true;
    this._initPromise = null;
  }

  /* -------------------------------------------------------------------------- */
  /* Auth                                                                      */
  /* -------------------------------------------------------------------------- */

  _configureAuth({ username, password, clientId, clientSecret }) {
    if (clientId && clientSecret) {
      this.setClientCredentials(clientId, clientSecret);
    } else if (username && password) {
      this.setBasicAuth(username, password);
    }
  }

  setBasicAuth(username, password) {
    this._auth.setBasicAuth(username, password);
  }

  setClientCredentials(clientId, clientSecret) {
    this._auth.setClientCredentials({
      tokenUrl: `${this.baseUrl}/o/oauth2/token`,
      clientId,
      clientSecret,
    });
  }

  clearAuth() {
    this._auth.clearAuth();
  }

  /* -------------------------------------------------------------------------- */
  /* Schema loading                                                            */
  /* -------------------------------------------------------------------------- */

  async loadSchema(swaggerUrl) {
    const schema = await this._loader.load(swaggerUrl, this.baseUrl);

    const services = generateServicesFromSchema(schema, this._operationIds, this._tags, this._http);

    this._mergeServices(services, swaggerUrl);
  }

  clearSchemaCache() {
    this._loader.clearCache();
    this._initialized = false;
    this._services = Object.create(null);
  }

  /* -------------------------------------------------------------------------- */
  /* Service registry                                                         */
  /* -------------------------------------------------------------------------- */

  _mergeServices(newServices) {
    for (const [tag, methods] of Object.entries(newServices)) {
      if (!this._services[tag]) {
        this._services[tag] = Object.create(null);
      }
      Object.assign(this._services[tag], methods);
    }
  }

  getServiceNames() {
    return Object.keys(this._services);
  }

  getMethodNames(serviceName) {
    return Object.keys(this._services[serviceName] || {});
  }

  /* -------------------------------------------------------------------------- */
  /* HTTP                                                                     */
  /* -------------------------------------------------------------------------- */

  request(config) {
    return this._http.request(config);
  }

  addRequestInterceptor(fn) {
    this._http.addRequestInterceptor(fn);
  }

  addResponseInterceptor(fn) {
    this._http.addResponseInterceptor(fn);
  }

  /* -------------------------------------------------------------------------- */
  /* Lazy Proxy                                                               */
  /* -------------------------------------------------------------------------- */

  _createLazyProxy() {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // 1. Allow real properties/methods first
        if (prop in target) {
          const value = target[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }

        // 2. Ignore private/internal props
        if (typeof prop !== 'string' || prop.startsWith('_')) {
          return undefined;
        }

        // 3. Otherwise treat as service path
        return this._createServiceProxy([prop]);
      },
    });
  }

  _resolveServiceMethod(path, args) {
    return this.init().then(() => {
      let ref = this._services;

      // Walk down the service tree
      for (let i = 0; i < path.length - 1; i++) {
        ref = ref?.[path[i]];
      }

      const methodName = path[path.length - 1];
      const fn = ref?.[methodName];

      if (typeof fn !== 'function') {
        throw new Error(`Method "${methodName}" not found at "${path.join('.')}".`);
      }

      return fn(...args);
    });
  }

  _createServiceProxy(path = []) {
    const handler = {
      get: (_, prop) => {
        if (typeof prop !== 'string' || prop.startsWith('_')) {
          return undefined;
        }

        // continue building chain
        return this._createServiceProxy([...path, prop]);
      },

      apply: async (_, __, args) => {
        return this._resolveServiceMethod(path, args);
      },
    };

    const fn = () => {};
    return new Proxy(fn, handler);
  }
}
