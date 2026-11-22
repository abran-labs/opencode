import { useClient } from "../context/client"
import { useLocal } from "../context/local"
import { useToast } from "../ui/toast"

/** Returns a function that saves `model` as the configured default of the current agent, without touching the session. */
export function useSetAgentDefault() {
  const client = useClient()
  const local = useLocal()
  const toast = useToast()

  return (model: { providerID: string; modelID: string }) => {
    const agent = local.agent.current()
    if (!agent) return toast.show({ variant: "warning", message: "No agent selected" })
    // Only the same model keeps its variant; another model's variant may not exist.
    const variant =
      agent.model?.providerID === model.providerID && agent.model.id === model.modelID ? agent.model.variant : undefined
    const selection = `${model.providerID}/${model.modelID}${variant ? `#${variant}` : ""}`
    client.api.experimental.config
      .update({ agents: { [agent.id]: { model: selection } } })
      .then(() => toast.show({ variant: "success", message: `${agent.id} now defaults to ${selection}` }))
      .catch(toast.error)
  }
}
