import type { Locale } from '$lib/model/types'

/**
 * UI chrome strings only — never resume content, which lives in the document's
 * per-locale text nodes. The two are independent: a user may well want an
 * Indonesian interface while editing an English resume.
 */
const strings = {
  en: {
    'section.experience': 'Experience',
    'section.education': 'Education',
    'section.projects': 'Projects',
    'section.skills': 'Skills',
    'section.awards': 'Awards',
    'date.present': 'Present',
    'action.print': 'Save as PDF',
    'action.exportJson': 'Export JSON',
    'action.importJson': 'Import JSON',
    'action.edit': 'Edit',
    'app.demoNotice':
      'The resume shown is a fictional example, for demonstrating layout and export only.',
  },
  id: {
    'section.experience': 'Pengalaman Kerja',
    'section.education': 'Pendidikan',
    'section.projects': 'Proyek',
    'section.skills': 'Keahlian',
    'section.awards': 'Penghargaan',
    'date.present': 'Sekarang',
    'action.print': 'Simpan sebagai PDF',
    'action.exportJson': 'Ekspor JSON',
    'action.importJson': 'Impor JSON',
    'action.edit': 'Sunting',
    'app.demoNotice':
      'Resume yang ditampilkan adalah contoh fiktif, hanya untuk mendemonstrasikan tata letak dan ekspor.',
  },
} as const satisfies Record<Locale, Record<string, string>>

export type UiStringKey = keyof (typeof strings)['en']

export const t = (locale: Locale, key: UiStringKey): string => strings[locale][key]
