type Target = { providerID: string; modelID: string }

type Agent = { model?: Target; variant?: string }

// The config value an agent saves for `target`. A variant belongs to one model: saving the model the agent already
// uses keeps its variant, any other model starts without one since the old variant may not exist on it.
export function agentDefaultSelection(target: Target, agent: Agent) {
  const same = agent.model?.providerID === target.providerID && agent.model.modelID === target.modelID

  return `${target.providerID}/${target.modelID}${same && agent.variant ? `#${agent.variant}` : ""}`
}
