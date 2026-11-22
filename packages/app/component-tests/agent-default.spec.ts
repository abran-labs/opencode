import { expect, story } from "../../stories/playwright/story"

story("the pin saves the current agent's default, which leads the list once", async ({ page, mount }) => {
  await mount("app-dialog-model-selector--agent-default")
  const saved = page.locator('[data-slot="config-requests"] li')
  const search = page.getByRole("combobox", { name: "Search models" })
  const option = (name: RegExp) => page.getByRole("option", { name })

  // Plan's configured model leads under its own heading and is not repeated in its provider group.
  await expect(page.getByText("Default for Plan")).toBeVisible()
  await expect(option(/Claude Sonnet 5/)).toHaveCount(1)
  await expect(page.locator('[data-slot="search-list-row"]').first()).toContainText("Claude Sonnet 5")
  await expect(option(/Claude Sonnet 5/).locator('[data-slot="model-default-pin"]')).toHaveAttribute("data-active", "")

  await search.fill("Kimi")
  const row = option(/Kimi K3/)
  await expect(row).toContainText("Default for Explore")
  await row.hover()
  await row.locator('[data-slot="model-default-pin"]').hover()
  await expect(page.getByText("Set as default model")).toBeVisible()
  await row.getByRole("button", { name: "Set as default model" }).click()

  await expect(saved).toHaveText([JSON.stringify({ agents: { plan: { model: "opencode-go/kimi-k3" } } })])
  // The new default moves to the top at once, still once, and the old one is just a row again.
  await expect(page.locator('[data-slot="search-list-row"]').first()).toContainText("Kimi K3")
  await expect(option(/Kimi K3/)).toHaveCount(1)
  await expect(row.locator('[data-slot="model-default-pin"]')).toHaveAttribute("data-active", "")

  // The shortcut saves the highlighted row, with no second control involved.
  await search.fill("Pickle")
  await page.keyboard.press("ControlOrMeta+g")
  await expect(saved).toHaveCount(2)
  await expect(saved.nth(1)).toHaveText(JSON.stringify({ agents: { plan: { model: "opencode/big-pickle" } } }))
  await search.fill("Kimi")

  // A normal click still selects for the chat and saves nothing more.
  await row.click()
  await expect(page.getByRole("button", { name: "Kimi K3" })).toBeVisible()
  await expect(saved).toHaveCount(2)
})

story("the free picker marks favorites and defaults without moving the rows", async ({ page, mount }) => {
  await mount("app-dialog-select-model--without-providers")
  const rows = page.locator("button[data-model-row]")

  await expect(rows.filter({ hasText: "North Mini Code" })).toContainText("Default for Plan")
  const names = rows.locator(":scope > span:first-child").first()
  await expect(names).toBeVisible()
  const labels = rows.locator(":scope > span:first-child")
  const order = await labels.allTextContents()
  await page.getByRole("button", { name: "Favorite" }).nth(2).click()
  await expect(page.getByRole("button", { name: "Unfavorite" })).toHaveCount(1)
  await expect(labels).toHaveText(order)
  await page.getByRole("button", { name: "Set as default model" }).last().click()
  await expect(rows.last()).toContainText("Default for Plan")
  await expect(labels).toHaveText(order)
})
