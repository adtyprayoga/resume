<script lang="ts">
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import IconButton from './IconButton.svelte'
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'

  let {
    onImport,
    onJson,
    onSettings,
    button = $bindable<HTMLButtonElement | undefined>(),
  }: { onImport: () => void; onJson: () => void; onSettings: () => void; button?: HTMLButtonElement | undefined } = $props()

  const uid = $props.id()
  let open = $state(false)
  let menu = $state<HTMLDivElement>()

  const items = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

  const show = async (focus: 'first' | 'last' = 'first') => {
    open = true
    await tick()
    const list = items()
    ;(focus === 'first' ? list[0] : list.at(-1))?.focus()
  }

  const close = (restore = true) => {
    open = false
    if (restore) button?.focus()
  }

  const choose = (action: () => void) => {
    close()
    action()
  }

  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      void show(event.key === 'ArrowDown' ? 'first' : 'last')
    }
  }

  const onMenuKey = (event: KeyboardEvent) => {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => {
      event.preventDefault()
      list[(to + list.length) % list.length]?.focus()
    }
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(list.length - 1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') close(false)
  }

  const onWindowPointer = (event: PointerEvent) => {
    if (!open) return
    const target = event.target as Node
    if (!menu?.contains(target) && !button?.contains(target)) close(false)
  }
</script>

<svelte:window onpointerdown={onWindowPointer} />

<span class="menu-anchor">
  <IconButton
    icon="more"
    label={t(prefs.uiLocale, 'action.more')}
    haspopup="menu"
    expanded={open}
    bind:element={button}
    onclick={() => (open ? close() : void show())}
    onkeydown={onButtonKey}
  />
  {#if open}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      id="{uid}-menu"
      class="menu"
      role="menu"
      aria-label={t(prefs.uiLocale, 'action.more')}
      bind:this={menu}
      onkeydown={onMenuKey}
    >
      <button type="button" role="menuitem" tabindex="-1" class="menu-item" onclick={() => choose(onImport)}>
        <Icon name="import" />{t(prefs.uiLocale, 'action.importJson')}
      </button>
      <button type="button" role="menuitem" tabindex="-1" class="menu-item" onclick={() => choose(onJson)}>
        <Icon name="json" />{t(prefs.uiLocale, 'action.exportJson')}
      </button>
      <button type="button" role="menuitem" tabindex="-1" class="menu-item" onclick={() => choose(onSettings)}>
        <Icon name="settings" />{t(prefs.uiLocale, 'action.settings')}
      </button>
    </div>
  {/if}
</span>
