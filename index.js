/**
 * @fileoverview Public entry point for the Liferay Headless SDK.
 *
 * @example
 * import { LiferayHeadlessClient, iteratePages, collectAllPages } from 'liferay-headless-sdk';
 *
 * const client = new LiferayHeadlessClient({
 *   baseUrl: 'https://your-liferay.com',
 *   swaggerUrls: [
 *     '/o/headless-delivery/v1.0/openapi.json',
 *     '/o/headless-admin-user/v1.0/openapi.json',
 *   ],
 *   username: 'test@liferay.com',
 *   password: 'test',
 * });
 *
 * await client.init();
 * const sites = await client.headlessDelivery.getSites();
 */

export { LiferayHeadlessClient } from './client.js';
export { LiferayAPIError, LiferayNetworkError, LiferayTimeoutError } from './errors.js';
export { iteratePages, collectAllPages, getPage } from './pagination.js';
export { AuthManager } from './auth.js';
export { HttpClient } from './http.js';
export { SwaggerLoader } from './swagger-loader.js';
export { generateServicesFromSchema, parseOperationsByTag } from './api-generator.js';
