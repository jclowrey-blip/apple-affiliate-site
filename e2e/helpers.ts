import { expect, type Locator, type Page } from "@playwright/test";

export const PROJECT = "/pm/orchard-storefront";

/** Titles in each board column, in display order. */
export async function columns(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from(document.querySelectorAll("section[aria-label]")).map((section) => [
        section.querySelector("h2")?.textContent ?? "",
        Array.from(section.querySelectorAll("li a")).map((a) => a.textContent ?? ""),
      ]),
    ),
  );
}

export const card = (page: Page, title: string) => page.locator("li", { hasText: title }).first();
export const columnList = (page: Page, name: string) => page.locator(`section[aria-label^="${name}"] ul`);
export const taskPanel = (page: Page) => page.getByRole("dialog", { name: /^Task:/ });

/**
 * Drags a board card with the mouse and drops it on `target`: near its top
 * edge by default, or near its bottom edge with `at: "bottom"`.
 */
export async function dragCard(page: Page, title: string, target: Locator, at: "top" | "bottom" = "top") {
  const from = await card(page, title).boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("drag source or target is not visible");
  const x = to.x + to.width / 2;
  const y = at === "top" ? to.y + 12 : to.y + to.height - 6;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 3 });
  await page.mouse.move(x, y, { steps: 15 });
  await page.waitForTimeout(150); // let the board settle on a drop position
  await page.mouse.move(x, y + (at === "top" ? -2 : 2), { steps: 3 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

/**
 * Presses a global shortcut and waits for the dialog it opens. Retries the key
 * press, because a key pressed before the page has hydrated is not heard.
 */
export async function shortcut(page: Page, key: string, dialogName: string): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.keyboard.press(key);
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  return dialog;
}

/** Adds a task to the seeded project through the "n" quick-add and waits for it on the board. */
export async function quickAdd(page: Page, title: string) {
  await page.goto(`${PROJECT}/board`);
  const dialog = await shortcut(page, "n", "New task");
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
}

/** Makes every server action fail at the network level until the returned function is called. */
export async function failServerActions(page: Page) {
  const pattern = "**/pm/**";
  await page.route(pattern, (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
  return () => page.unroute(pattern);
}

export const savedError = (page: Page) => page.getByRole("alert").filter({ hasText: "not saved" });
