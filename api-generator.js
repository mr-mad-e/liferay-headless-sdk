/**
 * @fileoverview Generates dynamic API service modules from parsed OpenAPI schemas.
 * Groups operations by tag, converts operationIds to method names, and wires up
 * path/query/body parameters automatically.
 */

import { operationIdToMethodName, tagToPropertyName, interpolatePath } from './utils.js';

/** HTTP methods that typically carry a request body */
const BODY_METHODS = new Set(['post', 'put', 'patch']);

/**
 * Parses an OpenAPI schema and groups all operations by their first tag.
 *
 * @param {object} schema - Parsed OpenAPI/Swagger JSON
 * @returns {Map<string, Array<OperationDef>>} Tag → list of operation definitions
 */
export function parseOperationsByTag(schema) {
  const tagMap = new Map();
  const paths = schema.paths || {};

  for (const [pathTemplate, pathItem] of Object.entries(paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const operation = pathItem[method];
      if (!operation) continue;

      const tags = (operation.tags && operation.tags.length > 0)
        ? operation.tags
        : ['default'];

      const primaryTag = tags[0];
      const tagKey = tagToPropertyName(primaryTag);

      if (!tagMap.has(tagKey)) {
        tagMap.set(tagKey, []);
      }

      tagMap.get(tagKey).push({
        method,
        pathTemplate,
        operationId: operation.operationId,
        parameters: operation.parameters || [],
        requestBody: operation.requestBody || null,
        summary: operation.summary || '',
        description: operation.description || '',
      });
    }
  }

  return tagMap;
}

/**
 * @typedef {object} OperationDef
 * @property {string} method
 * @property {string} pathTemplate
 * @property {string} operationId
 * @property {Array} parameters
 * @property {object|null} requestBody
 * @property {string} summary
 * @property {string} description
 */

/**
 * Generates a JavaScript function for a single OpenAPI operation.
 *
 * The generated function accepts a single `params` object and automatically:
 *  - Substitutes path variables
 *  - Passes remaining params as query string
 *  - Accepts a `body` key for the request body
 *  - Accepts a `headers` key for extra headers
 *
 * @param {OperationDef} operation
 * @param {import('./http.js').HttpClient} httpClient
 * @returns {Function}
 */
export function buildOperationMethod(operation, httpClient) {
  const { method, pathTemplate, operationId, parameters } = operation;

  // Identify path parameter names
  const pathParamNames = new Set(
    parameters.filter((p) => p.in === 'path').map((p) => p.name)
  );

  // Identify query parameter names
  const queryParamNames = new Set(
    parameters.filter((p) => p.in === 'query').map((p) => p.name)
  );

  /**
   * Dynamically generated API method.
   * @param {object} [params={}]
   * @param {*} [params.body] - Request body (for POST/PUT/PATCH)
   * @param {Record<string, string>} [params.headers] - Additional headers
   * @returns {Promise<{ status: number, data: * }>}
   */
  const generatedMethod = async function (params = {}) {
    const { body, headers, ...rest } = params;

    // Separate path params from query params
    const pathParams = {};
    const queryParams = {};
    const extraParams = {};

    for (const [key, value] of Object.entries(rest)) {
      if (pathParamNames.has(key)) {
        pathParams[key] = value;
      } else if (queryParamNames.has(key)) {
        queryParams[key] = value;
      } else {
        // Unknown params fall through as query params
        extraParams[key] = value;
      }
    }

    const { url } = interpolatePath(pathTemplate, pathParams);
    const mergedQuery = { ...queryParams, ...extraParams };

    // For methods with bodies, use body param; otherwise ignore
    const requestBody = BODY_METHODS.has(method) ? body : undefined;

    return httpClient.request({
      method: method.toUpperCase(),
      path: url,
      query: mergedQuery,
      body: requestBody,
      headers,
    });
  };

  // Attach metadata to the function for introspection
  Object.defineProperty(generatedMethod, 'name', {
    value: operationIdToMethodName(operationId) || `${method}${pathTemplate}`,
    writable: false,
  });
  generatedMethod._operationId = operationId;
  generatedMethod._method = method;
  generatedMethod._path = pathTemplate;
  generatedMethod._summary = operation.summary;

  return generatedMethod;
}

/**
 * Builds a service module object (a plain object of named methods) for a
 * single OpenAPI tag group.
 *
 * @param {Array<OperationDef>} operations
 * @param {import('./http.js').HttpClient} httpClient
 * @returns {Record<string, Function>}
 */
export function buildServiceModule(operations, httpClient) {
  const module = {};

  for (const operation of operations) {
    const methodName = operationIdToMethodName(operation.operationId);
    if (!methodName) {
      console.warn(`[LiferaySDK] Skipping operation with no operationId at ${operation.method.toUpperCase()} ${operation.pathTemplate}`);
      continue;
    }
    if (module[methodName]) {
      // Deduplicate: append HTTP method suffix to avoid collision
      const uniqueName = `${methodName}_${operation.method}`;
      module[uniqueName] = buildOperationMethod(operation, httpClient);
    } else {
      module[methodName] = buildOperationMethod(operation, httpClient);
    }
  }

  return module;
}

/**
 * Generates all service modules from a parsed OpenAPI schema.
 *
 * @param {object} schema - Parsed OpenAPI JSON
 * @param {import('./http.js').HttpClient} httpClient
 * @returns {Record<string, Record<string, Function>>} Tag → service module
 */
export function generateServicesFromSchema(schema, httpClient) {
  const tagMap = parseOperationsByTag(schema);
  const services = {};

  for (const [tagKey, operations] of tagMap.entries()) {
    services[tagKey] = buildServiceModule(operations, httpClient);
  }

  return services;
}
