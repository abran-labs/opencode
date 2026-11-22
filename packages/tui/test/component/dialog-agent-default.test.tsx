import { expect, test } from "bun:test"
import { CliRenderEvents, InputRenderable } from "@opentui/core"
import { once } from "node:events"
import { DialogModel } from "../../src/component/dialog-model"
import { agent, model, renderLocal } from "../fixture/local"
import { json } from "../fixture/tui-client"

test("model dialog sets the highlighted model as an agent default, listing subagents", async () => {
  const patches: unknown[] = []
  await using setup = await renderLocal({
    models: [model("first")],
    agents: [agent("build"), { ...agent("explore"), mode: "subagent" }],
    fetch: async (url, request) => {
      if (url.pathname !== "/api/experimental/config" || request.method !== "PATCH") return
      patches.push(await request.json())
      return new Response(null, { status: 204 })
    },
  })
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("Select model") && frame.includes("first"))
  if (!(setup.renderer.currentFocusedRenderable instanceof InputRenderable))
    await once(setup.renderer, CliRenderEvents.FOCUSED_RENDERABLE)
  setup.mockInput.pressKey("g", { ctrl: true })
  await setup.waitForFrame((frame) => frame.includes("Subagents") && frame.includes("explore") && frame.includes("build"))
  await setup.mockInput.typeText("explore")
  await setup.renderOnce()
  setup.mockInput.pressEnter()
  await setup.waitFor(() => patches.length === 1)
  expect(patches[0]).toEqual({ agents: { explore: { model: "provider/first" } } })
})

test("plain Enter in the model dialog still selects the model", async () => {
  await using setup = await renderLocal({ models: [model("first")] })
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("Select model") && frame.includes("first"))
  if (!(setup.renderer.currentFocusedRenderable instanceof InputRenderable))
    await once(setup.renderer, CliRenderEvents.FOCUSED_RENDERABLE)
  setup.mockInput.pressEnter()
  await setup.waitFor(() => setup.dialog.stack.length === 0)
  expect(setup.local.model.current()).toEqual({ providerID: "provider", modelID: "first" })
})

test.each([100, 44])("free model dialog offers the agent default action at width %d", async (width) => {
  const patches: unknown[] = []
  await using setup = await renderLocal({
    width,
    newDesigns: true,
    models: [{ ...model("first"), cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }] }],
    agents: [agent("build"), { ...agent("explore"), mode: "subagent" }],
    fetch: async (url, request) => {
      if (url.pathname !== "/api/experimental/config" || request.method !== "PATCH") return
      patches.push(await request.json())
      return new Response(null, { status: 204 })
    },
  })
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("Free models") && frame.includes("first"))
  if (!(setup.renderer.currentFocusedRenderable instanceof InputRenderable))
    await once(setup.renderer, CliRenderEvents.FOCUSED_RENDERABLE)
  setup.mockInput.pressKey("g", { ctrl: true })
  await setup.waitForFrame((frame) => frame.includes("Subagents") && frame.includes("explore"))
  setup.mockInput.pressEscape()
  await setup.renderOnce()
  expect(patches).toEqual([])
})

test("agent picker shows the resolved agent model with its variant", async () => {
  await using setup = await renderLocal({
    models: [model("first")],
    agents: [
      agent("build", { providerID: "provider", id: "resolved", variant: "high" }),
      { ...agent("explore", { providerID: "provider", id: "plain" }), mode: "subagent" },
    ],
    // Layered config must not be guessed at; only the resolved agent model is shown.
    fetch: (url) => {
      if (url.pathname === "/api/config")
        return json([{ type: "document", info: { agents: { explore: { model: "provider/configured" } } } }])
    },
  })
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("Select model") && frame.includes("first"))
  if (!(setup.renderer.currentFocusedRenderable instanceof InputRenderable))
    await once(setup.renderer, CliRenderEvents.FOCUSED_RENDERABLE)
  setup.mockInput.pressKey("g", { ctrl: true })
  await setup.waitForFrame((frame) => frame.includes("provider/resolved#high") && frame.includes("provider/plain"))
  expect(setup.captureCharFrame()).not.toContain("configured")
})

test.each([
  ["same model keeps its variant", "first", "provider/first#high"],
  ["different model drops the variant", "second", "provider/second"],
])("%s", async (_name, modelID, expected) => {
  const patches: unknown[] = []
  await using setup = await renderLocal({
    models: [model("first", ["high"]), model("second", ["low"])],
    agents: [agent("build", { providerID: "provider", id: "first", variant: "high" })],
    fetch: async (url, request) => {
      if (url.pathname !== "/api/experimental/config" || request.method !== "PATCH") return
      patches.push(await request.json())
      return new Response(null, { status: 204 })
    },
  })
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("Select model") && frame.includes(modelID))
  if (!(setup.renderer.currentFocusedRenderable instanceof InputRenderable))
    await once(setup.renderer, CliRenderEvents.FOCUSED_RENDERABLE)
  await setup.mockInput.typeText(modelID)
  await setup.renderOnce()
  setup.mockInput.pressKey("g", { ctrl: true })
  await setup.waitForFrame((frame) => frame.includes("Primary agents") && frame.includes("build"))
  setup.mockInput.pressEnter()
  await setup.waitFor(() => patches.length === 1)
  expect(patches[0]).toEqual({ agents: { build: { model: expected } } })
})
