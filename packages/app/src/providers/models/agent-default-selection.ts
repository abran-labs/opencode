type Target = { providerID: string; modelID: string }

type Agent = { model?: Target; variant?: string }

// The config value an agent saves for `target`. A variant belongs to one model: saving the model the agent already
// uses keeps its variant, any other model starts without one since the old variant may not exist on it.
export function agentDefaultSelection(target: Target, agent: Agent) {
  const same = agent.model?.providerID === target.providerID && agent.model.modelID === target.modelID

  return `${target.providerID}/${target.modelID}${same && agent.variant ? `#${agent.variant}` : ""}`
}

type Section<T> = { category: string; items: T[]; title?: string }

/**
 * Sections with the agent's default moved into a first section of its own. It leaves every other section, so it is
 * listed once, and the sections that remain keep their order.
 */
export function withAgentDefault<T extends { id: string; provider: { id: string } }>(
  sections: Section<T>[],
  isDefault: (item: T) => boolean,
  title: string,
): Section<T>[] {
  const item = sections.flatMap((section) => section.items).find(isDefault)

  if (!item) return sections

  return [
    { category: "default", title, items: [item] },
    ...sections.flatMap((section) => {
      const items = section.items.filter((entry) => entry !== item)

      return items.length > 0 ? [{ ...section, items }] : []
    }),
  ]
}
