<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte'

  let {
    icon,
    label,
    onclick,
    element = $bindable<HTMLButtonElement | undefined>(),
    pressed,
    haspopup,
    controls,
    expanded,
    onkeydown,
    variant,
    disabled = false,
  }: {
    icon: IconName
    label: string
    onclick: (event: MouseEvent) => void
    element?: HTMLButtonElement | undefined
    pressed?: boolean
    haspopup?: 'menu' | 'dialog'
    /** Id of the menu or panel this button opens; set only while it is rendered. */
    controls?: string | undefined
    /** Set for any disclosure (menu, dialog or panel); omit for plain actions. */
    expanded?: boolean
    onkeydown?: (event: KeyboardEvent) => void
    variant?: 'primary' | undefined
    /** Stays focusable and announced as unavailable; clicks do nothing. */
    disabled?: boolean
  } = $props()

  const uid = $props.id()
</script>

<span class="icon-action">
  <button
    type="button"
    class="icon-btn"
    class:primary={variant === 'primary'}
    aria-label={label}
    aria-describedby="{uid}-tip"
    aria-pressed={pressed}
    aria-haspopup={haspopup}
    aria-controls={controls}
    aria-expanded={expanded}
    aria-disabled={disabled || undefined}
    bind:this={element}
    onclick={(event) => { if (!disabled) onclick(event) }}
    {onkeydown}
  >
    <Icon name={icon} />
  </button>
  <span id="{uid}-tip" role="tooltip" class="icon-tip">{label}</span>
</span>
