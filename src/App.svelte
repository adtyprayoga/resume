<script lang="ts">
  import ResumePaper from '$components/preview/ResumePaper.svelte'
  import { resumeFileName, serializeResume } from '$lib/io/exportJson'
  import { t } from '$lib/i18n/ui'
  import { resolve } from '$lib/model/resolve'
  import type { Locale } from '$lib/model/types'
  import { printResume } from '$lib/print/print'
  import { sampleDocument } from './data/sample'

  let locale = $state<Locale>('en')
  const doc = $state(sampleDocument())

  const resume = $derived(resolve(doc, locale))

  const print = () => printResume(resumeFileName(resume.profile.name, locale))

  const exportJson = () => {
    const blob = new Blob([serializeResume(doc)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${resumeFileName(resume.profile.name, locale)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
</script>

<div class="min-h-screen bg-neutral-100 py-8">
  <div class="mx-auto max-w-[210mm] px-4" data-print-hide>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <div class="flex overflow-hidden rounded-md border border-neutral-300 bg-white">
        {#each ['id', 'en'] as const as option (option)}
          <button
            type="button"
            class="px-3 py-1.5 text-sm {locale === option
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-700 hover:bg-neutral-50'}"
            onclick={() => (locale = option)}
          >
            {option.toUpperCase()}
          </button>
        {/each}
      </div>
      <button
        type="button"
        class="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
        onclick={print}
      >
        {t(locale, 'action.print')}
      </button>
      <button
        type="button"
        class="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
        onclick={exportJson}
      >
        {t(locale, 'action.exportJson')}
      </button>
    </div>
    <p class="mb-4 text-xs text-neutral-500">{t(locale, 'app.demoNotice')}</p>
  </div>

  <div class="resume-paper-frame">
    <ResumePaper {resume} {locale} />
  </div>
</div>
