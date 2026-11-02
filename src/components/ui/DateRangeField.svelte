<script lang="ts">
  import { getPaneScope } from '$lib/ui/scope'
  import type { DateRange } from '$lib/model/types'

  let {
    value = $bindable<DateRange>({ start: '', end: null }),
    presentLabel,
  }: { value?: DateRange; presentLabel: string } = $props()

  const uid = $props.id()
  const showScope = $derived(getPaneScope() === 'localized')

  // Clearing `end` keeps the pair consistent.
  const toggleCurrent = (event: Event) => {
    const current = (event.currentTarget as HTMLInputElement).checked
    value = current
      ? { start: value.start, end: null, current: true }
      : { start: value.start, end: '' }
  }
</script>

<div class="field">
  <span class="field-label">
    Dates
    {#if showScope}<span class="field-scope shared">both languages</span>{/if}
  </span>
  <div class="date-row">
    <input
      id="{uid}-start"
      class="field-input"
      placeholder="2024-03"
      aria-label="From"
      bind:value={value.start}
    />
    <span class="date-sep">–</span>
    <input
      id="{uid}-end"
      class="field-input"
      placeholder="2025-06"
      aria-label="To"
      disabled={value.current === true}
      value={value.end ?? ''}
      oninput={(event) => (value.end = (event.currentTarget as HTMLInputElement).value)}
    />
    <label class="field-check">
      <input type="checkbox" checked={value.current === true} onchange={toggleCurrent} />
      {presentLabel}
    </label>
  </div>
</div>
