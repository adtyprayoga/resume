#!/usr/bin/env bun
/**
 * Prints both layouts through headless Chromium and checks what a text
 * extractor sees in the PDF. jsdom has no layout engine, so reading order,
 * pagination and font embedding can only be checked against a real PDF.
 *
 * Isolated: a throwaway Chromium profile and seeded fixture data, so nothing
 * touches the user's own browser storage. Drives Chromium over the DevTools
 * protocol with Bun's built-in WebSocket; no runtime dependency is added.
 *
 * Usage: bun scripts/verify-ats.ts [URL]
 *   Without a URL, starts its own Vite dev server on a spare port.
 * Needs chromium and poppler-utils (pdftotext, pdfinfo, pdffonts, pdfimages).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const DOCUMENT_KEY = 'resume-document-v1'
const PREFERENCES_KEY = 'resume-preferences-v1'
const ROOT = resolve(import.meta.dir, '..')
const work = mkdtempSync(join(tmpdir(), 'verify-ats-'))

// ---------------------------------------------------------------- fixture
//
// Every field carries a unique marker so its position in the extracted text
// is unambiguous. Years only: month names come from the browser's ICU data,
// which this script would otherwise have to reproduce exactly.

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const contact = {
  email: 'kurniawati.wulandari.dewi.ctmail@contoh-organisasi-yang-sangat-panjang.co.id',
  phone: '+62 812 0000 1111 CTPHONE',
  website: 'https://portofolio.contoh-organisasi-yang-sangat-panjang.co.id/tentang/saya/CTWEB',
  github: 'https://github.com/ctgithub-kurniawati-wulandari',
  linkedin: 'https://www.linkedin.com/in/ctlinkedin-kurniawati-wulandari-dewi-1234567890',
  avatar: PIXEL,
}

const filler = (lang: 'en' | 'id', tag: string) =>
  lang === 'en'
    ? `${tag} Coordinated delivery across product, design, and operations teams, measuring outcomes weekly and documenting decisions so new teammates could follow the reasoning without a meeting.`
    : `${tag} Mengoordinasikan pengiriman lintas tim produk, desain, dan operasi, mengukur hasil setiap minggu, dan mendokumentasikan keputusan agar rekan baru dapat mengikuti alasannya tanpa rapat.`

const job = (n: number, current: boolean, blanks: boolean) => ({
  id: `exp_${n}`,
  company: `Perusahaan Nusantara E${n}CO`,
  dates: current ? { start: '2023', end: null, current: true } : { start: String(2014 + n), end: String(2015 + n) },
  text: Object.fromEntries(
    (['en', 'id'] as const).map((lang) => [
      lang,
      {
        role: lang === 'en' ? `Platform Engineer E${n}ROLE` : `Perekayasa Platform E${n}ROLE`,
        team: blanks ? '' : lang === 'en' ? `Café Payments E${n}TEAM` : `Pembayaran Kafé E${n}TEAM`,
        location: blanks ? '' : `Yogyakarta E${n}LOC`,
        bullets: [1, 2, 3, 4].map((b) => filler(lang, `E${n}B${b}`)),
      },
    ]),
  ),
})

const fixture = {
  schemaVersion: 1,
  contact,
  profile: {
    text: {
      en: {
        name: 'Kurniawati Wulandari PNAME',
        headline: 'Staff Engineer for Résumé Systems PHEAD',
        location: 'Yogyakarta, Indonesia CTLOC',
        summary: 'PSUM Engineer focused on accessible, multilingual products used by Zoë, Dvořák, and Nguyễn alike.',
      },
      id: {
        name: 'Kurniawati Wulandari PNAME',
        headline: 'Perekayasa Staf Sistem Resume PHEAD',
        location: 'Yogyakarta, Indonesia CTLOC',
        summary: 'PSUM Perekayasa yang berfokus pada produk multibahasa yang mudah diakses oleh Zoë, Dvořák, dan Nguyễn.',
      },
    },
  },
  sections: ['experience', 'education', 'projects', 'skills', 'awards'].map((kind) => ({ kind, enabled: true })),
  content: {
    experience: [job(1, true, false), job(2, false, true), job(3, false, false), job(4, false, false), job(5, false, false)],
    education: [
      {
        id: 'edu_1',
        gpa: '3.80 / 4.00 D1GPA',
        dates: { start: '2008', end: '2012' },
        text: {
          en: { school: 'Gadjah Mada University D1SCHOOL', degree: 'Bachelor of Science D1DEG', field: 'Computer Science D1FIELD', description: 'D1DESC Thesis on text extraction from scanned forms.' },
          id: { school: 'Universitas Gadjah Mada D1SCHOOL', degree: 'Sarjana Sains D1DEG', field: 'Ilmu Komputer D1FIELD', description: 'D1DESC Skripsi tentang ekstraksi teks dari formulir pindaian.' },
        },
      },
      {
        id: 'edu_2',
        gpa: '',
        dates: { start: '2005', end: '2008' },
        text: {
          en: { school: 'SMA Negeri 1 Yogyakarta D2SCHOOL', degree: '', field: '', description: '' },
          id: { school: 'SMA Negeri 1 Yogyakarta D2SCHOOL', degree: '', field: '', description: '' },
        },
      },
    ],
    projects: [1, 2].map((n) => ({
      id: `prj_${n}`,
      link: n === 1 ? 'https://github.com/kurniawati/proyek-ekstraksi-teks-yang-panjang-P1LINK' : '',
      techStack: [`TypeScript P${n}TECH`, 'PostgreSQL'],
      dates: { start: '2021', end: '2022' },
      text: {
        en: { name: `Parser Kit P${n}NAME`, role: `Maintainer P${n}ROLE`, description: `P${n}DESC A toolkit for structured text.`, bullets: [filler('en', `P${n}B1`)] },
        id: { name: `Parser Kit P${n}NAME`, role: `Pengelola P${n}ROLE`, description: `P${n}DESC Perangkat untuk teks terstruktur.`, bullets: [filler('id', `P${n}B1`)] },
      },
    })),
    skills: [
      { id: 'skl_1', text: { en: { title: 'Languages S1CAT', items: ['TypeScript S1A', 'Go S1B', 'SQL S1C'] }, id: { title: 'Bahasa S1CAT', items: ['TypeScript S1A', 'Go S1B', 'SQL S1C'] } } },
      { id: 'skl_2', text: { en: { title: 'Practices S2CAT', items: ['Accessibility S2A', 'Testing S2B'] }, id: { title: 'Praktik S2CAT', items: ['Aksesibilitas S2A', 'Pengujian S2B'] } } },
    ],
    awards: [
      { id: 'awd_1', date: '2022', text: { en: { title: 'Engineering Award A1TITLE', issuer: 'Nusantara Guild A1ISSUER', description: 'A1DESC For the extraction toolkit.' }, id: { title: 'Penghargaan Rekayasa A1TITLE', issuer: 'Nusantara Guild A1ISSUER', description: 'A1DESC Untuk perangkat ekstraksi.' } } },
      { id: 'awd_2', date: '2020', text: { en: { title: 'Mentor of the Year A2TITLE', issuer: '', description: '' }, id: { title: 'Mentor Terbaik A2TITLE', issuer: '', description: '' } } },
    ],
  },
}

type Lang = 'en' | 'id'
const text = (lang: Lang) => ({
  profile: fixture.profile.text[lang],
  jobs: fixture.content.experience.map((item) => ({ ...item, ...item.text[lang] })),
  schools: fixture.content.education.map((item) => ({ ...item, ...item.text[lang] })),
  projects: fixture.content.projects.map((item) => ({ ...item, ...item.text[lang] })),
  skills: fixture.content.skills.map((item) => item.text[lang]),
  awards: fixture.content.awards.map((item) => ({ ...item, ...item.text[lang] })),
})

const range = (dates: { start: string; end: string | null; current?: boolean }, present: string) =>
  [dates.start, dates.current ? present : dates.end].filter(Boolean).join(' – ')

/** Every field the ATS layout must emit, in reading order. */
const atsSequence = (lang: Lang): string[] => {
  const t = text(lang)
  const en = lang === 'en'
  const present = en ? 'Present' : 'Sekarang'
  return [
    t.profile.name,
    t.profile.headline,
    t.profile.location,
    contact.email,
    contact.phone,
    contact.website,
    contact.github,
    contact.linkedin,
    en ? 'Summary' : 'Ringkasan Profesional',
    t.profile.summary,
    en ? 'Work Experience' : 'Pengalaman Kerja',
    ...t.jobs.flatMap((job) => [
      job.role,
      [job.company, job.team, job.location].filter(Boolean).join(', '),
      range(job.dates, present),
      ...job.bullets,
    ]),
    en ? 'Education' : 'Pendidikan',
    ...t.schools.flatMap((school) => [
      school.school,
      [school.degree, school.field, school.gpa && `GPA ${school.gpa}`].filter(Boolean).join(', '),
      range(school.dates, present),
      school.description,
    ]),
    en ? 'Projects' : 'Proyek',
    ...t.projects.flatMap((project) => [
      `${project.name} — ${project.role}`,
      range(project.dates, present),
      project.techStack.join(', '),
      project.description,
      ...project.bullets,
      project.link,
    ]),
    en ? 'Skills' : 'Keahlian',
    ...t.skills.map((skill) => `${skill.title}: ${skill.items.join(', ')}`),
    en ? 'Awards' : 'Penghargaan',
    ...t.awards.flatMap((award) => [award.title, award.issuer, award.date, award.description]),
  ].filter(Boolean)
}

