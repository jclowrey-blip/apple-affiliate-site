import { expect, test } from "@playwright/test";
import {
  card,
  columnList,
  columns,
  dragCard,
  failServerActions,
  PROJECT,
  quickAdd,
  savedError,
  shortcut,
  taskPanel,
} from "./helpers";

test.describe("separation from the storefront", () => {
  test("every /pm page is noindex", async ({ page }) => {
    for (const path of ["/pm", `${PROJECT}/board`, `${PROJECT}/list`, `${PROJECT}/timeline`]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    }
  });

  test("storefront pages keep their chrome and never link to /pm", async ({ page }) => {
    for (const path of ["/", "/category/iphone", "/compare", "/guides", "/disclosure", "/privacy"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Affiliate disclosure", exact: true })).toBeVisible();
      await expect(page.locator('a[href^="/pm"]')).toHaveCount(0);
    }
  });

  test("/pm does not render the storefront header or footer", async ({ page }) => {
    await page.goto("/pm");
    await expect(page.getByText("Amazon Services LLC Associates Program")).toHaveCount(0);
  });
});

test.describe("dashboard", () => {
  test("shows projects with progress, overdue and due-this-week tasks", async ({ page }) => {
    await page.goto("/pm");
    await expect(page.getByRole("heading", { name: "Orchard storefront" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "2 of 9 tasks done" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "1 of 6 tasks done" })).toBeVisible();

    const overdue = page.locator("section", { has: page.getByRole("heading", { name: /Overdue/ }) });
    await expect(overdue.getByRole("link")).toHaveCount(2);
    await expect(overdue.getByRole("link", { name: /Have a lawyer review/ })).toBeVisible();
  });

  test("a task opens in the side panel over the dashboard", async ({ page }) => {
    await page.goto("/pm");
    await page.getByRole("link", { name: /Have a lawyer review/ }).click();
    await expect(taskPanel(page)).toBeVisible();
    await expect(page).toHaveURL(/\/pm\?task=/);
  });
});

test.describe("tasks", () => {
  test('"n" opens quick-add on every view without typing the letter', async ({ page }) => {
    for (const path of ["/pm", `${PROJECT}/board`, `${PROJECT}/list`, `${PROJECT}/timeline`]) {
      await page.goto(path);
      const dialog = await shortcut(page, "n", "New task");
      await expect(dialog.getByLabel("Task title")).toHaveValue("");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("a created task persists after reload", async ({ page }) => {
    await quickAdd(page, "Created by e2e");
    await page.reload();
    expect((await columns(page))["To do"]).toContain("Created by e2e");
  });

  test("edits in the panel persist and the URL is shareable", async ({ page }) => {
    await quickAdd(page, "Edit me");
    await page.getByRole("link", { name: "Edit me" }).click();
    const panel = taskPanel(page);
    await expect(panel).toBeVisible();
    const url = page.url();

    await panel.getByLabel("Title", { exact: true }).fill("Edited by e2e");
    await panel.getByLabel("Title", { exact: true }).press("Enter");
    await panel.getByLabel("Priority").selectOption("high");
    await panel.getByLabel("Due date", { exact: true }).fill("2027-01-15");
    await panel.getByLabel("Milestone").selectOption({ index: 1 });
    await panel.getByLabel("Labels").fill("e2e-label");
    await panel.getByLabel("Labels").press("Enter");
    await panel.getByRole("button", { name: "Add description" }).click();
    await panel.getByLabel("Description (markdown)").fill("Some **bold** text");
    await panel.getByRole("button", { name: "Save" }).click();
    await panel.getByLabel("New subtask").fill("first subtask");
    await panel.getByLabel("New subtask").press("Enter");
    await panel.getByRole("checkbox", { name: "first subtask done" }).check();
    await expect(page.getByText("1/1")).toBeVisible();
    await expect(card(page, "Edited by e2e")).toContainText("e2e-label");

    await page.goto(url);
    await expect(panel.getByLabel("Title", { exact: true })).toHaveValue("Edited by e2e");
    await expect(panel.getByLabel("Priority")).toHaveValue("high");
    await expect(panel.getByLabel("Due date", { exact: true })).toHaveValue("2027-01-15");
    await expect(panel.getByLabel("Milestone")).not.toHaveValue("");
    await expect(panel.getByRole("button", { name: "Remove label e2e-label" })).toBeVisible();
    await expect(panel.locator("strong", { hasText: "bold" })).toBeVisible();
    await expect(panel.getByRole("checkbox", { name: "first subtask done" })).toBeChecked();

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page).not.toHaveURL(/task=/);
  });

  test("deleting asks for confirmation and persists", async ({ page }) => {
    await quickAdd(page, "Delete me");
    await page.getByRole("link", { name: "Delete me" }).click();
    const panel = taskPanel(page);
    await expect(panel).toBeVisible();
    const url = page.url();

    await panel.getByRole("button", { name: "Delete task" }).click();
    await expect(panel.getByText("Delete this task?")).toBeVisible();
    await panel.getByRole("button", { name: "Cancel" }).click();
    await expect(panel.getByLabel("Title", { exact: true })).toHaveValue("Delete me");

    await panel.getByRole("button", { name: "Delete task" }).click();
    await panel.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(panel).toBeHidden();

    await page.goto(`${PROJECT}/board`);
    await expect(page.getByRole("link", { name: "Delete me" })).toHaveCount(0);
    await page.goto(url);
    await expect(page.getByText("Task not found")).toBeVisible();
  });
});

test.describe("board", () => {
  test("dragging between columns persists", async ({ page }) => {
    await quickAdd(page, "Drag across");
    await dragCard(page, "Drag across", columnList(page, "Backlog"), "bottom");
    await expect.poll(async () => (await columns(page))["Backlog"]).toContain("Drag across");
    await page.waitForLoadState("networkidle");
    await page.reload();
    const after = await columns(page);
    expect(after["Backlog"]).toContain("Drag across");
    expect(after["To do"]).not.toContain("Drag across");
  });

  test("reordering within a column persists", async ({ page }) => {
    await page.goto(`${PROJECT}/board`);
    const before = (await columns(page))["Done"];
    expect(before.length).toBeGreaterThanOrEqual(2);
    const first = before[0];
    const last = before[before.length - 1];

    await dragCard(page, first, card(page, last), "bottom");
    const expected = [...before.slice(1), first];
    await expect.poll(async () => (await columns(page))["Done"]).toEqual(expected);
    await page.waitForLoadState("networkidle");
    await page.reload();
    expect((await columns(page))["Done"]).toEqual(expected);
  });

  test("a failed move rolls back and shows an error", async ({ page }) => {
    await page.goto(`${PROJECT}/board`);
    const before = await columns(page);
    const restore = await failServerActions(page);
    await dragCard(page, before["Done"][0], columnList(page, "Backlog"));
    await expect(savedError(page)).toBeVisible();
    expect(await columns(page)).toEqual(before);
    await restore();
    await page.reload();
    expect(await columns(page)).toEqual(before);
  });
});

test.describe("list", () => {
  const rows = (page: import("@playwright/test").Page) => page.locator("tbody tr");
  const titles = (page: import("@playwright/test").Page) => page.locator("tbody tr td:first-child a").allTextContents();

  test("inline status and priority edits persist", async ({ page }) => {
    await quickAdd(page, "Inline edit");
    await page.goto(`${PROJECT}/list`);
    await page.getByLabel("Status of Inline edit").selectOption("in_progress");
    await page.getByLabel("Priority of Inline edit").selectOption("low");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByLabel("Status of Inline edit")).toHaveValue("in_progress");
    await expect(page.getByLabel("Priority of Inline edit")).toHaveValue("low");
  });

  test("a failed inline edit rolls back and shows an error", async ({ page }) => {
    await page.goto(`${PROJECT}/list`);
    const select = page.getByLabel("Status of Have a lawyer review DISCLOSURE.md");
    const original = await select.inputValue();
    const restore = await failServerActions(page);
    await select.selectOption("done");
    await expect(savedError(page)).toBeVisible();
    await expect(select).toHaveValue(original);
    await restore();
  });

  test("filters by status, priority, label and due date", async ({ page }) => {
    await page.goto(`${PROJECT}/list`);
    const total = await rows(page).count();

    await page.getByLabel("Filter by label").selectOption("legal");
    await expect(rows(page)).toHaveCount(1);
    await page.getByLabel("Filter by status").selectOption("done");
    await expect(page.getByText("No tasks match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(rows(page)).toHaveCount(total);

    await page.getByLabel("Filter by due date").selectOption("overdue");
    expect(await titles(page)).toEqual(["Have a lawyer review DISCLOSURE.md"]);
    await page.getByLabel("Filter by due date").selectOption("all");

    await page.getByLabel("Filter by priority").selectOption("high");
    for (const select of await page.locator('tbody select[aria-label^="Priority of"]').all()) {
      await expect(select).toHaveValue("high");
    }
  });

  test("sorts by a column in both directions", async ({ page }) => {
    await page.goto(`${PROJECT}/list`);
    const byTitle = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

    await page.getByRole("button", { name: "Title" }).click();
    const ascending = await titles(page);
    expect(ascending).toEqual([...ascending].sort(byTitle));
    await expect(page.getByRole("columnheader", { name: "Title" })).toHaveAttribute("aria-sort", "ascending");

    await page.getByRole("button", { name: "Title" }).click();
    expect(await titles(page)).toEqual([...ascending].reverse());
    await expect(page.getByRole("columnheader", { name: "Title" })).toHaveAttribute("aria-sort", "descending");
  });

  test("filters and sort live in the URL: they survive reload and opening a task", async ({ page }) => {
    await page.goto(`${PROJECT}/list`);
    await page.getByLabel("Filter by label").selectOption("compliance");
    await page.getByRole("button", { name: "Due" }).click();
    await page.getByRole("button", { name: "Due" }).click();
    await expect(page).toHaveURL(/label=compliance/);
    await expect(page).toHaveURL(/sort=due&dir=desc/);
    const filtered = await titles(page);

    await page.reload();
    await expect(page.getByLabel("Filter by label")).toHaveValue("compliance");
    expect(await titles(page)).toEqual(filtered);

    await page.getByRole("link", { name: filtered[0] }).click();
    await expect(taskPanel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(taskPanel(page)).toBeHidden();
    await expect(page).toHaveURL(/label=compliance/);
    expect(await titles(page)).toEqual(filtered);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/label=/);
  });

  test("ignores unknown filter values in the URL", async ({ page }) => {
    await page.goto(`${PROJECT}/list?status=bogus&label=does-not-exist&sort=nope`);
    await expect(page.getByLabel("Filter by status")).toHaveValue("all");
    await expect(page.getByLabel("Filter by label")).toHaveValue("all");
    expect(await rows(page).count()).toBeGreaterThan(0);
  });
});

test.describe("task panel", () => {
  test("a failed subtask toggle rolls back and shows an error", async ({ page }) => {
    await page.goto(`${PROJECT}/board`);
    await page.getByRole("link", { name: "Write three buying guides" }).click();
    const checkbox = taskPanel(page).getByRole("checkbox", { name: "Which AirPods? done" });
    await expect(checkbox).not.toBeChecked();
    const restore = await failServerActions(page);
    await checkbox.click();
    await expect(savedError(page)).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await restore();
  });

  test("an unknown task id shows a not-found panel", async ({ page }) => {
    await page.goto("/pm?task=does-not-exist");
    await expect(page.getByRole("dialog", { name: "Task not found" })).toBeVisible();
  });
});

test.describe("search", () => {
  test("Ctrl+K finds tasks in any project and opens the result", async ({ page }) => {
    await page.goto(`${PROJECT}/board`);
    const dialog = await shortcut(page, "Control+k", "Search tasks");

    await page.keyboard.type("restricts affiliate"); // only in a description, in the other project
    await expect(dialog.getByRole("option")).toHaveCount(1);
    await expect(dialog.getByRole("option")).toContainText("Weekly newsletter");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: /Check affiliate link rules/ })).toBeVisible();
  });

  test("shows a no-results state", async ({ page }) => {
    await page.goto("/pm");
    await shortcut(page, "Control+k", "Search tasks");
    await page.keyboard.type("zzzz-no-such-task");
    await expect(page.getByText("No tasks match")).toBeVisible();
  });
});

test.describe("timeline", () => {
  test("groups tasks by milestone and opens a task over the view", async ({ page }) => {
    await page.goto(`${PROJECT}/timeline`);
    const associates = page.locator('section[aria-label="Milestone Associates application"]');
    await expect(associates.getByRole("link", { name: /Apply to Amazon Associates/ })).toBeVisible();
    await expect(page.locator('section[aria-label="Milestone Live product data"]')).toBeVisible();
    await expect(page.locator('section[aria-label="No milestone"]')).toBeVisible();

    await associates.getByRole("link", { name: /Apply to Amazon Associates/ }).click();
    await expect(taskPanel(page)).toBeVisible();
    await expect(page).toHaveURL(/\/timeline\?task=/);
  });

  test("a milestone can be added, persists, and can be deleted", async ({ page }) => {
    await page.goto(`${PROJECT}/timeline`);
    await page.getByRole("button", { name: "Add milestone" }).click();
    await page.getByLabel("Milestone name").fill("E2E milestone");
    await page.getByLabel("Target date").fill("2027-02-01");
    await page.getByRole("button", { name: "Add milestone" }).click();

    const section = page.locator('section[aria-label="Milestone E2E milestone"]');
    await expect(section).toBeVisible();
    await page.reload();
    await expect(section).toBeVisible();

    await section.getByRole("button", { name: "Edit" }).click();
    await section.getByRole("button", { name: "Delete" }).click();
    await section.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(section).toHaveCount(0);
  });
});

test.describe("empty states", () => {
  test("a new project is empty on every view, and can be deleted", async ({ page }) => {
    await page.goto("/pm");
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill("E2E empty project");
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(/\/pm\/e2e-empty-project\/board/);
    await expect(page.getByText("No tasks yet")).toBeVisible();
    await page.getByRole("link", { name: "List", exact: true }).click();
    await expect(page).toHaveURL(/\/list/);
    await expect(page.getByText("No tasks yet")).toBeVisible();
    await page.getByRole("link", { name: "Timeline", exact: true }).click();
    await expect(page.getByText("Nothing on the timeline yet")).toBeVisible();

    await page.getByRole("button", { name: "Edit project" }).click();
    await page.getByRole("button", { name: "Delete project…" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/pm$/);
    await expect(page.getByRole("link", { name: /E2E empty project/ })).toHaveCount(0);
  });

  test("an unknown project shows a not-found page", async ({ page }) => {
    const response = await page.goto("/pm/no-such-project/board");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Project not found")).toBeVisible();
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 720 } });

  test("no view overflows the page horizontally", async ({ page }) => {
    for (const path of ["/pm", `${PROJECT}/board`, `${PROJECT}/list`, `${PROJECT}/timeline`]) {
      await page.goto(path);
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflows, `${path} overflows at 375px`).toBe(false);
    }
  });

  test("the task panel fills the screen and its controls are usable", async ({ page }) => {
    await page.goto(`${PROJECT}/list`);
    await page.getByRole("link", { name: "Apply to Amazon Associates" }).click();
    const panel = taskPanel(page);
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box?.width).toBe(375);
    await panel.getByLabel("Status").selectOption("done");
    await expect(panel.getByLabel("Status")).toHaveValue("done");
  });
});
