import { createMemo, createSignal, For, onMount, Show } from "solid-js"
import { Button } from "@opencode/ui/button"
import { Dialog, DialogBody, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { Icon } from "@opencode/ui/icon"
import { useDialog } from "@opencode/ui/context/dialog"
import { useModels } from "@/providers/models/models"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { normalizeAgentList } from "@/runtime/server/global-sync/utils"
import { showToast } from "@/shell/notifications/toast"
import { agentDefaultSelection } from "./agent-default-selection"
import { SettingsList } from "@/settings/list"
import { useWorkspaceLocation } from "@/workspaces/location"
import "@/settings/settings.css"

type Target = { providerID: string; modelID: string; name: string }

// Saves `target` as an agent's configured model. Never touches the composer or session selection, so cancelling or
// saving leaves the current session on the model it had.
export function DialogAgentDefault(props: { model: Target }) {
  const dialog = useDialog()
  const language = useLanguage()
  const server = useServerSDK()
  const data = useData()
  const models = useModels()
  const location = useWorkspaceLocation()
  const [saving, setSaving] = createSignal<string>()

  // The picker lists subagents too, so it loads the agents itself instead of relying on the composer having synced.
  onMount(() => void data.location.agent.sync({ directory: location().directory }).catch(() => undefined))

  const agents = createMemo(() =>
    normalizeAgentList(data.location.agent.list({ directory: location().directory }) ?? []).filter(
      (agent) => !agent.hidden,
    ),
  )

  const groups = createMemo(() => [
    {
      title: language.t("dialog.model.agentDefault.primary"),
      items: agents().filter((agent) => agent.mode !== "subagent"),
    },
    {
      title: language.t("dialog.model.agentDefault.subagents"),
      items: agents().filter((agent) => agent.mode === "subagent"),
    },
  ])

  const current = (agent: ReturnType<typeof agents>[number]) => {
    if (!agent.model) return language.t("dialog.model.agentDefault.current", { model: language.t("common.default") })
    const model = models.find(agent.model)?.name ?? `${agent.model.providerID}/${agent.model.modelID}`

    return agent.variant
      ? language.t("dialog.model.agentDefault.currentVariant", { model, variant: agent.variant })
      : language.t("dialog.model.agentDefault.current", { model })
  }

  const save = async (agent: ReturnType<typeof agents>[number]) => {
    if (saving()) return
    const name = agent.name
    setSaving(name)
    const result = await server.api.experimental.config
      .update({
        agents: {
          [name]: {
            model: agentDefaultSelection({ providerID: props.model.providerID, modelID: props.model.modelID }, agent),
          },
        },
      })
      .then(
        () => true,
        () => false,
      )

    if (!result) {
      setSaving(undefined)
      showToast({ variant: "error", title: language.t("common.requestFailed") })
      return
    }

    void data.location.agent.sync({ directory: location().directory }).catch(() => undefined)
    showToast({
      variant: "success",
      title: language.t("dialog.model.agentDefault.saved", { agent: name, model: props.model.name }),
    })
    dialog.close()
  }

  return (
    <Dialog size="large" variant="settings">
      <DialogHeader hideClose={true} closeLabel={language.t("common.close")}>
        <DialogTitleGroup
          title={language.t("dialog.model.agentDefault.title", { model: props.model.name })}
          description={language.t("dialog.model.agentDefault.description")}
        />
      </DialogHeader>
      <DialogBody class="flex min-h-0 flex-1 flex-col">
        <div class="settings-panel settings-models min-h-0 flex-1 overflow-y-auto pb-4" data-scrollable>
          <For each={groups()}>
            {(group) => (
              <Show when={group.items.length > 0}>
                <div class="px-1 pt-3 pb-1 text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-muted">
                  {group.title}
                </div>
                <SettingsList>
                  <For each={group.items}>
                    {(agent) => (
                      <button
                        type="button"
                        data-component="settings-row"
                        disabled={saving() !== undefined}
                        class="-mx-4 w-[calc(100%+32px)] px-4 text-start hover:bg-v2-overlay-simple-overlay-hover focus-visible:-outline-offset-2"
                        onClick={() => void save(agent)}
                      >
                        <div data-slot="settings-row-copy">
                          <div data-slot="settings-row-title" class="min-w-0 truncate capitalize">
                            {agent.name}
                          </div>
                          <div data-slot="settings-row-description" class="min-w-0 truncate">
                            {current(agent)}
                          </div>
                        </div>
                        <div data-slot="settings-row-control" class="size-4">
                          <Show
                            when={
                              agent.model?.providerID === props.model.providerID &&
                              agent.model.modelID === props.model.modelID
                            }
                          >
                            <Icon name="check" class="shrink-0 text-v2-icon-icon-base" />
                          </Show>
                        </div>
                      </button>
                    )}
                  </For>
                </SettingsList>
              </Show>
            )}
          </For>
        </div>
        <div class="flex justify-end pt-2">
          <Button variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}