// ---------------------------------------------------------------- checks

let failures = 0
const fail = (message: string) => {
  failures += 1
  console.log(`  FAIL ${message}`)
}
const pass = (message: string) => console.log(`  ok   ${message}`)
const check = (condition: boolean, message: string) => (condition ? pass(message) : fail(message))

const run = (cmd: string[]) => {
  const result = Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(`${cmd[0]} failed: ${result.stderr.toString()}`)
  return result.stdout.toString()
}

/** Whitespace-free, so line wrapping inside a field cannot hide or fake a match. */
const squash = (value: string) => value.replace(/\s+/g, '')

const occurrences = (haystack: string, needle: string) => {
  let count = 0
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) count += 1
  return count
}

/** Fixture fields carry one of these; headings and bare dates do not and may recur. */
const MARKER = /\b(?:[EDPSA]\d[A-Z]+|CT[A-Z]+|ct[a-z]+|PNAME|PHEAD|PSUM)\b/

/**
 * Every field once, in order. Headings like "Skills" may legitimately recur
 * inside other text, so they are located after the previous field instead of
 * being counted.
 */
const checkSequence = (label: string, extracted: string, fields: string[]) => {
  const body = squash(extracted)
  let cursor = 0
  const problems: string[] = []
  for (const field of fields) {
    const needle = squash(field)
    const isMarked = MARKER.test(field)
    if (isMarked && occurrences(body, needle) !== 1) {
      problems.push(`"${field}" appears ${occurrences(body, needle)} times`)
      continue
    }
    const at = body.indexOf(needle, cursor)
    if (at === -1) {
      problems.push(body.includes(needle) ? `"${field}" is out of order` : `"${field}" is missing or interleaved`)
      continue
    }
    cursor = at + needle.length
  }
  if (problems.length) fail(`${label}: ${problems.slice(0, 4).join('; ')}${problems.length > 4 ? ` (+${problems.length - 4} more)` : ''}`)
  else pass(`${label}: ${fields.length} fields in order, each once`)
}

