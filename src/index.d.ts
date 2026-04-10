/**
 * TypeScript declarations for the Liferay Headless SDK.
 */

// ─── Error Classes ─────────────────────────────────────────────────────────

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

// ─── Auth ──────────────────────────────────────────────────────────────────

export type AuthType = 'basic' | 'oauth';

export declare class AuthManager {
  setBasicAuth(username: string, password: string): void;
  setOAuthToken(token: string): void;
  clearAuth(): void;
  getAuthHeader(): string | null;
  getAuthType(): AuthType | null;
  injectAuthHeaders(headers: Record<string, string>): Record<string, string>;
}

// ─── HTTP ──────────────────────────────────────────────────────────────────

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
  constructor(options: {
    baseUrl: string;
    timeout?: number;
    retries?: number;
    auth: AuthManager;
  });
  addRequestInterceptor(fn: (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>): void;
  addResponseInterceptor(fn: (response: HttpResponse) => HttpResponse | Promise<HttpResponse>): void;
  request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
  get<T = unknown>(path: string, query?: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse<T>>;
  post<T = unknown>(path: string, body?: unknown, query?: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse<T>>;
  put<T = unknown>(path: string, body?: unknown, query?: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse<T>>;
  patch<T = unknown>(path: string, body?: unknown, query?: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse<T>>;
  delete<T = unknown>(path: string, query?: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse<T>>;
}

// ─── Swagger Loader ────────────────────────────────────────────────────────

export declare class SwaggerLoader {
  load(schemaUrl: string, baseUrl?: string, authHeaders?: Record<string, string>): Promise<object>;
  loadAll(schemaUrls: string[], baseUrl: string, authHeaders?: Record<string, string>): Promise<Array<{ url: string; schema: object }>>;
  clearCache(): void;
  invalidate(absoluteUrl: string): void;
}

// ─── API Generator ─────────────────────────────────────────────────────────

export interface OperationDef {
  method: string;
  pathTemplate: string;
  operationId: string;
  parameters: unknown[];
  requestBody: unknown | null;
  summary: string;
  description: string;
}

export declare function parseOperationsByTag(schema: object): Map<string, OperationDef[]>;
export declare function generateServicesFromSchema(
  schema: object,
  httpClient: HttpClient
): Record<string, Record<string, ApiMethod>>;

// ─── API Method ────────────────────────────────────────────────────────────

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

export type ApiMethod<TParams extends ApiMethodParams = ApiMethodParams, TData = unknown> =
  (params?: TParams) => Promise<HttpResponse<TData>>;

// ─── Pagination ────────────────────────────────────────────────────────────

export declare function iteratePages<T = unknown>(
  apiMethod: ApiMethod,
  params?: ApiMethodParams & { pageSize?: number }
): AsyncGenerator<T>;

export declare function collectAllPages<T = unknown>(
  apiMethod: ApiMethod,
  params?: ApiMethodParams & { pageSize?: number }
): Promise<T[]>;

export declare function getPage<T = unknown>(
  apiMethod: ApiMethod,
  page: number,
  pageSize?: number,
  params?: ApiMethodParams
): Promise<PagedResponse<T>>;

// ─── Client ────────────────────────────────────────────────────────────────

export interface LiferayClientOptions {
  /** Base URL of the Liferay instance */
  baseUrl: string;
  /** OpenAPI JSON endpoint paths or absolute URLs to load */
  swaggerUrls?: string[];
  /** Username for Basic Auth */
  username?: string;
  /** Password for Basic Auth */
  password?: string;
  /** Bearer token for OAuth2 */
  oauthToken?: string;
  /** Request timeout in ms (default 30000) */
  timeout?: number;
  /** Number of retry attempts on transient failures (default 2) */
  retries?: number;
  /** Auto-load schemas on construction via Proxy (default true) */
  autoGenerate?: boolean;
}

/**
 * Main Liferay Headless API client.
 * Service namespaces (e.g. `client.headlessDelivery`) are dynamically populated
 * after `init()` is called or lazily on first access when `autoGenerate=true`.
 */
export declare class LiferayHeadlessClient {
  constructor(options: LiferayClientOptions);

  /** Load all configured Swagger schemas and generate service modules. */
  init(): Promise<this>;

  /** Load a single additional Swagger schema and merge its services. */
  loadSchema(swaggerUrl: string): Promise<void>;

  /** Switch to Basic Auth credentials. */
  setBasicAuth(username: string, password: string): void;

  /** Switch to OAuth2 Bearer token. */
  setOAuthToken(token: string): void;

  /** Clear auth credentials. */
  clearAuth(): void;

  /** Register a request interceptor. */
  addRequestInterceptor(
    fn: (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>
  ): void;

  /** Register a response interceptor. */
  addResponseInterceptor(
    fn: (response: HttpResponse) => HttpResponse | Promise<HttpResponse>
  ): void;

  /** Make a raw HTTP request. */
  request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>>;

  /** Clear all cached Swagger schemas and reset generated services. */
  clearSchemaCache(): void;

  /** Returns all available service namespace names (derived from tags). */
  getServiceNames(): string[];

  /** Returns all method names for a given service namespace. */
  getMethodNames(serviceName: string): string[];

  /** Dynamically accessible service namespaces populated at runtime */
  [service: string]: Record<string, ApiMethod> | unknown;
}
