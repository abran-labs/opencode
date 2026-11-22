import { expect, story } from "../../stories/playwright/story"

story.beforeEach(async ({ mount }) => {
  await mount("app-dialog-model-selector--agent-default")
})

story("saves the chosen model for an agent and leaves the session model alone", async ({ page }) => {
  const session = page.getByRole("button", { name: "Claude Opus 5.5" })
  const saved = page.locator('[data-slot="config-requests"] li')

  const pick = async (agent: string) => {
    await page.getByRole("combobox", { name: "Search models" }).fill("Kimi")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ControlOrMeta+g")
    await expect(page.getByText("Set default for agent: Kimi K3")).toBeVisible()
    await page.getByRole("button", { name: new RegExp(`^${agent}`) }).click()
  }

  await pick("Explore")
  await expect(saved).toHaveText([JSON.stringify({ agents: { explore: { model: "opencode-go/kimi-k3#fast" } } })])

  await session.click()
  await page.getByRole("combobox", { name: "Search models" }).fill("Kimi")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ControlOrMeta+g")
  // The effective variant shows, and a different model does not inherit it.
  await expect(page.getByText("Current default: Claude Opus 5.5 (high)")).toBeVisible()
  await expect(page.getByText("Current default: Kimi K3 (fast)")).toBeVisible()
  await page.getByRole("button", { name: /^Review/ }).click()
  await expect(saved).toHaveCount(2)
  await expect(saved.nth(1)).toHaveText(JSON.stringify({ agents: { review: { model: "opencode-go/kimi-k3" } } }))

  // The session still uses the model it had.
  await expect(session).toBeVisible()
})