interface PdfReport {
  path: string
  pages: number
  sizes: string[]
  normal: string
  raw: string
  images: number
  fonts: { name: string; embedded: boolean }[]
  words: { page: number; width: number; height: number; xMin: number; yMin: number; xMax: number; yMax: number }[]
}

const inspect = (path: string): PdfReport => {
  const info = run(['pdfinfo', '-l', '999', path])
  const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? 0)
  const sizes = [...info.matchAll(/^Page\s+\d+ size:\s+(.+)$/gm)].map((match) => match[1]!.trim())
  const fonts = run(['pdffonts', path])
    .split('\n')
    .slice(2)
    .filter(Boolean)
    .map((line) => {
      const match = /\s(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$/.exec(line)
      return { name: line.split(/\s+/)[0]!, embedded: match?.[1] === 'yes' }
    })
  const images = run(['pdfimages', '-list', path]).split('\n').slice(2).filter(Boolean).length
  const bbox = run(['pdftotext', '-bbox', path, '-'])
  const words: PdfReport['words'] = []
  let page = 0
  let width = 0
  let height = 0
  for (const line of bbox.split('\n')) {
    const pageMatch = /<page width="([\d.]+)" height="([\d.]+)">/.exec(line)
    if (pageMatch) {
      page += 1
      width = Number(pageMatch[1])
      height = Number(pageMatch[2])
      continue
    }
    const word = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">/.exec(line)
    if (word) words.push({ page, width, height, xMin: +word[1]!, yMin: +word[2]!, xMax: +word[3]!, yMax: +word[4]! })
  }
  return {
    path,
    pages,
    sizes,
    normal: run(['pdftotext', path, '-']),
    raw: run(['pdftotext', '-raw', path, '-']),
    images,
    fonts,
    words,
  }
}

