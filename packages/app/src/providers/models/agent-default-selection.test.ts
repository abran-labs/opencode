import { describe, expect, test } from "bun:test"
import { agentDefaultSelection, withAgentDefault } from "./agent-default-selection"

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

describe("withAgentDefault", () => {
  const model = (provider: string, id: string) => ({ id, provider: { id: provider } })
  const a = model("openai", "a")
  const b = model("openai", "b")
  const c = model("anthropic", "c")

  const sections = [
    { category: "favorite", title: "Favorites", items: [b, c] },
    { category: "recent", title: "Recent", items: [a] },
    { category: "openai", items: [model("openai", "d")] },
  ]

  test("lists the default once, above favorites, and removes emptied sections", () => {
    const result = withAgentDefault(sections, (item) => item === a, "Default for Plan")

    expect(result.map((section) => [section.category, section.items.map((item) => item.id)])).toEqual([
      ["default", ["a"]],
      ["favorite", ["b", "c"]],
      ["openai", ["d"]],
    ])
  })

  test("takes a favorite out of Favorites", () => {
    const result = withAgentDefault(sections, (item) => item === c, "Default for Plan")

    expect(result.flatMap((section) => section.items).filter((item) => item === c)).toHaveLength(1)
    expect(result[0].category).toBe("default")
  })

  test("changes nothing when the default is not listed, such as one a search filtered out", () => {
    expect(withAgentDefault(sections, () => false, "Default for Plan")).toBe(sections)
  })
})
