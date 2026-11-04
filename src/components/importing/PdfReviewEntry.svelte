<script lang="ts">
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import { normalizeUrl } from '$lib/model/sanitize'
  import type { AwardItem, CertificationItem, ReferenceItem, EducationItem, ExperienceItem, Locale, ProjectItem, SkillGroup } from '$lib/model/types'
  import type { ListSectionKind } from '$lib/sections/kinds'
  import { prefs } from '$lib/state/preferences.svelte'
  import DateRangeField from '../ui/DateRangeField.svelte'
  import LinesField from '../ui/LinesField.svelte'
  import TagsField from '../ui/TagsField.svelte'
  import TextArea from '../ui/TextArea.svelte'
  import TextField from '../ui/TextField.svelte'

  type SectionItem = ExperienceItem | EducationItem | ProjectItem | SkillGroup | AwardItem | CertificationItem | ReferenceItem
  /** One component edits every section's shape; `kind` decides which fields exist. */
  type Loose = { text: Record<Locale, Record<string, any>> } & Record<string, any>

  const {
    item,
    kind,
    locale,
    position,
    source,
    onRemove,
  }: {
    /** A deep `$state` proxy owned by the review draft; fields are edited in place. */
    item: SectionItem
    kind: ListSectionKind
    locale: Locale
    position: number
    source: string[]
    onRemove: () => void
  } = $props()

  const ui = $derived(prefs.uiLocale)
  const label = (key: string) => t(ui, `field.${key}` as UiStringKey)
  const section = $derived(t(ui, `section.${kind}` as UiStringKey))
  const entry = $derived(item as unknown as Loose)
  const text = $derived(entry.text[locale]!)
</script>

<fieldset class="pdf-entry">
  <legend class="pdf-entry-title">{t(ui, 'pdf.review.entry', { section, position })}</legend>

  {#if kind === 'experience'}
    <TextField label={label('company')} scope="shared" bind:value={entry.company} />
    <TextField label={label('role')} bind:value={text.role} />
    <TextField label={label('team')} bind:value={text.team} />
    <TextField label={label('location')} bind:value={text.location} />
    <DateRangeField bind:value={entry.dates} presentLabel={t(ui, 'date.present')} />
    <LinesField label={label('highlights')} bind:value={text.bullets} />
  {:else if kind === 'education'}
    <TextField label={label('school')} bind:value={text.school} />
    <TextField label={label('degree')} bind:value={text.degree} />
    <TextField label={label('field')} bind:value={text.field} />
    <TextField label={label('gpa')} scope="shared" bind:value={entry.gpa} />
    <DateRangeField bind:value={entry.dates} presentLabel={t(ui, 'date.present')} />
    <TextArea label={label('description')} bind:value={text.description} />
  {:else if kind === 'projects'}
    <TextField label={label('name')} bind:value={text.name} />
    <TextField label={label('role')} bind:value={text.role} />
    <TextField label={label('link')} scope="shared" type="url" normalize={normalizeUrl} bind:value={entry.link} />
    <TagsField label={label('techStack')} scope="shared" bind:value={entry.techStack} />
    <DateRangeField bind:value={entry.dates} presentLabel={t(ui, 'date.present')} />
    <TextArea label={label('description')} bind:value={text.description} />
    <LinesField label={label('highlights')} bind:value={text.bullets} />
  {:else if kind === 'references'}
    <TextField label={label('name')} bind:value={text.name} />
    <TextField label={label('position')} bind:value={text.position} />
    <TextField label={label('phone')} scope="shared" bind:value={entry.phone} />
    <TextField label={label('email')} scope="shared" bind:value={entry.email} />
    <TextArea label={label('notes')} bind:value={text.note} />
  {:else if kind === 'skills'}
    <TextField label={label('group')} bind:value={text.title} />
    <TagsField label={label('skills')} bind:value={text.items} />
  {:else}
    <TextField label={label('title')} bind:value={text.title} />
    <TextField label={label('issuer')} bind:value={text.issuer} />
    <TextField label={label('date')} scope="shared" bind:value={entry.date} />
    <TextArea label={label('description')} bind:value={text.description} />
  {/if}

  {#if source.length}
    <details class="pdf-entry-source">
      <summary>{t(ui, 'pdf.review.source')}</summary>
      <ul>
        {#each source as line, index (index)}<li>{line}</li>{/each}
      </ul>
    </details>
  {/if}

  <button type="button" class="tool-btn" onclick={onRemove}>{t(ui, 'pdf.review.remove', { section, position })}</button>
</fieldset>
