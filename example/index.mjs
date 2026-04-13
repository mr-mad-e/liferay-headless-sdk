import { LiferayHeadlessClient } from '../src/index.js';

export const client = new LiferayHeadlessClient({
  baseUrl: 'http://localhost:8080',
  swaggerUrls: [
    '/o/headless-delivery/v1.0/openapi.json',
    '/o/headless-admin-user/v1.0/openapi.json',
  ],
  username: 'test@liferay.com',
  password: 'test',
  // tags: ['Site']
  // operationIds: ['getMyUserAccountSitesPage']
});

await client.init();

// console.log('client', client._services)

const { data } = await client.headlessAdminUser.site.getMyUserAccountSitesPage();
console.log(data.items);