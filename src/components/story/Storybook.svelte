<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { buildStory, type Blank } from '$lib/guidance/story'
  import { applyPage, type Answers } from '$lib/guidance/apply'
  import { NARRATION } from '$lib/guidance/templates'
  import { t } from '$lib/i18n/ui'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { storyHighlights } from '$lib/state/storyHighlights.svelte'
  import { focusTrap } from '$lib/ui/focusTrap'
  import { visible, wasWritten } from './answers'

  const { onClose }: { onClose: () => void } = $props()
  const locale = untrack(() => prefs.documentLocale)
  const pages = buildStory(resumeDoc.current, locale)
  let index = $state(0)
  let answers = $state<Record<string, Answers>>({})
  let completed = $state<Record<string, { filled: number; skipped: number }>>({})
  let heading = $state<HTMLHeadingElement>()
  const page = $derived(pages[index]!)
  const current = $derived(answers[page.id] ?? {})
  const readonly = $derived(!!completed[page.id])
  const hasAnswer = $derived([...page.blanks, ...page.choices].some(b => visible(page, b.id, current) && current[b.id]?.trim()))
  const totals = $derived(Object.values(completed).reduce((sum, p) => ({ filled: sum.filled + p.filled, skipped: sum.skipped + p.skipped }), { filled: 0, skipped: 0 }))
  const inline = $derived(new Set(page.paragraphs.flat().filter(s => s.kind === 'blank').map(s => s.id)))

  $effect(() => {
    void index
    void tick().then(() => heading?.focus())
  })

  function answer(id: string, value: string) {
    answers[page.id] = { ...current, [id]: value }
  }

  function next(skip = false) {
    if (!readonly) {
      const values = skip ? {} : current
      const written = applyPage(page, values, locale)
      storyHighlights.add(written)
      const eligible = page.blanks.filter(b => visible(page, b.id, values))
      const filled = eligible.filter(b => wasWritten(page, b, values, written)).length
      completed[page.id] = { filled, skipped: eligible.length - filled }
      answers[page.id] = { ...values }
    }
    index++
  }

  function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    // The heading is intentionally outside the ordinary tab sequence.
    if (event.key === 'Tab' && event.shiftKey && event.target === heading) {
      event.preventDefault()
      const buttons = heading.closest('[role="dialog"]')?.querySelectorAll<HTMLButtonElement>('button')
      buttons?.[buttons.length - 1]?.focus()
    }
  }
</script>

{#snippet input(blank: Blank)}
  <input
    class="story-blank"
    type={blank.input === 'month' ? 'month' : 'text'}
    aria-label={blank.input === 'tags' ? t(prefs.uiLocale, 'story.tags', { label: blank.label[prefs.uiLocale] }) : blank.label[prefs.uiLocale]}
    placeholder={blank.label[prefs.uiLocale]}
    value={current[blank.id] ?? ''}
    {readonly}
    oninput={(event) => answer(blank.id, event.currentTarget.value)}
  />
{/snippet}

<div class="storybook" role="dialog" aria-modal="true" aria-label={t(prefs.uiLocale, 'story.title')} use:focusTrap onkeydown={keyboard} tabindex="-1" data-print-hide>
  <div class="story-page">
    <header class="story-header">
      <span>{index + 1} / {pages.length}</span>
      {#if page.chapter !== 'ending'}<button type="button" class="tool-btn" onclick={onClose}>{t(prefs.uiLocale, 'story.close')}</button>{/if}
    </header>
    <h1 bind:this={heading} tabindex="-1">{page.chapter === 'ending' ? page.title[prefs.uiLocale] : t(prefs.uiLocale, 'story.chapter', { n: page.chapterNumber, title: page.title[prefs.uiLocale] })}</h1>
    <div class="story-prose" lang={locale}>
      {#each page.paragraphs as paragraph}
        {#if paragraph.every(s => s.kind !== 'blank' || visible(page, s.id, current))}
          <p>{#each paragraph as segment}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'resume'}<mark class="story-resume">{segment.text}</mark>{:else}{@render input(page.blanks.find(b => b.id === segment.id)!)}{/if}{/each}</p>
        {/if}
      {/each}
      {#if page.chapter === 'ending'}
        <p>{NARRATION.endingCounts[locale].replace('{filled}', String(totals.filled)).replace('{skipped}', String(totals.skipped))}</p>
      {/if}
    </div>
    {#if page.confirm}
      <fieldset class="story-choice" disabled={readonly}>
        <legend>{page.confirm.prompt[prefs.uiLocale]}</legend>
        {#each ['yes', 'no', ''] as value}
          <label><input type="radio" name={page.confirm.id} checked={(current[page.confirm.id] ?? '') === value} onchange={() => answer(page.confirm!.id, value)} />{t(prefs.uiLocale, value === 'yes' ? 'story.yes' : value === 'no' ? 'story.no' : 'story.skip')}</label>
        {/each}
      </fieldset>
    {/if}
    {#each page.blanks.filter(b => !inline.has(b.id) && visible(page, b.id, current)) as blank}
      <label class="story-field">{blank.label[prefs.uiLocale]} {@render input(blank)}</label>
    {/each}
    {#each page.choices.filter(c => visible(page, c.id, current)) as choice}
      <fieldset class="story-choice" disabled={readonly}>
        <legend>{choice.prompt[prefs.uiLocale]}{#if choice.about} · <span lang={locale}>{choice.about}</span>{/if}</legend>
        {#each choice.options as option}
          <label><input type="radio" name={choice.id} checked={current[choice.id] === option.value} onchange={() => answer(choice.id, option.value)} />{option.label[prefs.uiLocale]}</label>
        {/each}
        <label><input type="radio" name={choice.id} checked={!current[choice.id]} onchange={() => answer(choice.id, '')} />{t(prefs.uiLocale, 'story.skip')}</label>
      </fieldset>
    {/each}
    <footer class="story-navigation">
      {#if page.chapter === 'ending'}
        <button type="button" class="tool-btn" onclick={onClose}>{t(prefs.uiLocale, 'story.close')}</button>
      {:else}
        {#if index > 0}<button type="button" class="tool-btn" onclick={() => index--}>{t(prefs.uiLocale, 'story.previous')}</button>{/if}
        {#if !readonly}<button type="button" class="tool-btn" onclick={() => next(true)}>{t(prefs.uiLocale, 'story.skip')}</button>{/if}
        <button type="button" class="tool-btn" onclick={() => next()}>{t(prefs.uiLocale, hasAnswer && !readonly ? 'story.next' : 'story.turn')}</button>
      {/if}
    </footer>
  </div>
</div>
