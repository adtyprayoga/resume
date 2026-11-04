<script lang="ts">
  import { t, translatedMessage, type UiMessage, type UiStringKey } from '$lib/i18n/ui'
  import { addEntry, changeLocale, createReview, finalizeReview, removeEntry, sourceLines } from '$lib/io/pdf/draft'
  import type { Proposal } from '$lib/io/pdf/mapper'
  import type { Extraction } from '$lib/io/pdf/types'
  import { normalizeUrl } from '$lib/model/sanitize'
  import { LOCALES, type Locale, type ResumeDocument } from '$lib/model/types'
  import { prefs } from '$lib/state/preferences.svelte'
  import TextArea from '../ui/TextArea.svelte'
  import TextField from '../ui/TextField.svelte'
  import PdfReviewEntry from './PdfReviewEntry.svelte'
  import PdfSourceText from './PdfSourceText.svelte'

  type Problem = { message: string } & Partial<UiMessage>

  /**
   * Edits a private copy of the proposal. `onConfirm` receives the validated
   * document and returns a problem to show, or null once it has been applied.
   */
  const {
    proposal,
    extraction,
    onCancel,
    onBack,
    onConfirm,
  }: {
    proposal: Proposal
    extraction: Extraction
    onCancel: () => void
    onBack: () => void
    onConfirm: (doc: ResumeDocument) => Problem | null
  } = $props()

  const uid = $props.id()
  // The proposal never changes while this review is mounted; the copy is the point.
  // svelte-ignore state_referenced_locally
  const draft = $state(createReview(proposal))
  let problem = $state<Problem | null>(null)

  const ui = $derived(prefs.uiLocale)
  const kinds = $derived(draft.document.sections.map((section) => section.kind))
  const warnings = $derived([...new Set(proposal.warnings.map((warning) => warning.code))])
  const profile = $derived(draft.document.profile.text[draft.locale])

  const replace = () => {
    const result = finalizeReview(draft, proposal.unmatched.length)
    if (!result.ok) {
      const { ok: _ok, error, ...metadata } = result
      problem = { message: error, ...metadata }
      return
    }
    problem = onConfirm(result.value)
  }
</script>

<div class="pdf-review">
  <p class="pdf-intro">{t(ui, 'pdf.review.intro')}</p>
  {#if warnings.length}
    <ul class="pdf-warnings">
      {#each warnings as code (code)}<li>{t(ui, `pdf.warning.${code}` as UiStringKey)}</li>{/each}
    </ul>
  {/if}

  <div class="field">
    <label class="field-label" for="{uid}-locale">{t(ui, 'pdf.review.language')}</label>
    <select id="{uid}-locale" class="field-input" value={draft.locale} onchange={(event) => changeLocale(draft, (event.currentTarget as HTMLSelectElement).value as Locale)}>
      {#each LOCALES as locale (locale)}<option value={locale}>{t(ui, `language.${locale}` as UiStringKey)}</option>{/each}
    </select>
  </div>

  {#key draft.locale}
    <fieldset class="pdf-group">
      <legend class="editor-subhead">{t(ui, 'pdf.review.profile')}</legend>
      <TextField label={t(ui, 'field.name')} bind:value={profile.name} />
      <TextField label={t(ui, 'field.headline')} bind:value={profile.headline} />
      <TextField label={t(ui, 'field.location')} bind:value={profile.location} />
      <TextArea label={t(ui, 'field.summary')} rows={4} bind:value={profile.summary} />
    </fieldset>

    <fieldset class="pdf-group">
      <legend class="editor-subhead">{t(ui, 'pdf.review.contact')}</legend>
      <TextField label={t(ui, 'field.email')} type="email" scope="shared" bind:value={draft.document.contact.email} />
      <TextField label={t(ui, 'field.phone')} type="tel" scope="shared" bind:value={draft.document.contact.phone} />
      <TextField label={t(ui, 'field.website')} type="url" scope="shared" normalize={normalizeUrl} bind:value={draft.document.contact.website} />
      <TextField label={t(ui, 'field.github')} type="url" scope="shared" normalize={normalizeUrl} bind:value={draft.document.contact.github} />
      <TextField label={t(ui, 'field.linkedin')} type="url" scope="shared" normalize={normalizeUrl} bind:value={draft.document.contact.linkedin} />
    </fieldset>

    {#each kinds as kind (kind)}
      {@const section = t(ui, `section.${kind}` as UiStringKey)}
      <section class="pdf-group" aria-labelledby="{uid}-{kind}">
        <h3 id="{uid}-{kind}" class="editor-subhead">{section}</h3>
        {#each draft.document.content[kind] as item, index (item.id)}
          <PdfReviewEntry
            {item}
            {kind}
            locale={draft.locale}
            position={index + 1}
            source={sourceLines(proposal, extraction, `${kind}.${item.id}.`)}
            onRemove={() => removeEntry(draft, kind, item.id)}
          />
        {:else}
          <p class="field-hint">{t(ui, 'pdf.review.none')}</p>
        {/each}
        <button type="button" class="tool-btn" onclick={() => addEntry(draft, kind)}>{t(ui, 'pdf.review.add', { section })}</button>
      </section>
    {/each}
  {/key}

  <PdfSourceText {extraction} unmatched={proposal.unmatched} />

  {#if proposal.unmatched.length}
    <label class="field-check pdf-acknowledge">
      <input type="checkbox" bind:checked={draft.acknowledged} />
      {t(ui, 'pdf.review.acknowledge')}
    </label>
  {/if}

  <p class="import-warning">{t(ui, 'import.warning')}</p>
  {#if problem}
    <p role="alert" class="save-status error">{translatedMessage(ui, problem, problem.message)}</p>
  {/if}
  <div class="import-actions">
    <button type="button" class="tool-btn" onclick={onCancel}>{t(ui, 'import.cancel')}</button>
    <button type="button" class="tool-btn" onclick={onBack}>{t(ui, 'import.back')}</button>
    <button type="button" class="tool-btn primary" onclick={replace}>{t(ui, 'import.replace')}</button>
  </div>
</div>