/** 210 x 297mm is 595.28 x 841.89pt; Chromium rounds to whole device pixels. */
const isA4 = (size: string) => {
  const match = /^([\d.]+) x ([\d.]+) pts/.exec(size)
  return !!match && Math.abs(+match[1]! - 595.28) < 1 && Math.abs(+match[2]! - 841.89) < 1
}
// 16mm ≈ 45.4pt, 18mm ≈ 51.0pt; a little slack for glyph side bearings.
const MIN_Y = 43
const MIN_X = 49

const checkGeometry = (label: string, pdf: PdfReport) => {
  check(pdf.sizes.length === pdf.pages && pdf.sizes.every(isA4), `${label}: every page is A4`)
  const outside = pdf.words.filter(
    (w) => w.xMin < MIN_X || w.yMin < MIN_Y || w.xMax > w.width - MIN_X || w.yMax > w.height - MIN_Y,
  )
  check(outside.length === 0, `${label}: all text inside 16mm/18mm margins on ${pdf.pages} pages${outside.length ? ` (${outside.length} words outside)` : ''}`)
  check(pdf.words.length > 100, `${label}: text is selectable (${pdf.words.length} words)`)
  check(pdf.fonts.length > 0 && pdf.fonts.every((font) => font.embedded), `${label}: all ${pdf.fonts.length} fonts embedded`)
}

const LEAKS = [
  'Save as PDF', 'Simpan sebagai PDF', 'Export JSON', 'Resume layout', 'Tata letak', 'fictional example',
  'Load photo', 'Muat foto', 'hosted elsewhere', 'Page breaks',
]

const checkClean = (label: string, pdf: PdfReport) => {
  const leaked = LEAKS.filter((phrase) => pdf.normal.includes(phrase))
  check(leaked.length === 0, `${label}: no app controls or consent notices${leaked.length ? ` (found ${leaked.join(', ')})` : ''}`)
  check(!/^\s*(Page|Halaman)\s+\d+\s*$/m.test(pdf.normal), `${label}: no page-guide labels`)
}

// ---------------------------------------------------------------- browser

class Cdp {
  private id = 0
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  private listeners: ((message: any) => void)[] = []
  sessionId = ''

  private constructor(private socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id && this.pending.has(message.id)) {
        const handlers = this.pending.get(message.id)!
        this.pending.delete(message.id)
        if (message.error) handlers.reject(new Error(`${message.error.message}`))
        else handlers.resolve(message.result)
      } else {
        for (const listener of this.listeners) listener(message)
      }
    })
  }

  static async connect(url: string) {
    const socket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    return new Cdp(socket)
  }

  send(method: string, params: Record<string, unknown> = {}, session = this.sessionId): Promise<any> {
    const id = ++this.id
    this.socket.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }

  once(method: string): Promise<any> {
    return new Promise((resolve) => {
      const listener = (message: any) => {
        if (message.method !== method) return
        this.listeners = this.listeners.filter((other) => other !== listener)
        resolve(message.params)
      }
      this.listeners.push(listener)
    })
  }

  close() {
    this.socket.close()
  }
}

const startServer = async (): Promise<{ url: string; stop: () => void }> => {
  const port = 5300 + Math.floor(Math.random() * 400)
  const server = Bun.spawn(['bunx', 'vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdout: 'ignore',
    stderr: 'ignore',
  })
  const url = `http://127.0.0.1:${port}/`
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => server.kill() }
    } catch {}
    await Bun.sleep(150)
  }
  server.kill()
  throw new Error('Vite dev server did not start')
}

