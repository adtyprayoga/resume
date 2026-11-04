import type { Locale } from '$lib/model/types'

type Bilingual = Record<Locale, string>

export type SummaryAnswers = {
  years?: string
  field?: string
  industries?: string[]
  expertise?: string[]
  audience?: string
  strengths?: string[]
}

type BulletAnswers = { with?: string; goal?: string; achievement?: string }

export const NARRATION = {
  opening: {
    en: 'Once upon a time, there lived a {headlineFirstPart} called {name}.',
    id: 'Pada suatu masa, hiduplah seorang {headlineFirstPart} bernama {name}.',
  },
  headlineTitle: { en: 'Headline', id: 'Headline' },
  summaryTitle: { en: 'Profile Summary', id: 'Ringkasan Profil' },
  competenciesTitle: { en: 'Competencies', id: 'Kompetensi' },
  experienceTitle: { en: 'Working Experience', id: 'Pengalaman Kerja' },
  educationTitle: { en: 'Education', id: 'Pendidikan' },
  courseTitle: { en: 'Course', id: 'Kursus' },
  referencesTitle: { en: 'References', id: 'Referensi' },
  ending: {
    en: 'And so the story of {name} was written.',
    id: 'Dan begitulah kisah {name} dituliskan.',
  },
  endingCounts: {
    en: 'You filled {filled} blanks and skipped {skipped}.',
    id: 'Kamu mengisi {filled} bagian dan melewati {skipped}.',
  },
} satisfies Record<string, Bilingual>

export const GROUP_TITLES: Record<'soft' | 'tools' | 'languages' | 'core', Bilingual> = {
  soft: { en: 'Soft Skills', id: 'Soft Skills' },
  tools: { en: 'Support Technical Skills', id: 'Keterampilan Teknis Pendukung' },
  languages: { en: 'Languages', id: 'Bahasa' },
  core: { en: 'Core Skills', id: 'Keahlian Utama' },
}

const SUMMARY = {
  yearsField: { en: 'I have {years} years of experience in the field of {field}', id: 'Saya memiliki {years} tahun pengalaman di bidang {field}' },
  years: { en: 'I have {years} years of experience', id: 'Saya memiliki {years} tahun pengalaman' },
  field: { en: 'I work in the field of {field}', id: 'Saya bekerja di bidang {field}' },
  industriesSuffix: { en: ', across industries including {list}', id: ', di berbagai industri termasuk {list}' },
  industriesAlone: { en: 'I have experience in industries including {list}.', id: 'Saya memiliki pengalaman di berbagai industri termasuk {list}.' },
  expertise: { en: 'My expertise involves {list}.', id: 'Keahlian saya meliputi {list}.' },
  audience: { en: 'I have worked with {audience}.', id: 'Saya telah bekerja dengan {audience}.' },
  strengths: { en: 'I am known for being {list}.', id: 'Saya dikenal sebagai pribadi yang {list}.' },
} satisfies Record<string, Bilingual>

const BULLET = {
  stakeholderBoth: { en: 'Collaborating with {with} to achieve {goal}.', id: 'Berkolaborasi dengan {with} untuk mencapai {goal}.' },
  stakeholderWith: { en: 'Collaborating with {with}.', id: 'Berkolaborasi dengan {with}.' },
  stakeholderGoal: { en: 'Working towards {goal}.', id: 'Bekerja untuk mencapai {goal}.' },
  achievement: { en: 'Contributing to the achievement of {achievement}.', id: 'Berkontribusi dalam pencapaian {achievement}.' },
} satisfies Record<string, Bilingual>

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

