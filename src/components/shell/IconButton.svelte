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
    showLabel,
    variant,
  }: {
    icon: IconName
    label: string
    onclick: (event: MouseEvent) => void
    element?: HTMLButtonElement | undefined
    pressed?: boolean
    haspopup?: 'menu' | 'dialog'
    expanded?: boolean
    onkeydown?: (event: KeyboardEvent) => void
    /** Visible text beside the icon: at every width, or only from 768px up. */
    showLabel?: 'always' | 'wide' | undefined
    variant?: 'primary' | undefined
  } = $props()

  const uid = $props.id()
</script>

<span class="icon-action">
  <button
    type="button"
    class="icon-btn"
    class:labelled={showLabel === 'always'}
    class:labelled-wide={showLabel === 'wide'}
    class:primary={variant === 'primary'}
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
    {#if showLabel}<span class="icon-btn-text">{label}</span>{/if}
  </button>
  <span id="{uid}-tip" role="tooltip" class="icon-tip">{label}</span>
</span>
