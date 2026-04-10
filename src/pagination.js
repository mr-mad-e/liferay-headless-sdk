/**
 * @fileoverview Liferay pagination utilities.
 * Liferay REST APIs return paginated results in the shape:
 *   { items: [...], page: N, pageSize: N, totalCount: N, lastPage: N }
 */

/**
 * Iterates all pages for a given API method, yielding items from each page.
 *
 * Usage:
 *   for await (const item of iteratePages(client.headlessDelivery.getSites, { pageSize: 50 })) {
 *     console.log(item);
 *   }
 *
 * @param {Function} apiMethod - A generated SDK method that accepts { page, pageSize, ...rest }
 * @param {object} [params={}] - Additional parameters to forward on every call
 * @param {number} [params.pageSize=20] - Items per page (default 20)
 * @yields {*} Individual items from the `items` array of each page
 */
export async function* iteratePages(apiMethod, params = {}) {
  const { pageSize = 20, ...rest } = params;
  let page = 1;
  let totalPages = Infinity;

  while (page <= totalPages) {
    const response = await apiMethod({ ...rest, page, pageSize });
    const body = response.data ?? response;

    const items = body.items ?? body.data ?? [];
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      yield item;
    }

    // Liferay returns lastPage; fall back to totalCount / pageSize
    if (body.lastPage !== undefined) {
      totalPages = body.lastPage;
    } else if (body.totalCount !== undefined) {
      totalPages = Math.ceil(body.totalCount / pageSize);
    } else {
      // No pagination metadata — stop after first page
      break;
    }

    page++;
  }
}

/**
 * Collects all pages into a single flat array.
 *
 * @param {Function} apiMethod
 * @param {object} [params={}]
 * @returns {Promise<Array<*>>}
 */
export async function collectAllPages(apiMethod, params = {}) {
  const all = [];
  for await (const item of iteratePages(apiMethod, params)) {
    all.push(item);
  }
  return all;
}

/**
 * Returns a single page of results as a structured object.
 *
 * @param {Function} apiMethod
 * @param {number} page
 * @param {number} [pageSize=20]
 * @param {object} [params={}]
 * @returns {Promise<{ items: Array<*>, page: number, pageSize: number, totalCount: number, lastPage: number }>}
 */
export async function getPage(apiMethod, page, pageSize = 20, params = {}) {
  const response = await apiMethod({ ...params, page, pageSize });
  const body = response.data ?? response;
  return {
    items: body.items ?? body.data ?? [],
    page: body.page ?? page,
    pageSize: body.pageSize ?? pageSize,
    totalCount: body.totalCount ?? null,
    lastPage: body.lastPage ?? null,
  };
}
