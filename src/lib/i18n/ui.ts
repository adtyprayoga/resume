import type { Locale } from '$lib/model/types'

/** Chrome only. Resume content lives in the document's per-locale text nodes. */
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
    'app.printHint':
      'In the print dialog choose A4, set margins to Default or None, and turn off headers and footers — browsers add a URL and date that no page can suppress.',
    'app.pageBreakHint': 'Page break guides are approximate; the print preview is authoritative.',
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
    'app.printHint':
      'Pada dialog cetak, pilih A4, atur margin ke Default atau None, lalu matikan header dan footer — peramban menambahkan URL dan tanggal yang tidak dapat dihilangkan oleh halaman.',
    'app.pageBreakHint': 'Panduan batas halaman bersifat perkiraan; pratinjau cetak adalah acuan utama.',
  },
} as const satisfies Record<Locale, Record<string, string>>

export type UiStringKey = keyof (typeof strings)['en']

export const t = (locale: Locale, key: UiStringKey): string => strings[locale][key]
