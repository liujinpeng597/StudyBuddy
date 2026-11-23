import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("test@studybuddy.local");
  await page.getByLabel("密码").fill("studybuddy-local-test-2026");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

test("opens the workbench on all viewports", async ({ page }, testInfo) => {
  await login(page);
  await expect(page.getByRole("heading", { name: /今日整合/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "工作区" })).toBeVisible();
  const wovenNodes = page.locator("details.today-disclosure").filter({ hasText: "今日织入" });
  const wovenRelations = page
    .locator("details.today-disclosure")
    .filter({ hasText: "串起来的联系" });
  await expect(wovenNodes.locator(".list-item").first()).toBeHidden();
  await wovenNodes.locator("summary").click();
  await expect(wovenNodes.locator(".list-item").first()).toBeVisible();
  await expect(wovenRelations.locator(".list-item").first()).toBeHidden();
  await wovenRelations.locator("summary").click();
  await expect(wovenRelations.locator(".list-item").first()).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "打开目录" }).click();
  }
  await expect(page.getByText("全部知识", { exact: true })).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-today.png`),
    fullPage: true
  });
  if (testInfo.project.name === "mobile") {
    await expect(page.getByLabel("知识目录")).toBeVisible();
  }
});

test("searches knowledge and opens a result", async ({ page }, testInfo) => {
  await login(page);
  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".inline-search.mobile")).toBeVisible();
  }
  const input = (
    testInfo.project.name === "mobile"
      ? page.locator(".inline-search.mobile")
      : page.locator(".inline-search.topbar")
  ).getByRole("combobox");
  await input.click();
  await input.fill("虚函数");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-inline-search.png`),
    fullPage: false
  });
  await page.getByRole("option").first().click();
  await expect(page).toHaveURL(/\/knowledge\//);
  await expect(page.getByRole("main")).toContainText("虚函数");
  await expect(page.getByRole("heading", { level: 1, name: "C++ 虚函数" })).toBeVisible();
  await expect(page.getByText("核心定义", { exact: true })).toBeVisible();
  await expect(page.getByText("属性与场景", { exact: true })).toBeVisible();
  await expect(page.getByText("优缺点对照", { exact: true })).toBeVisible();
  await expect(page.getByText("相近知识点对比", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: /C\+\+ 多态/ })
  ).toBeVisible();
});

test("collapses and expands directory groups", async ({ page }, testInfo) => {
  await login(page);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "打开目录" }).click();
  }
  const tree = page.getByRole("navigation", { name: "知识树" });
  const cppToggle = tree.getByRole("button", { name: /^C\+\+/ });
  await expect(tree.getByText("C++ 多态", { exact: true })).toBeVisible();
  await cppToggle.evaluate((button) => (button as HTMLButtonElement).click());
  await expect(tree.getByText("C++ 多态", { exact: true })).toBeHidden();
  await cppToggle.evaluate((button) => (button as HTMLButtonElement).click());
  await expect(tree.getByText("C++ 多态", { exact: true })).toBeVisible();
});

test("shows graph, review and model settings", async ({ page }, testInfo) => {
  await login(page);
  await page.getByRole("link", { name: "知识图", exact: true }).click();
  await expect(page.getByRole("heading", { name: "层级知识网络" })).toBeVisible();
  const rootNode = page.locator('[data-graph-node-id="graph-root"]');
  await expect(rootNode).toHaveAttribute("aria-expanded", "true");
  await rootNode.click();
  await expect(rootNode).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".graph-node-module").first()).toBeHidden();
  await rootNode.click();
  await expect(rootNode).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".mindmap-module-node").first()).toBeVisible();
  const zoomLabel = page.locator(".graph-zoom");
  const zoomBefore = await zoomLabel.textContent();
  await page.getByLabel("知识思维导图").hover();
  await page.mouse.wheel(0, -320);
  await expect(zoomLabel).not.toHaveText(zoomBefore ?? "");
  await expect(page.locator(".graph-node-knowledge").first()).toBeVisible();
  await expect(
    page.locator(".mindmap-viewport").getByText("进程间通信", { exact: true })
  ).toBeVisible();
  await page.locator(".graph-node-knowledge").first().hover();
  await expect(page.locator(".graph-popover")).toBeVisible();
  await page.getByRole("button", { name: "连线模式" }).click();
  await expect(page.getByRole("button", { name: "连线模式" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.getByRole("button", { name: "连线模式" }).click();
  await page.getByRole("button", { name: "进入沉浸模式" }).click();
  await expect(page.locator(".graph-workspace.is-immersive")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".graph-workspace.is-immersive")).toBeHidden();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "打开目录" }).click();
  }
  await page
    .getByLabel("知识目录")
    .getByRole("link", { name: "C++ 虚函数", exact: true })
    .click();
  await expect(page).toHaveURL(/\/knowledge\//);
  await expect(page.getByRole("heading", { level: 1, name: "C++ 虚函数" })).toBeVisible();
  await page.getByRole("link", { name: "测试" }).click();
  await expect(page.getByRole("heading", { name: "测试与错题" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /今日测试/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /错题表/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /作答记录/ })).toBeVisible();
  await expect(page.getByText("以下哪项最符合虚函数的作用？")).toBeVisible();
  await page.getByRole("button", { name: "总设置" }).click();
  await expect(page.getByRole("menuitem", { name: "模型设置" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "显示与展开" })).toBeVisible();
  await page.getByRole("menuitem", { name: "模型设置" }).click();
  await expect(page.getByRole("heading", { name: "模型设置" })).toBeVisible();
  await expect(page.getByText("DeepSeek V4.1 Flash")).toBeVisible();
  await page.getByRole("button", { name: "总设置" }).click();
  await page.getByRole("menuitem", { name: "显示与展开" }).click();
  await expect(page.getByRole("heading", { name: "显示与展开" })).toBeVisible();
  await expect(page.getByText("左侧知识目录", { exact: true })).toBeVisible();
  await expect(page.getByText("知识思维导图", { exact: true })).toBeVisible();
});

test("shows transient feedback as an auto-dismissing toast", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Toast timing only needs one viewport");
  await login(page);
  await page.getByRole("button", { name: "总设置" }).click();
  await page.getByRole("menuitem", { name: "显示与展开" }).click();
  await page.getByRole("button", { name: "保存设置" }).click();
  const toast = page.locator(".toast-item").filter({ hasText: "设置已保存" });
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 6_000 });
});

test("captures visual states", async ({ page }, testInfo) => {
  await login(page);
  await page.getByRole("link", { name: "知识图", exact: true }).click();
  await expect(page.locator(".mindmap-module-node").first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-graph.png`),
    fullPage: true
  });
  await page.getByRole("link", { name: "测试" }).click();
  await expect(page.getByRole("heading", { name: "测试与错题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成新题" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-review.png`),
    fullPage: true
  });
  await page.goto("/settings/models");
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-models.png`),
    fullPage: true
  });
  await page.goto("/imports");
  await expect(page.getByRole("heading", { name: "导入与整理" })).toBeVisible();
  await expect(page.getByText(/本次整理 2 个知识点/)).toBeVisible();
  await expect(page.getByText(/\[object Object\]/)).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-imports.png`),
    fullPage: true
  });
  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { name: "账户与数据" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-account.png`),
    fullPage: true
  });
});
