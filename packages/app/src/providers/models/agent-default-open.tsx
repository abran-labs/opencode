import { useDialog } from "@opencode/ui/context/dialog"

type Item = { id: string; name: string; provider: { id: string } }

// Opens the agent picker for a model. Dialog-only: it never changes the model the composer or session uses.
export function useAgentDefault() {
  const dialog = useDialog()

  return async (item: Item) => {
    const { DialogAgentDefault } = await import("./agent-default")
    void dialog.show(() => (
      <DialogAgentDefault model={{ providerID: item.provider.id, modelID: item.id, name: item.name }} />
    ))
  }
}
