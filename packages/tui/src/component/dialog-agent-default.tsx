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

  const configured = createMemo(() => {
    const agents = (data.location.config.list(location.ref) ?? []).findLast(
      (entry) => entry.type === "document" && entry.info.agents !== undefined,
    )
    return agents?.type === "document" ? agents.info.agents : undefined
  })

  const options = createMemo(() =>
    (data.location.agent.list(location.ref) ?? [])
      .filter((agent) => !agent.hidden)
      .map((agent) => {
        const explicit = configured()?.[agent.id]?.model
        const model =
          typeof explicit === "string"
            ? explicit
            : explicit
              ? `${explicit.providerID}/${explicit.model}`
              : agent.model && `${agent.model.providerID}/${agent.model.id}`
        return {
          value: agent.id,
          title: agent.id,
          description: agent.description,
          category: agent.mode === "subagent" ? "Subagents" : "Primary agents",
          footer: model,
        }
      }),
  )

  return (
    <DialogSelect
      title={`Set default for agent: ${props.model.modelID}`}
      searchInTitle
      titlePlaceholder="Search agents"
      options={options()}
      onSelect={(option) => {
        dialog.clear()
        client.api.experimental.config
          .update({
            agents: { [option.value]: { model: `${props.model.providerID}/${props.model.modelID}` } },
          })
          .then(() =>
            toast.show({
              variant: "success",
              message: `${option.value} now defaults to ${props.model.providerID}/${props.model.modelID}`,
            }),
          )
          .catch(toast.error)
      }}
    />
  )
}
