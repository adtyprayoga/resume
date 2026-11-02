<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte'

  let {
    icon,
    label,
    onclick,
    element = $bindable<HTMLButtonElement | undefined>(),
    pressed,
    haspopup,
    expanded,
    onkeydown,
  }: {
    icon: IconName
    label: string
    onclick: (event: MouseEvent) => void
    element?: HTMLButtonElement | undefined
    pressed?: boolean
    haspopup?: 'menu' | 'dialog'
    expanded?: boolean
    onkeydown?: (event: KeyboardEvent) => void
  } = $props()

  const uid = $props.id()
</script>

<span class="icon-action">
  <button
    type="button"
    class="icon-btn"
    aria-label={label}
    aria-describedby="{uid}-tip"
    aria-pressed={pressed}
    aria-haspopup={haspopup}
    aria-expanded={haspopup ? expanded === true : undefined}
    bind:this={element}
    {onclick}
    {onkeydown}
  >
    <Icon name={icon} />
  </button>
  <span id="{uid}-tip" role="tooltip" class="icon-tip">{label}</span>
</span>
