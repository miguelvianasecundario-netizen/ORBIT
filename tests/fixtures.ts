import { test as base } from "@playwright/test";
export { expect } from "@playwright/test";
export type { Page, Locator } from "@playwright/test";
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/favicon.ico", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="#1766a3"/></svg>',
      }),
    );
    await use(page);
  },
});
