<script lang="ts">
  import { tick, untrack } from 'svelte'
  import Icon from '$components/shell/Icon.svelte'
  import { bulletKeyAction, sameDraft } from '$lib/editing/fields'
  import { insertLineBreak } from '$lib/ui/textarea'
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
  const initialRows = (values: string[]) => values.length ? values.map((value) => makeRow(value)) : [makeRow('', false)]
  let rows = $state<Row[]>(untrack(() => initialRows(value)))
  let lastValue = untrack(() => [...value])
  let container = $state<HTMLFieldSetElement>()

  $effect(() => {
    const incoming = [...value]
    untrack(() => {
      if (sameDraft(incoming, lastValue)) return
      rows = initialRows(incoming)
      lastValue = incoming
    })
  })

  const emit = () => {
    lastValue = rows.filter((row) => row.persisted).map((row) => row.value)
    onchange([...lastValue])
  }

  const focus = async (id?: number) => {
    await tick()
    const target = id ?? rows[0]!.id
    container?.querySelector<HTMLTextAreaElement>(`[data-bullet-row="${target}"]`)?.focus()
  }

  const remove = (row: Row, restoreFocus = true) => {
    const index = rows.findIndex((candidate) => candidate.id === row.id)
    if (index < 0) return
    const persisted = row.persisted
    if (rows.length === 1) {
      row.value = ''
      row.original = ''
      row.persisted = false
    } else rows.splice(index, 1)
    if (persisted) emit()
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
    const action = bulletKeyAction(event)
    if (!action) return
    if (action === 'newline') { insertLineBreak(event); return }
    event.preventDefault()
    event.stopPropagation()
    if (action === 'cancel') {
      if (!row.persisted) remove(row)
      else { row.value = row.original; emit() }
    } else {
      const index = rows.indexOf(row)
      const nonempty = !!row.value.trim()
      finish(row)
      if (action === 'next' && nonempty) addAfter(row)
      if (!rows.includes(row)) void focus((rows[index] ?? rows[index - 1])?.id)
    }
  }

  const addAfter = (row: Row) => {
    if (row.value.trim()) finish(row)
    const next = makeRow('', false)
    rows.splice(rows.indexOf(row) + 1, 0, next)
    void focus(next.id)
  }
</script>

<fieldset class="field bullet-field" bind:this={container}>
  <legend class="field-label">{label}<span class="field-scope {scope}">{t(prefs.uiLocale, scope === 'shared' ? 'scope.shared' : 'scope.localized')}</span></legend>
  <ul class="bullet-rows">
    {#each rows as row, index (row.id)}
      <li>
        <div class="bullet-row">
          <label class="sr-only" for="{uid}-{row.id}">{t(prefs.uiLocale, 'bullet.row', { field: label, position: index + 1 })}</label>
          <textarea id="{uid}-{row.id}" class="field-textarea" data-bullet-row={row.id} rows="2" value={row.value}
            onfocus={() => { row.original = row.value }}
            oninput={(event) => { row.value = event.currentTarget.value; if (row.persisted) emit() }}
            onblur={(event) => {
              const next = event.relatedTarget
              if (next instanceof Element && container?.contains(next) && next.closest('.bullet-row-actions')) {
                if (row.value.trim()) finish(row)
                return
              }
              finish(row)
            }}
            onkeydown={(event) => onkeydown(event, row)}></textarea>
          <div class="bullet-row-actions">
            <button type="button" class="tool-btn" aria-label={t(prefs.uiLocale, 'bullet.removeRow', { position: index + 1 })} title={t(prefs.uiLocale, 'bullet.remove')} onclick={() => remove(row)}><Icon name="trash" /></button>
            <button type="button" class="tool-btn" aria-label={t(prefs.uiLocale, 'bullet.add')} title={t(prefs.uiLocale, 'bullet.add')} onclick={() => addAfter(row)}><Icon name="plus" /></button>
          </div>
        </div>
      </li>
    {/each}
  </ul>
</fieldset>
