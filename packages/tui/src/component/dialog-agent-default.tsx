import { createMemo } from "solid-js"
import { useClient } from "../context/client"
import { useData } from "../context/data"
import { useLocation } from "../context/location"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useToast } from "../ui/toast"

/** Picks which agent (primary or subagent) gets `model` as its configured default model. */
export function DialogAgentDefault(props: { model: { providerID: string; modelID: string } }) {
  const client = useClient()
  const data = useData()
  const location = useLocation()
  const dialog = useDialog()
  const toast = useToast()

  const agents = createMemo(() => (data.location.agent.list(location.ref) ?? []).filter((agent) => !agent.hidden))

  const options = createMemo(() =>
    agents().map((agent) => ({
      value: agent.id,
      title: agent.id,
      description: agent.description,
      category: agent.mode === "subagent" ? "Subagents" : "Primary agents",
      footer: agent.model && `${agent.model.providerID}/${agent.model.id}${agent.model.variant ? `#${agent.model.variant}` : ""}`,
    })),
  )

  return (
    <DialogSelect
      title={`Set default for agent: ${props.model.modelID}`}
      searchInTitle
      titlePlaceholder="Search agents"
      options={options()}
      onSelect={(option) => {
        dialog.clear()
        // Only the same model keeps its variant; another model's variant may not exist.
        const current = agents().find((agent) => agent.id === option.value)?.model
        const variant =
          current?.providerID === props.model.providerID && current.id === props.model.modelID
            ? current.variant
            : undefined
        const selection = `${props.model.providerID}/${props.model.modelID}${variant ? `#${variant}` : ""}`
        client.api.experimental.config
          .update({
            agents: { [option.value]: { model: selection } },
          })
          .then(() =>
            toast.show({
              variant: "success",
              message: `${option.value} now defaults to ${selection}`,
            }),
          )
          .catch(toast.error)
      }}
    />
  )
}