export function joinList(items: string[], locale: Locale): string {
  if (items.length < 2) return items[0] ?? ''
  const conjunction = locale === 'en' ? 'and' : 'dan'
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items.at(-1)}`
}

export function summarySentence(a: SummaryAnswers, locale: Locale): string {
  const present = (value?: string) => Boolean(value?.trim())
  const list = (values?: string[]) => values?.filter((value) => value.trim()) ?? []
  const sentences: string[] = []
  const industries = list(a.industries)

  let first = ''
  if (present(a.years) && present(a.field)) first = fill(SUMMARY.yearsField[locale], { years: a.years!, field: a.field! })
  else if (present(a.years)) first = fill(SUMMARY.years[locale], { years: a.years! })
  else if (present(a.field)) first = fill(SUMMARY.field[locale], { field: a.field! })

  if (first) {
    if (industries.length) first += fill(SUMMARY.industriesSuffix[locale], { list: joinList(industries, locale) })
    sentences.push(`${first}.`)
  } else if (industries.length) {
    sentences.push(fill(SUMMARY.industriesAlone[locale], { list: joinList(industries, locale) }))
  }

  const expertise = list(a.expertise)
  if (expertise.length) sentences.push(fill(SUMMARY.expertise[locale], { list: joinList(expertise, locale) }))
  if (present(a.audience)) sentences.push(fill(SUMMARY.audience[locale], { audience: a.audience! }))
  const strengths = list(a.strengths)
  if (strengths.length) sentences.push(fill(SUMMARY.strengths[locale], { list: joinList(strengths, locale) }))
  return sentences.join(' ')
}

export function bulletSentence(kind: 'stakeholder' | 'achievement', a: BulletAnswers, locale: Locale): string {
  if (kind === 'achievement') {
    return a.achievement?.trim() ? fill(BULLET.achievement[locale], { achievement: a.achievement }) : ''
  }
  if (a.with?.trim() && a.goal?.trim()) return fill(BULLET.stakeholderBoth[locale], { with: a.with, goal: a.goal })
  if (a.with?.trim()) return fill(BULLET.stakeholderWith[locale], { with: a.with })
  if (a.goal?.trim()) return fill(BULLET.stakeholderGoal[locale], { goal: a.goal })
  return ''
}

export function hardGroupTitle(field: string, locale: Locale): string {
  return locale === 'en' ? `${field} Skills` : `Keahlian ${field}`
}

/** Story prose stays in document language; control metadata carries both UI languages. */
export const STORY = {
  identity: { en: 'Their story also carried these words: {headline}.', id: 'Kisahnya juga membawa kata-kata ini: {headline}.' },
  secondary: { en: 'Alongside that work, another role was waiting to be named: {secondary}.', id: 'Di samping pekerjaan itu, ada peran lain yang menunggu disebutkan: {secondary}.' },
  differentiator: { en: 'What made their approach their own? Perhaps {differentiator}.', id: 'Apa yang membuat pendekatannya khas? Mungkin {differentiator}.' },
  city: { en: 'Their journey had a home in {city}.', id: 'Perjalanannya berawal dari {city}.' },
  address: { en: 'The place recorded was {location}. Which city should this story name? {city}.', id: 'Tempat yang tercatat adalah {location}. Kota mana yang ingin disebut dalam kisah ini? {city}.' },
  contact: { en: 'People could reach them by email at {email}, by phone at {phone}, or through LinkedIn at {linkedin}.', id: 'Orang dapat menghubunginya melalui email {email}, telepon {phone}, atau LinkedIn {linkedin}.' },
  photo: { en: 'A professional photo could accompany this story, if they wished; it is optional.', id: 'Foto profesional boleh menemani kisah ini jika diinginkan; sifatnya opsional.' },
  summary: { en: 'Looking back, they described the journey in their own words: {summary}', id: 'Menengok ke belakang, mereka menggambarkan perjalanan dengan kata-kata sendiri: {summary}' },
  yearsField: { en: 'How long had this journey unfolded? {years} years, in the field of {field}.', id: 'Sudah berapa lama perjalanan ini berlangsung? {years} tahun, di bidang {field}.' },
  summaryMore: { en: 'It led through {industries}, where they practised {expertise}. Along the way they worked with {audience}, and became known for {strengths}.', id: 'Perjalanan itu melewati {industries}, tempat mereka mendalami {expertise}. Sepanjang jalan mereka bekerja dengan {audience}, dan dikenal karena {strengths}.' },
  skillGroup: { en: 'In their collection of {title}, they carried {items}.', id: 'Dalam kumpulan {title}, mereka membawa {items}.' },
  hard: { en: 'Which craft anchored their work? In {hardField}, their skills included {hardItems}.', id: 'Keahlian apa yang mendasari pekerjaan mereka? Di bidang {hardField}, keterampilan mereka meliputi {hardItems}.' },
  tools: { en: 'To put that knowledge to work, they reached for {tools}.', id: 'Untuk menerapkan pengetahuan itu, mereka menggunakan {tools}.' },
  soft: { en: 'Working alongside others brought out their strengths in {soft}.', id: 'Bekerja bersama orang lain memperlihatkan kekuatan mereka dalam {soft}.' },
  languages: { en: 'Their conversations could travel across languages: {languages}.', id: 'Percakapan mereka dapat menjangkau berbagai bahasa: {languages}.' },
  level: { en: 'When speaking {language}, how comfortably could they work? {level}.', id: 'Saat berbicara dalam {language}, seberapa lancar mereka bekerja? {level}.' },
  wanted: { en: 'Looking towards the next chapter, which skills did the jobs they wanted ask for? {wanted}.', id: 'Menatap bab berikutnya, keterampilan apa yang diminta pekerjaan yang mereka inginkan? {wanted}.' },
  job: { en: 'The journey took them to {company}, where they worked as {role} in {location}, beginning in {start}.', id: 'Perjalanan membawa mereka ke {company}, tempat mereka bekerja sebagai {role} di {location}, mulai {start}.' },
  team: { en: 'Their team was {team}.', id: 'Tim mereka adalah {team}.' },
  duty: { en: 'One part of that work was recorded in their own words: {bullet}', id: 'Salah satu bagian pekerjaan itu tercatat dalam kata-kata mereka sendiri: {bullet}' },
  achievement: { en: 'What changed because of that work? A result they could count was {achievement}.', id: 'Apa yang berubah berkat pekerjaan itu? Hasil yang dapat mereka ukur adalah {achievement}.' },
  collaboration: { en: 'Who shared that chapter? They worked with {with}, towards {goal}.', id: 'Siapa yang berbagi bab itu? Mereka bekerja bersama {with}, menuju {goal}.' },
  end: { en: 'If that chapter had closed, when did it end? {end}.', id: 'Jika bab itu sudah selesai, kapan berakhirnya? {end}.' },
  ended: { en: 'That chapter ended in {end}.', id: 'Bab itu berakhir pada {end}.' },
  current: { en: 'That chapter is still unfolding.', id: 'Bab itu masih berlangsung.' },
  education: { en: 'At {school}, they pursued {degree} in {field}, beginning in {start}. Their GPA was {gpa}.', id: 'Di {school}, mereka menempuh {degree} dalam bidang {field}, mulai {start}. IPK mereka adalah {gpa}.' },
  detail: { en: 'They remembered it this way: {description}', id: 'Mereka mengenangnya seperti ini: {description}' },
  course: { en: 'Their learning continued with {title}, offered by {issuer} in {date}.', id: 'Pembelajaran mereka berlanjut melalui {title}, dari {issuer} pada {date}.' },
  courseDate: { en: 'The recorded date was {date}; which month belongs beside it? {month}.', id: 'Tanggal yang tercatat adalah {date}; bulan apa yang melengkapinya? {month}.' },
  topics: { en: 'What did they explore there? {topics}.', id: 'Apa yang mereka pelajari di sana? {topics}.' },
  reference: { en: 'Someone who knew their work was {name}, whose position was {position}. They could be reached by phone at {phone} or email at {email}.', id: 'Seseorang yang mengenal pekerjaan mereka adalah {name}, dengan posisi {position}. Mereka dapat dihubungi melalui telepon {phone} atau email {email}.' },
  note: { en: 'For those who wanted to hear from others, they left this note: {note}', id: 'Bagi yang ingin mendengar dari orang lain, mereka meninggalkan catatan ini: {note}' },
} satisfies Record<string, Bilingual>

export const STORY_LABELS = {
  secondary: { en: 'Another role', id: 'Peran lain' }, differentiator: { en: 'Distinctive strength', id: 'Kekuatan khas' },
  city: { en: 'City', id: 'Kota' }, email: { en: 'Email', id: 'Email' }, phone: { en: 'Phone', id: 'Telepon' }, linkedin: { en: 'LinkedIn', id: 'LinkedIn' },
  years: { en: 'Years of experience', id: 'Lama pengalaman' }, field: { en: 'Field', id: 'Bidang' }, industries: { en: 'Industries', id: 'Industri' }, expertise: { en: 'Expertise', id: 'Keahlian' }, audience: { en: 'People you worked with', id: 'Orang yang bekerja bersama Anda' }, strengths: { en: 'Strengths', id: 'Kekuatan' },
  hardField: { en: 'Core field', id: 'Bidang utama' }, hardItems: { en: 'Core skills', id: 'Keahlian utama' }, tools: { en: 'Tools', id: 'Alat' }, soft: { en: 'Soft skills', id: 'Keterampilan interpersonal' }, languages: { en: 'Languages', id: 'Bahasa' }, wanted: { en: 'Skills sought by target jobs', id: 'Keahlian yang diminta pekerjaan tujuan' },
  company: { en: 'Company', id: 'Perusahaan' }, role: { en: 'Role', id: 'Peran' }, location: { en: 'City', id: 'Kota' }, start: { en: 'Start month', id: 'Bulan mulai' }, end: { en: 'End month', id: 'Bulan selesai' }, achievement: { en: 'Measurable result', id: 'Hasil terukur' }, with: { en: 'Collaborators', id: 'Rekan kerja' }, goal: { en: 'Shared goal', id: 'Tujuan bersama' },
  school: { en: 'School', id: 'Institusi pendidikan' }, degree: { en: 'Degree', id: 'Gelar' }, gpa: { en: 'GPA', id: 'IPK' }, title: { en: 'Course title', id: 'Nama kursus' }, issuer: { en: 'Course provider', id: 'Penyelenggara kursus' }, date: { en: 'Course month', id: 'Bulan kursus' }, topics: { en: 'Topics studied', id: 'Topik yang dipelajari' }, name: { en: 'Reference name', id: 'Nama referensi' }, position: { en: 'Position', id: 'Posisi' },
  current: { en: 'Is this chapter still ongoing?', id: 'Apakah bab ini masih berlangsung?' }, core: { en: 'Which duty was at the heart of this work?', id: 'Tugas mana yang menjadi inti pekerjaan ini?' }, order: { en: 'Tell the most recent work chapter first?', id: 'Ceritakan pekerjaan terbaru terlebih dahulu?' }, supervisor: { en: 'Was this person your supervisor?', id: 'Apakah orang ini atasan Anda?' },
  experience: { en: 'Is there a work chapter you would like to tell?', id: 'Adakah pengalaman kerja yang ingin Anda ceritakan?' }, education: { en: 'Is there a chapter of study to add?', id: 'Adakah pengalaman pendidikan yang ingin ditambahkan?' }, course: { en: 'Did a course become part of your journey?', id: 'Adakah kursus dalam perjalanan Anda?' }, references: { en: 'Would you like to name someone who knows your work?', id: 'Apakah Anda ingin menyebut seseorang yang mengenal pekerjaan Anda?' },
  yes: { en: 'Yes', id: 'Ya' }, no: { en: 'No', id: 'Tidak' }, ending: { en: 'The next chapter', id: 'Bab berikutnya' },
} satisfies Record<string, Bilingual>
