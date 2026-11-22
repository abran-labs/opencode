import { expect, test } from "bun:test"
import { CliRenderEvents, InputRenderable } from "@opentui/core"
import { once } from "node:events"
import { DialogModel } from "../../src/component/dialog-model"
import { agent, model, renderLocal } from "../fixture/local"

const free = { ...model("first"), cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }] }

function patchRecorder() {
  const patches: unknown[] = []
  return {
    patches,
    fetch: async (url: URL, request: Request) => {
      if (url.pathname !== "/api/experimental/config" || request.method !== "PATCH") return
      patches.push(await request.json())
      return new Response(null, { status: 204 })
    },
  }
}

test("ctrl+g sets the highlighted model as the current agent default without switching the session", async () => {
  const recorder = patchRecorder()
  await using setup = await renderLocal({
    models: [model("first"), model("second")],
    agents: [agent("build"), { ...agent("explore"), mode: "subagent" }],
    fetch: recorder.fetch,
  })
  const before = setup.local.model.current()
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("Select model") && frame.includes("first"))
  if (!(setup.renderer.currentFocusedRenderable instanceof InputRenderable))
    await once(setup.renderer, CliRenderEvents.FOCUSED_RENDERABLE)
  await setup.mockInput.typeText("second")
  await setup.renderOnce()
  setup.mockInput.pressKey("g", { ctrl: true })
  await setup.waitFor(() => recorder.patches.length === 1)
  expect(recorder.patches[0]).toEqual({ agents: { build: { model: "provider/second" } } })
  // No second dialog opens and the session model is untouched.
  expect(setup.local.model.current()).toEqual(before)
  expect(setup.captureCharFrame()).not.toContain("Subagents")
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

test.each([100, 44])("free model dialog ctrl+g sets the agent default at width %d", async (width) => {
  const recorder = patchRecorder()
  await using setup = await renderLocal({
    width,
    newDesigns: true,
    models: [free],
    agents: [agent("build"), { ...agent("explore"), mode: "subagent" }],
    fetch: recorder.fetch,
  })
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("Free models") && frame.includes("first"))
  if (!(setup.renderer.currentFocusedRenderable instanceof InputRenderable))
    await once(setup.renderer, CliRenderEvents.FOCUSED_RENDERABLE)
  setup.mockInput.pressKey("g", { ctrl: true })
  await setup.waitFor(() => recorder.patches.length === 1)
  expect(recorder.patches[0]).toEqual({ agents: { build: { model: "provider/first" } } })
})

test.each([100, 44, 30])("free model footer keeps action labels intact at width %d", async (width) => {
  await using setup = await renderLocal({ width, newDesigns: true, models: [free], agents: [agent("build")] })
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("first"))
  await setup.renderOnce()
  const frame = setup.captureCharFrame()
  expect(frame).toContain("connect provider")
  expect(frame).toContain("favorite")
  // At 30 cells the footer wraps by word and its last row is below the test terminal's height.
  if (width > 30) expect(frame).toContain("set as agent default")
})

test.each([
  ["same model keeps its variant", "first", "provider/first#high"],
  ["different model drops the variant", "second", "provider/second"],
])("%s", async (_name, modelID, expected) => {
  const recorder = patchRecorder()
  await using setup = await renderLocal({
    models: [model("first", ["high"]), model("second", ["low"])],
    agents: [agent("build", { providerID: "provider", id: "first", variant: "high" })],
    fetch: recorder.fetch,
  })
  setup.dialog.replace(() => <DialogModel />)
  await setup.waitForFrame((frame) => frame.includes("Select model") && frame.includes(modelID))
  if (!(setup.renderer.currentFocusedRenderable instanceof InputRenderable))
    await once(setup.renderer, CliRenderEvents.FOCUSED_RENDERABLE)
  await setup.mockInput.typeText(modelID)
  await setup.renderOnce()
  setup.mockInput.pressKey("g", { ctrl: true })
  await setup.waitFor(() => recorder.patches.length === 1)
  expect(recorder.patches[0]).toEqual({ agents: { build: { model: expected } } })
})
