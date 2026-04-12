import { LiferayHeadlessClient } from '../src/index.js';

export const client = new LiferayHeadlessClient({
  baseUrl: 'http://localhost:8080',
  swaggerUrls: [
    '/o/headless-delivery/v1.0/openapi.json',
    '/o/headless-admin-user/v1.0/openapi.json',
  ],
  username: 'test@liferay.com',
  password: 'test@liferay.com',
});

await client.init();

const { data: sites } = await client.headlessAdminUser.site.getMyUserAccountSitesPage();
console.log(sites.items);