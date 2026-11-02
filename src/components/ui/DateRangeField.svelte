<script lang="ts">
  import FieldLabel from './FieldLabel.svelte'
  import type { DateRange } from '$lib/model/types'

  let { value = $bindable<DateRange>({ start: '', end: null }), presentLabel }: {
    value?: DateRange
    presentLabel: string
  } = $props()

  const uid = $props.id()
  const startId = `${uid}-start`
  const endId = `${uid}-end`

  /** Clearing `end` when a role becomes current keeps the two consistent. */
  const toggleCurrent = (event: Event) => {
    const current = (event.currentTarget as HTMLInputElement).checked
    value = current ? { start: value.start, end: null, current: true } : { start: value.start, end: '' }
  }
</script>

<div class="field">
  <div class="field-row">
    <div>
      <FieldLabel label="From" scope="shared" forId={startId} />
      <input id={startId} class="field-input" placeholder="2024-03" bind:value={value.start} />
    </div>
    <div>
      <FieldLabel label="To" scope="shared" forId={endId} />
      <input
        id={endId}
        class="field-input"
        placeholder="2025-06"
        disabled={value.current === true}
        value={value.end ?? ''}
        oninput={(e) => (value.end = (e.currentTarget as HTMLInputElement).value)}
      />
    </div>
  </div>
  <label class="field-check">
    <input type="checkbox" checked={value.current === true} onchange={toggleCurrent} />
    {presentLabel}
  </label>
  <p class="field-hint">Use YYYY-MM, or any text you prefer.</p>
</div>
