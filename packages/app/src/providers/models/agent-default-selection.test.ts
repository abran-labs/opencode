import { describe, expect, test } from "bun:test"
import { agentDefaultSelection } from "./agent-default-selection"

const target = { providerID: "openai", modelID: "gpt-5" }

describe("agentDefaultSelection", () => {
  test.each([
    ["same model keeps its variant", { model: target, variant: "high" }, "openai/gpt-5#high"],
    ["same model without a variant", { model: target }, "openai/gpt-5"],
    [
      "another model drops the variant",
      { model: { providerID: "openai", modelID: "gpt-4" }, variant: "high" },
      "openai/gpt-5",
    ],
    [
      "another provider drops the variant",
      { model: { providerID: "azure", modelID: "gpt-5" }, variant: "high" },
      "openai/gpt-5",
    ],
    ["no configured model", {}, "openai/gpt-5"],
  ])("%s", (_, agent, expected) => {
    expect(agentDefaultSelection(target, agent)).toBe(expected)
  })
})
