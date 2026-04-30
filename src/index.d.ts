/**
 * TypeScript declarations for the Liferay Headless SDK (refactored version)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export declare class LiferayAPIError extends Error {
  statusCode: number;
  endpoint: string;
  requestPayload: unknown | null;
  responseBody: unknown | null;

  constructor(options: {
    statusCode: number;
    message: string;
    endpoint: string;
    requestPayload?: unknown;
    responseBody?: unknown;
  });
}

export declare class LiferayNetworkError extends Error {
  endpoint: string;
  cause: Error | null;

  constructor(message: string, endpoint: string, cause?: Error | null);
}

export declare class LiferayTimeoutError extends Error {
  endpoint: string;
  timeoutMs: number;

  constructor(endpoint: string, timeoutMs: number);
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export type AuthType = 'basic' | 'oauth';

export declare class AuthManager {
  setBasicAuth(username: string, password: string): void;

  setOAuthToken(token: string): void;

  clearAuth(): void;

  getAuthHeader(): string | null;

  getAuthType(): AuthType | null;

  injectAuthHeaders(headers: Record<string, string>): Promise<Record<string, string>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────────────────

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

export declare class HttpClient {
  constructor(options: { baseUrl: string; timeout?: number; retries?: number; auth: AuthManager });

  addRequestInterceptor(fn: (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>): void;

  addResponseInterceptor(fn: (response: HttpResponse) => HttpResponse | Promise<HttpResponse>): void;

  request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>>;

  get<T = unknown>(
    path: string,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>>;

  post<T = unknown>(
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>>;

  put<T = unknown>(
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>>;

  patch<T = unknown>(
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>>;

  delete<T = unknown>(
    path: string,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Swagger Loader (UPDATED)
// ─────────────────────────────────────────────────────────────────────────────

export declare class SwaggerLoader {
  load(schemaUrl: string, baseUrl?: string): Promise<object>;

  loadAll(schemaUrls: string[], baseUrl: string): Promise<Array<{ url: string; schema: object }>>;

  clearCache(): void;

  invalidate(absoluteUrl: string): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface OperationDef {
  method: string;
  pathTemplate: string;
  operationId: string;
  parameters: unknown[];
  requestBody: unknown | null;
  summary: string;
  description: string;
}

export declare function parseOperationsByTag(
  schema: object,
  operationIds?: string[],
  tags?: string[],
): Map<string, OperationDef[]>;

export declare function generateServicesFromSchema(
  schema: object,
  operationIds: string[],
  tags: string[],
  httpClient: HttpClient,
): Record<string, Record<string, Record<string, ApiMethod>>>;

// ─────────────────────────────────────────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiMethodParams {
  [key: string]: unknown;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface PagedResponse<T = unknown> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number | null;
  lastPage: number | null;
}

export type ApiMethod<TParams extends ApiMethodParams = ApiMethodParams, TData = unknown> = (
  params?: TParams,
) => Promise<HttpResponse<TData>>;

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export declare function iteratePages<T = unknown>(
  apiMethod: ApiMethod,
  params?: ApiMethodParams & { pageSize?: number },
): AsyncGenerator<T>;

export declare function collectAllPages<T = unknown>(
  apiMethod: ApiMethod,
  params?: ApiMethodParams & { pageSize?: number },
): Promise<T[]>;

export declare function getPage<T = unknown>(
  apiMethod: ApiMethod,
  page: number,
  pageSize?: number,
  params?: ApiMethodParams,
): Promise<PagedResponse<T>>;

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

export interface LiferayClientOptions {
  baseUrl: string;
  swaggerUrls?: string[];
  operationIds?: string[];
  tags?: string[];

  username?: string;
  password?: string;

  oauthToken?: string;

  authToken?: string;

  timeout?: number;
  retries?: number;

  autoGenerate?: boolean;
}

export declare class LiferayHeadlessClient {
  constructor(options: LiferayClientOptions);

  init(): Promise<this>;

  loadSchema(swaggerUrl: string): Promise<void>;

  setBasicAuth(username: string, password: string): void;

  setOAuthToken(token: string): void;

  clearAuth(): void;

  addRequestInterceptor(fn: (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>): void;

  addResponseInterceptor(fn: (response: HttpResponse) => HttpResponse | Promise<HttpResponse>): void;

  request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>>;

  clearSchemaCache(): void;

  getServiceNames(): string[];

  getMethodNames(serviceName: string): string[];

  /**
   * Runtime-generated service structure:
   * client.<namespace>.<tag>.<method>
   */
  [namespace: string]: Record<string, Record<string, ApiMethod>> | unknown;
}