const startChromium = async () => {
  const profile = join(work, 'profile')
  const browser = Bun.spawn(
    [
      'chromium', '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
      '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0',
      `--user-data-dir=${profile}`, 'about:blank',
    ],
    { stdout: 'ignore', stderr: 'pipe' },
  )
  const reader = browser.stderr.getReader()
  let log = ''
  while (!/DevTools listening on (ws:\/\/\S+)/.test(log)) {
    const { value, done } = await reader.read()
    if (done) throw new Error(`Chromium exited before DevTools was ready:\n${log}`)
    log += new TextDecoder().decode(value)
  }
  reader.releaseLock()
  const cdp = await Cdp.connect(/DevTools listening on (ws:\/\/\S+)/.exec(log)![1]!)
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  cdp.sessionId = sessionId
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  return { cdp, stop: () => { cdp.close(); browser.kill() } }
}

const main = async () => {
  const server = process.argv[2] ? { url: process.argv[2], stop: () => {} } : await startServer()
  const chromium = await startChromium()
  const { cdp } = chromium

  const evaluate = async (expression: string) => {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (exceptionDetails) throw new Error(`${expression}: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`)
    return result.value
  }
  /** Lets Svelte flush, layout settle, and the page-guide frame run. */
  const settle = () =>
    evaluate(`document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))))`)
  const load = async () => {
    const loaded = cdp.once('Page.loadEventFired')
    await cdp.send('Page.navigate', { url: server.url })
    await loaded
    await settle()
  }
  /**
   * Seeds storage as the next document starts, not from the current page: the
   * app flushes its autosave on pagehide, which would overwrite a write made
   * before navigating.
   */
  const seed = async (doc: object, prefs: object) => {
    const source = `localStorage.clear(); localStorage.setItem(${JSON.stringify(DOCUMENT_KEY)}, ${JSON.stringify(JSON.stringify(doc))}); localStorage.setItem(${JSON.stringify(PREFERENCES_KEY)}, ${JSON.stringify(JSON.stringify(prefs))});`
    const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source })
    await load()
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  }
  const click = async (label: string) => {
    const found = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(`button[aria-label="${label}"]`)}); if (!b) return false; b.click(); return true })()`)
    if (!found) throw new Error(`no button labelled "${label}"`)
    await settle()
  }
  const viewport = async (width: number, height: number) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 800 })
    await settle()
  }
  let printed = 0
  const print = async (name: string, background = false) => {
    const { data } = await cdp.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: background, displayHeaderFooter: false })
    const path = join(work, `${String(++printed).padStart(2, '0')}-${name}.pdf`)
    writeFileSync(path, Buffer.from(data, 'base64'))
    return inspect(path)
  }
  const presentation = () => evaluate(`document.querySelector('.resume-paper')?.dataset.presentation`)

  try {
    const prefs = { uiLocale: 'en', documentLocale: 'en', themeKey: 'minimal', fontScale: 'standard' }
    await viewport(1440, 900)
    await load()
    await seed(fixture, prefs)
    check((await presentation()) === 'classic', 'starts in Classic')
    // After the first autosave, storage holds the app's normalized form of the fixture.
    await Bun.sleep(1000)
    const storedDocument = () => evaluate(`localStorage.getItem(${JSON.stringify(DOCUMENT_KEY)})`)
    const baseline: string = await storedDocument()
    check(JSON.parse(baseline).profile.text.en.name === fixture.profile.text.en.name, 'fixture loaded')

    console.log('\nATS, English, desktop')
    await click('Resume layout: ATS')
    check((await presentation()) === 'ats', 'layout button selects ATS')
    const storedPrefs = JSON.parse(await evaluate(`localStorage.getItem(${JSON.stringify(PREFERENCES_KEY)})`))
    check(storedPrefs.themeKey === 'ats', 'ATS choice is saved')
    const atsEn = await print('ats-en-desktop')
    check(atsEn.pages >= 2, `multipage (${atsEn.pages} pages)`)
    checkSequence('normal text', atsEn.normal, atsSequence('en'))
    checkSequence('raw text', atsEn.raw, atsSequence('en'))
    checkGeometry('ATS', atsEn)
    check(atsEn.images === 0, `no images (${atsEn.images})`)
    checkClean('ATS', atsEn)

    console.log('\nATS, reload keeps the choice')
    await load()
    check((await presentation()) === 'ats', 'ATS survives a reload')

    console.log('\nATS, page guides follow font size')
    const guides = () => evaluate(`[...document.querySelectorAll('.page-break')].map((e) => e.style.top).join(',')`)
    const before = await guides()
    await click('Font size: large')
    const after = await guides()
    check(before !== '' && after !== '' && before !== after, `guides moved (${before} → ${after})`)
    await click('Font size: medium')
    check((await guides()) === before, 'guides return with the font size')

    console.log('\nATS, phone preview and background graphics')
    await viewport(375, 812)
    const atsPhone = await print('ats-en-phone-bg', true)
    check(atsPhone.pages === atsEn.pages, `same page count from phone (${atsPhone.pages})`)
    check(squash(atsPhone.normal) === squash(atsEn.normal), 'same text from phone with backgrounds on')
    check(atsPhone.sizes.join() === atsEn.sizes.join(), 'same page geometry from phone')
    const wordsMatch = atsPhone.words.length === atsEn.words.length &&
      atsPhone.words.every((w, i) => Math.abs(w.xMin - atsEn.words[i]!.xMin) < 0.5 && Math.abs(w.yMin - atsEn.words[i]!.yMin) < 0.5)
    check(wordsMatch, 'same word positions from phone')
    await viewport(1440, 900)

    console.log('\nATS, Indonesian')
    await click('Resume language: Indonesian')
    const atsId = await print('ats-id-desktop')
    checkSequence('normal text', atsId.normal, atsSequence('id'))
    checkSequence('raw text', atsId.raw, atsSequence('id'))
    checkGeometry('ATS id', atsId)
    check(atsId.images === 0, 'no images')
    checkClean('ATS id', atsId)
    await viewport(375, 812)
    const atsIdPhone = await print('ats-id-phone-bg', true)
    check(atsIdPhone.pages === atsId.pages && squash(atsIdPhone.normal) === squash(atsId.normal), 'Indonesian matches from phone with backgrounds on')
    await viewport(1440, 900)
    await click('Resume language: English')

    console.log('\nBack to Classic')
    await click('Resume layout: Classic')
    check((await presentation()) === 'classic', 'layout button selects Classic')
    await Bun.sleep(1000)
    const finalDocument: string = await storedDocument()
    check(finalDocument === baseline, 'document unchanged by switching layouts and languages')
    check(JSON.parse(finalDocument).contact.avatar === PIXEL, 'photo kept in storage')
    const classic = await print('classic-en-desktop')
    check(classic.images >= 1, `photo is back (${classic.images} image)`)
    check(!squash(classic.normal).includes('WorkExperience') && /EXPERIENCE/.test(classic.normal), 'Classic headings restored')
    checkGeometry('Classic', classic)
    checkClean('Classic', classic)

    console.log('\nATS with a remote photo')
    await seed({ ...fixture, contact: { ...contact, avatar: 'https://photos.invalid/portrait.jpg' } }, { ...prefs, themeKey: 'ats' })
    const remote = await print('ats-remote-photo')
    check(remote.images === 0, 'no image')
    checkClean('ATS remote photo', remote)
    check(!(await evaluate(`document.querySelector('.resume-paper').textContent.includes('photos.invalid')`)), 'no consent prompt in the paper')

    console.log('\nNo horizontal overflow')
    for (const themeKey of ['minimal', 'ats']) {
      await seed(fixture, { ...prefs, themeKey })
      for (const [width, height] of [[320, 640], [375, 812], [768, 1024], [1440, 900], [812, 375]] as const) {
        await viewport(width, height)
        const [scroll, client] = await evaluate(`[document.documentElement.scrollWidth, document.documentElement.clientWidth]`)
        check(scroll <= client + 1, `${themeKey} at ${width}x${height}: scrollWidth ${scroll} <= clientWidth ${client} + 1`)
      }
    }
  } finally {
    chromium.stop()
    server.stop()
  }

  if (failures) {
    console.log(`\nverify:ats: ${failures} check(s) failed. PDFs kept in ${work}`)
    process.exit(1)
  }
  rmSync(work, { recursive: true, force: true })
  console.log('\nverify:ats: OK')
}

main().catch((error) => {
  console.error(error)
  console.error(`PDFs kept in ${work}`)
  process.exit(1)
})
