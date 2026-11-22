import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { Badge } from "@opencode/ui/badge"
import { Tooltip } from "@opencode/ui/tooltip"
import { useLocal, type ModelSelection } from "@/providers/models/selection"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { normalizeAgentList } from "@/runtime/server/global-sync/utils"
import { showToast } from "@/shell/notifications/toast"
import { useWorkspaceLocation } from "@/workspaces/location"
import { agentDefaultSelection } from "./agent-default-selection"
import "./select-dialog.css"

type Item = { id: string; name: string; provider: { id: string } }

export type AgentDefault = ReturnType<typeof useAgentDefault>

const modelKey = (model: { providerID: string; modelID: string }) => `${model.providerID}:${model.modelID}`

// A save shows at once, before the agents reload. It holds only while the agent still names the model it had when the
// save began; once the reloaded agent differs, the server's answer wins.
const [saved, setSaved] = createSignal<Record<string, { base: string | undefined; key: string }>>({})

/**
 * The current agent's configured default model, and the action that replaces it. Saving never touches the model the
 * composer or session uses, so the chat keeps the model it had.
 */
export function useAgentDefault(input?: ModelSelection) {
  const language = useLanguage()
  const server = useServerSDK()
  const data = useData()
  const location = useWorkspaceLocation()

  // Like the pickers, the composer's own selection when it passes one, else the provider's.
  const selection = input ?? useLocal().model
  const agent = () => selection.agent?.()
  const slot = (name: string) => `${location().directory}\n${name}`

  const configured = () => {
    const model = agent()?.model

    return model ? modelKey(model) : undefined
  }

  const current = () => {
    const item = agent()

    if (!item) return
    const override = saved()[slot(item.name)]

    return override && override.base === configured() ? override.key : configured()
  }

  const is = (item: Item) => current() === `${item.provider.id}:${item.id}`

  createEffect(() => {
    const directory = location().directory
    if (directory) void data.location.agent.sync({ directory }).catch(() => undefined)
  })

  const owners = createMemo(() => {
    const byModel = new Map<string, string[]>()
    const active = agent()
    const agents = normalizeAgentList(data.location.agent.list({ directory: location().directory }) ?? [])
    const visible = agents.filter((entry) => !entry.hidden && entry.name !== active?.name)
    for (const entry of active ? [active, ...visible] : visible) {
      const base = entry.model && modelKey(entry.model)
      const override = saved()[slot(entry.name)]
      const key = override && override.base === base ? override.key : base
      if (key) byModel.set(key, [...(byModel.get(key) ?? []), entry.name])
    }
    return byModel
  })

  const save = async (item: Item) => {
    const target = agent()

    if (!target || is(item)) return
    const directory = location().directory
    const base = configured()

    const result = await server.api.experimental.config
      .update({
        agents: {
          [target.name]: {
            model: agentDefaultSelection({ providerID: item.provider.id, modelID: item.id }, target),
          },
        },
      })
      .then(
        () => true,
        () => false,
      )

    if (!result) return showToast({ variant: "error", title: language.t("common.requestFailed") })

    setSaved((all) => ({ ...all, [slot(target.name)]: { base, key: `${item.provider.id}:${item.id}` } }))
    void data.location.agent.sync({ directory }).catch(() => undefined)
    showToast({
      variant: "success",
      title: language.t("dialog.model.agentDefault.saved", { agent: target.name, model: item.name }),
    })
  }

  return {
    /** The agent's name, capitalized for headings; nothing when the chat has no agent. */
    label: () => {
      const name = agent()?.name

      return name ? name.charAt(0).toUpperCase() + name.slice(1) : undefined
    },
    available: () => !!agent(),
    current,
    owners: (item: Item, othersOnly?: boolean) =>
      (owners().get(`${item.provider.id}:${item.id}`) ?? [])
        .filter((name) => !othersOnly || name !== agent()?.name)
        .map((name) => name.charAt(0).toUpperCase() + name.slice(1))
        .join(", "),
    is,
    save,
  }
}

export function ModelDefaultBadge(props: { item: Item; agentDefault: AgentDefault; othersOnly?: boolean }) {
  const language = useLanguage()
  return (
    <Show when={props.agentDefault.owners(props.item, props.othersOnly)}>
      {(names) => (
        <Badge class="min-w-0 truncate" data-slot="model-default-badge" title={names()}>
          {language.t("dialog.model.agentDefault.badge", { agent: names() })}
        </Badge>
      )}
    </Show>
  )
}

// A pushpin. Outlined when the model is not the default; filled when it is.
function PinIcon(props: { filled: boolean }) {
  return (
    <svg
      data-slot="icon-svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={props.filled ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5a3 3 0 0 1-3 3v2h5.97v7l1.03 1 1.03-1v-7H19v-2a3 3 0 0 1-3-3Z" />
    </svg>
  )
}

/** The row control that makes its model the current agent's default. Not a nested button, and it never selects the row. */
export function DefaultModelPin(props: { item: Item; agentDefault: AgentDefault; mobile?: boolean }) {
  const language = useLanguage()
  const label = () => language.t("dialog.model.agentDefault.action")

  return (
    <Show when={props.agentDefault.available()}>
      <Tooltip placement="top" gutter={4} inactive={props.mobile} value={label()} ignoreSafeArea={false}>
        <span
          role="button"
          tabIndex={-1}
          data-slot="model-default-pin"
          data-active={props.agentDefault.is(props.item) ? "" : undefined}
          aria-label={label()}
          aria-pressed={props.agentDefault.is(props.item)}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void props.agentDefault.save(props.item)
          }}
        >
          <PinIcon filled={props.agentDefault.is(props.item)} />
        </span>
      </Tooltip>
    </Show>
  )
}

// A star, drawn like the pin so the two controls read as different things.
function StarIcon(props: { filled: boolean }) {
  return (
    <svg
      data-slot="icon-svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={props.filled ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3Z" />
    </svg>
  )
}

/** A favorite toggle for rows that have no other way to favorite a model. */
export function FavoriteStar(props: { active: boolean; label: string; mobile?: boolean; onToggle: () => void }) {
  return (
    <Tooltip placement="top" gutter={4} inactive={props.mobile} value={props.label} ignoreSafeArea={false}>
      <span
        role="button"
        tabIndex={-1}
        data-slot="model-favorite-star"
        data-active={props.active ? "" : undefined}
        aria-label={props.label}
        aria-pressed={props.active}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          props.onToggle()
        }}
      >
        <StarIcon filled={props.active} />
      </span>
    </Tooltip>
  )
}
