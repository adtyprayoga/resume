<script lang="ts">
  import { tick, untrack } from 'svelte'
  import Icon from '$components/shell/Icon.svelte'
  import { editKeyAction, sameDraft } from '$lib/editing/fields'
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'

  const { value, label, scope = 'localized', onchange }: {
    value: string[]
    label: string
    scope?: 'localized' | 'shared'
    onchange: (value: string[]) => void
  } = $props()

  type Row = { id: number; value: string; original: string; persisted: boolean }
  const uid = $props.id()
  let nextId = 0
  const makeRow = (value: string, persisted = true): Row => ({ id: nextId++, value, original: value, persisted })
  let rows = $state<Row[]>(untrack(() => value.map((value) => makeRow(value))))
  let lastValue = untrack(() => [...value])
  let container = $state<HTMLFieldSetElement>()
  let addButton = $state<HTMLButtonElement>()

  $effect(() => {
    const incoming = [...value]
    untrack(() => {
      if (sameDraft(incoming, lastValue)) return
      rows = incoming.map((value) => makeRow(value))
      lastValue = incoming
    })
  })

  const emit = () => {
    lastValue = rows.filter((row) => row.persisted && row.value.trim()).map((row) => row.value)
    onchange([...lastValue])
  }

  const focus = async (id?: number) => {
    await tick()
    if (id === undefined) addButton?.focus()
    else container?.querySelector<HTMLTextAreaElement>(`[data-bullet-row="${id}"]`)?.focus()
  }

  const remove = (row: Row, restoreFocus = true) => {
    const index = rows.findIndex((candidate) => candidate.id === row.id)
    if (index < 0) return
    rows.splice(index, 1)
    if (row.persisted) emit()
    if (restoreFocus) void focus((rows[index] ?? rows[index - 1])?.id)
  }

  const finish = (row: Row) => {
    if (row.persisted && row.value === row.original) return
    const text = row.value.trim()
    if (!text) { remove(row, false); return }
    row.value = text
    row.original = text
    row.persisted = true
    emit()
  }

  const onkeydown = (event: KeyboardEvent, row: Row) => {
    const action = editKeyAction(event, false)
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    if (action === 'cancel') {
      if (!row.persisted) remove(row)
      else { row.value = row.original; emit() }
    } else {
      const index = rows.indexOf(row)
      finish(row)
      if (!rows.includes(row)) void focus((rows[index] ?? rows[index - 1])?.id)
    }
  }

  const add = () => {
    const row = makeRow('', false)
    rows.push(row)
    void focus(row.id)
  }
</script>

<fieldset class="field bullet-field" bind:this={container}>
  <legend class="field-label">{label}<span class="field-scope {scope}">{t(prefs.uiLocale, scope === 'shared' ? 'scope.shared' : 'scope.localized')}</span></legend>
  {#if rows.length}
    <ul class="bullet-rows">
      {#each rows as row, index (row.id)}
        <li>
          <div class="bullet-row">
            <label class="sr-only" for="{uid}-{row.id}">{t(prefs.uiLocale, 'bullet.row', { field: label, position: index + 1 })}</label>
            <textarea id="{uid}-{row.id}" class="field-textarea" data-bullet-row={row.id} rows="2" value={row.value}
              onfocus={() => { row.original = row.value }}
              oninput={(event) => { row.value = event.currentTarget.value; if (row.persisted) emit() }}
              onblur={() => finish(row)}
              onkeydown={(event) => onkeydown(event, row)}></textarea>
            <button type="button" class="tool-btn" aria-label={t(prefs.uiLocale, 'bullet.removeRow', { position: index + 1 })} onclick={() => remove(row)}><Icon name="trash" /></button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  <button type="button" class="tool-btn" bind:this={addButton} onclick={add}><Icon name="plus" />{t(prefs.uiLocale, 'bullet.add')}</button>
</fieldset>
