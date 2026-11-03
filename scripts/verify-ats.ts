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
    t.profile.name.toUpperCase(),
    t.profile.headline,
    t.profile.location,
    `Email: ${contact.email}`,
    `${en ? 'Phone' : 'Telepon'}: ${contact.phone}`,
    `LinkedIn: ${contact.linkedin}`,
    `GitHub: ${contact.github}`,
    `${en ? 'Portfolio' : 'Portofolio'}: ${contact.website}`,
    en ? 'Summary' : 'Ringkasan Profesional',
    t.profile.summary,
    en ? 'Work Experience' : 'Pengalaman Kerja',
    ...t.jobs.flatMap((job) => [
      job.company,
      range(job.dates, present),
      job.role,
      [job.team, job.location].filter(Boolean).join(', '),
      ...job.bullets,
    ]),
    en ? 'Education' : 'Pendidikan',
    ...t.schools.flatMap((school) => [
      school.school,
      [school.degree, school.field].filter(Boolean).join(', '),
      range(school.dates, present),
      school.gpa && `GPA ${school.gpa}`,
      school.description,
    ]),
    en ? 'Projects' : 'Proyek',
    ...t.projects.flatMap((project) => [
      `${project.name} — ${project.role} (${project.techStack.join(', ')})`,
      range(project.dates, present),
      project.description,
      ...project.bullets,
      project.link,
    ]),
    en ? 'Skills' : 'Keahlian',
    ...t.skills.map((skill) => `${skill.title}: ${skill.items.join(', ')}`),
    en ? 'Awards' : 'Penghargaan',
    ...t.awards.flatMap((award) => [award.title, award.date, award.issuer, award.description]),
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

/**
 * Poppler's normal mode infers columns from glyph positions. A right-aligned
 * date can follow its entry's body even though raw PDF order is correct. Keep
 * entry boundaries and every other field strict, and check the date stays
 * within its own entry. Raw extraction below still requires the exact order.
 */
const checkNormalSequence = (label: string, extracted: string, fields: string[]) => {
  const isDate = (field: string) => /^\d{4}(?: – (?:\d{4}|Present|Sekarang))?$/.test(field)
  checkSequence(label, extracted, fields.filter((field) => !isDate(field)))
  const body = squash(extracted)
  let cursor = 0
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!
    if (isDate(field)) {
      // Dates follow the entry heading in the raw sequence. The next entry
      // heading is the first marked field after this entry's body fields.
      const after = fields.slice(index + 1)
      const nextHeading = after.find((value) => /\b(?:[EDPSA]\d(?:CO|SCHOOL|NAME|TITLE))\b/.test(value) || /^(?:Education|Pendidikan|Projects|Proyek|Skills|Keahlian|Awards|Penghargaan)$/.test(value))
      const end = nextHeading ? body.indexOf(squash(nextHeading), cursor) : body.length
      const at = body.indexOf(squash(field), cursor)
      check(at >= cursor && at < end, `${label}: date ${field} stays within its entry`)
    } else {
      const at = body.indexOf(squash(field), cursor)
      if (at >= 0) cursor = at + squash(field).length
    }
  }
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
const CLASSIC_MIN_X = 49

const checkGeometry = (label: string, pdf: PdfReport, ats = true) => {
  const minX = ats ? 43 : CLASSIC_MIN_X
  check(pdf.sizes.length === pdf.pages && pdf.sizes.every(isA4), `${label}: every page is A4`)
  const outside = pdf.words.filter(
    (w) => w.xMin < minX || w.yMin < MIN_Y || w.xMax > w.width - minX || w.yMax > w.height - MIN_Y,
  )
  const expectedLeft = (ats ? 16 : 18) * 72 / 25.4
  const actualLeft = Math.min(...pdf.words.map((word) => word.xMin))
  check(Math.abs(actualLeft - expectedLeft) < 1, `${label}: left edge confirms ${ats ? 16 : 18}mm margin (${actualLeft.toFixed(2)}pt)`)
  check(outside.length === 0, `${label}: all text inside ${ats ? '16mm' : '16mm/18mm'} margins on ${pdf.pages} pages${outside.length ? ` (${outside.length} words outside)` : ''}`)
  check(pdf.words.length > 100, `${label}: text is selectable (${pdf.words.length} words)`)
  check(pdf.fonts.length > 0 && pdf.fonts.every((font) => font.embedded), `${label}: all ${pdf.fonts.length} fonts embedded`)
}

const LEAKS = [
  'Save as PDF', 'Simpan sebagai PDF', 'Export JSON', 'Resume layout', 'Tata letak', 'fictional example', 'Disclaimer:', 'Penafian:',
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

  once(method: string, accept: (params: any) => boolean = () => true): Promise<any> {
    return new Promise((resolve) => {
      const listener = (message: any) => {
        if (message.method !== method || !accept(message.params)) return
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
  // A background headless tab is otherwise unfocused, and focus events would not behave as in a window.
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  return { cdp, stop: () => { cdp.close(); browser.kill() } }
}

const main = async () => {
  const server = process.argv[2] ? { url: process.argv[2], stop: () => {} } : await startServer()
  const chromium = await startChromium()
  const { cdp } = chromium
  // Counts live listeners on window and visualViewport, so a closed editor
  // that forgets to unsubscribe shows up as a leak.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const live = new Set(); const ids = new WeakMap(); let next = 0
      const id = (fn) => { if (!ids.has(fn)) ids.set(fn, ++next); return ids.get(fn) }
      const capture = (o) => typeof o === 'boolean' ? o : !!(o && o.capture)
      for (const target of [window, window.visualViewport].filter(Boolean)) {
        const name = target === window ? 'w' : 'v'
        const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target)
        target.addEventListener = (type, fn, o) => { if (fn) live.add(name + type + id(fn) + capture(o)); return add(type, fn, o) }
        target.removeEventListener = (type, fn, o) => { if (fn) live.delete(name + type + id(fn) + capture(o)); return remove(type, fn, o) }
      }
      window.__activeListeners = () => live.size
    })()`,
  })

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
  const screenshot = async (name: string) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(work, `${name}.png`), Buffer.from(data, 'base64'))
  }
  const presentation = () => evaluate(`document.querySelector('.resume-paper')?.dataset.presentation`)
  /** Document and app settings live in the nonmodal Settings panel, toggled from the toolbar. */
  const inSettings = async (label: string) => {
    await click('Settings')
    await click(label)
    await click('Settings')
  }
  /** Menu items are chosen by their accessible name, never by position. */
  const clickMenuItem = async (name: string) => {
    const found = await evaluate(`(() => { const e = [...document.querySelectorAll('[role="menuitem"]')].find((i) => i.textContent.trim() === ${JSON.stringify(name)}); if (!e) return false; e.click(); return true })()`)
    if (!found) throw new Error(`no menu item named "${name}"`)
    await settle()
  }
  const clickSelector = async (selector: string) => {
    const found = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; e.click(); return true })()`)
    if (!found) throw new Error(`nothing matches ${selector}`)
    await settle()
  }
  const KEYS: Record<string, { code: string; keyCode: number }> = {
    Enter: { code: 'Enter', keyCode: 13 },
    Escape: { code: 'Escape', keyCode: 27 },
  }
  const key = async (name: keyof typeof KEYS) => {
    const { code, keyCode } = KEYS[name]!
    for (const type of ['keyDown', 'keyUp'] as const) {
      // Enter carries text so it also performs a form's implicit submission, as a real key does.
      const text = type === 'keyDown' && name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}
      await cdp.send('Input.dispatchKeyEvent', { type, key: name, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, ...text })
    }
    await settle()
  }
  const typeText = async (text: string) => {
    await cdp.send('Input.insertText', { text })
    await settle()
  }
  const selectAll = () => evaluate(`document.activeElement?.select?.()`)
  const storedDoc = async () => JSON.parse(await evaluate(`localStorage.getItem(${JSON.stringify(DOCUMENT_KEY)})`))
  const samePdf = (left: PdfReport, right: PdfReport) =>
    left.pages === right.pages &&
    squash(left.normal) === squash(right.normal) &&
    squash(left.raw) === squash(right.raw) &&
    left.sizes.join() === right.sizes.join() &&
    left.words.length === right.words.length &&
    left.words.every((w, i) => Math.abs(w.xMin - right.words[i]!.xMin) < 0.5 && Math.abs(w.yMin - right.words[i]!.yMin) < 0.5)

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
    await inSettings('Resume layout: ATS')
    check((await presentation()) === 'ats', 'layout button selects ATS')
    const storedPrefs = JSON.parse(await evaluate(`localStorage.getItem(${JSON.stringify(PREFERENCES_KEY)})`))
    check(storedPrefs.themeKey === 'ats', 'ATS choice is saved')
    await screenshot('ats-desktop')
    const atsEn = await print('ats-en-desktop')
    check(atsEn.pages >= 2, `multipage (${atsEn.pages} pages)`)
    checkNormalSequence('normal text', atsEn.normal, atsSequence('en'))
    checkSequence('raw text', atsEn.raw, atsSequence('en'))
    checkGeometry('ATS', atsEn)
    check(atsEn.images === 0, `no images (${atsEn.images})`)
    checkClean('ATS', atsEn)

    console.log('\nATS, wrapped headings, long values, and font scaling')
    const long = structuredClone(fixture)
    for (const lang of ['en', 'id'] as const) {
      long.profile.text[lang].name = `${'Kurniawati Wulandari '.repeat(5)}PNAME`
      long.content.education[0]!.text[lang].school = `${'University of Distributed Systems '.repeat(4)}D1SCHOOL`
      long.content.projects[0]!.text[lang].role = `${'Principal Research Engineer '.repeat(4)}P1ROLE`
    }
    long.content.experience[0]!.company = `${'Perusahaan Nusantara '.repeat(6)}E1CO`
    for (const documentLocale of ['en', 'id'] as const) {
      for (const fontScale of ['xsmall', 'large']) {
        await seed(long, { ...prefs, themeKey: 'ats', documentLocale, fontScale })
        const wrapped = await evaluate(`(() => {
          const h = document.querySelector('.ats-entry-head');
          const title = h.querySelector('.item-title').getBoundingClientRect();
          const date = h.querySelector('.item-dates').getBoundingClientRect();
          return date.top >= title.bottom - 1 && date.height < 30;
        })()`)
        check(wrapped, `${documentLocale} ${fontScale}: complete date moves below long heading`)
        const pdf = await print(`ats-wrapped-${documentLocale}-${fontScale}`)
        const original = atsSequence(documentLocale)
        const expected = original.map((field) => {
          if (field === fixture.profile.text[documentLocale].name.toUpperCase()) return long.profile.text[documentLocale].name.toUpperCase()
          if (field === fixture.content.experience[0]!.company) return long.content.experience[0]!.company
          if (field === fixture.content.education[0]!.text[documentLocale].school) return long.content.education[0]!.text[documentLocale].school
          return field.replace(fixture.content.projects[0]!.text[documentLocale].role, long.content.projects[0]!.text[documentLocale].role)
        })
        checkNormalSequence('wrapped normal text', pdf.normal, expected)
        checkSequence('wrapped raw text', pdf.raw, expected)
        checkGeometry(`ATS wrapped ${documentLocale} ${fontScale}`, pdf)
      }
    }

    console.log('\nATS, missing contacts')
    const missing = structuredClone(fixture)
    for (const key of ['email', 'phone', 'website', 'github', 'linkedin'] as const) missing.contact[key] = ''
    await seed(missing, { ...prefs, themeKey: 'ats' })
    check(await evaluate(`!document.querySelector('.ats-contact')`), 'no empty contact line or pipes')
    const missingPreview = await print('ats-missing-contacts-preview')
    await click('Edit')
    const missingEdit = await print('ats-missing-contacts-edit')
    check(samePdf(missingPreview, missingEdit), 'missing-contact prompts do not affect PDF geometry or text')
    check(!missingEdit.normal.includes('Email:'), 'missing contacts stay absent in PDF')
    await seed(fixture, { ...prefs, themeKey: 'ats' })

    console.log('\nATS, reload keeps the choice')
    await load()
    check((await presentation()) === 'ats', 'ATS survives a reload')

    console.log('\nATS, page guides follow font size')
    const guides = () => evaluate(`[...document.querySelectorAll('.page-break')].map((e) => e.style.top).join(',')`)
    const before = await guides()
    await inSettings('Font size: large')
    const after = await guides()
    check(before !== '' && after !== '' && before !== after, `guides moved (${before} → ${after})`)
    await inSettings('Font size: medium')
    check((await guides()) === before, 'guides return with the font size')

    console.log('\nATS, phone preview and background graphics')
    await viewport(375, 812)
    await screenshot('ats-phone')
    const atsPhone = await print('ats-en-phone-bg', true)
    check(atsPhone.pages === atsEn.pages, `same page count from phone (${atsPhone.pages})`)
    check(squash(atsPhone.normal) === squash(atsEn.normal), 'same text from phone with backgrounds on')
    check(atsPhone.sizes.join() === atsEn.sizes.join(), 'same page geometry from phone')
    const wordsMatch = atsPhone.words.length === atsEn.words.length &&
      atsPhone.words.every((w, i) => Math.abs(w.xMin - atsEn.words[i]!.xMin) < 0.5 && Math.abs(w.yMin - atsEn.words[i]!.yMin) < 0.5)
    check(wordsMatch, 'same word positions from phone')
    await viewport(1440, 900)

    console.log('\nATS, Indonesian')
    await inSettings('Resume language: Indonesian')
    const atsId = await print('ats-id-desktop')
    checkNormalSequence('normal text', atsId.normal, atsSequence('id'))
    checkSequence('raw text', atsId.raw, atsSequence('id'))
    checkGeometry('ATS id', atsId)
    check(atsId.images === 0, 'no images')
    checkClean('ATS id', atsId)
    await viewport(375, 812)
    const atsIdPhone = await print('ats-id-phone-bg', true)
    check(atsIdPhone.pages === atsId.pages && squash(atsIdPhone.normal) === squash(atsId.normal), 'Indonesian matches from phone with backgrounds on')
    await viewport(1440, 900)
    await inSettings('Resume language: English')

    console.log('\nBack to Classic')
    await inSettings('Resume layout: Classic')
    check((await presentation()) === 'classic', 'layout button selects Classic')
    await Bun.sleep(1000)
    const finalDocument: string = await storedDocument()
    check(finalDocument === baseline, 'document unchanged by switching layouts and languages')
    check(JSON.parse(finalDocument).contact.avatar === PIXEL, 'photo kept in storage')
    const classic = await print('classic-en-desktop')
    check(classic.images >= 1, `photo is back (${classic.images} image)`)
    check(!squash(classic.normal).includes('WorkExperience') && /EXPERIENCE/.test(classic.normal), 'Classic headings restored')
    checkGeometry('Classic', classic, false)
    checkClean('Classic', classic)

    console.log('\nATS with a remote photo')
    await seed({ ...fixture, contact: { ...contact, avatar: 'https://photos.invalid/portrait.jpg' } }, { ...prefs, themeKey: 'ats' })
    const remote = await print('ats-remote-photo')
    check(remote.images === 0, 'no image')
    checkClean('ATS remote photo', remote)
    check(!(await evaluate(`document.querySelector('.resume-paper').textContent.includes('photos.invalid')`)), 'no consent prompt in the paper')

    console.log('\nPreview and Edit print the same document')
    for (const themeKey of ['minimal', 'ats']) {
      for (const documentLocale of ['en', 'id']) {
        await seed(fixture, { ...prefs, themeKey, documentLocale })
        const preview = await print(`${themeKey}-${documentLocale}-preview`)
        await click('Edit')
        // Select an entry so its actions and the blank-field prompts are on screen.
        await clickSelector('[data-entry="experience:exp_2"]')
        const editingCount = await evaluate(`document.querySelectorAll('.edit-prompt, .entry-actions, .add-entry').length`)
        const edit = await print(`${themeKey}-${documentLocale}-edit`)
        check(editingCount > 3 && samePdf(preview, edit), `${themeKey} ${documentLocale}: identical text, reading order, pages and word positions (${edit.pages} pages, ${editingCount} edit controls on screen)`)
        checkClean(`${themeKey} ${documentLocale} edit`, edit)
        check(!/\+ (Team|Location|Add entry)|Edit entry|No entries yet/.test(edit.normal), `${themeKey} ${documentLocale}: no prompts or entry actions in the PDF`)
        await click('Done')
      }
    }

    console.log('\nEditing through the interface')
    await seed(fixture, prefs)
    const listeners = () => evaluate(`window.__activeListeners?.()`)
    const frames = () => evaluate(`new Promise((done) => { let n = 0; const raf = window.requestAnimationFrame; window.requestAnimationFrame = (cb) => { n += 1; return raf(cb) }; setTimeout(() => { window.requestAnimationFrame = raf; done(n) }, 1000) })`)
    const idleListeners = await listeners()
    check((await frames()) === 0, 'no idle frame work in Preview')
    await click('Edit')
    check((await frames()) === 0, 'no idle frame work in Edit mode')

    await clickSelector('[data-edit-key="profile.headline"]')
    const inlineOutside = await evaluate(`(() => { const i = document.querySelector('.inline-editor input'); return !!i && document.activeElement === i && !document.querySelector('.resume-paper').contains(i) && parseFloat(getComputedStyle(i).fontSize) >= 16 })()`)
    check(inlineOutside, 'inline editor opens outside the paper with 16px text')
    await selectAll()
    await typeText('Principal Engineer EDITED')
    await key('Escape')
    check((await storedDoc()).profile.text.en.headline === fixture.profile.text.en.headline, 'Escape leaves the headline unchanged')

    await clickSelector('[data-edit-key="profile.headline"]')
    await selectAll()
    await typeText('Principal Engineer PHEADEDIT')
    await key('Enter')
    await Bun.sleep(900)
    check((await storedDoc()).profile.text.en.headline === 'Principal Engineer PHEADEDIT', 'Enter applies and autosaves the headline')

    await clickSelector('[data-add-entry="awards"]')
    await typeText('Community Prize A3TITLE')
    await key('Enter')
    await Bun.sleep(900)
    const awards = (await storedDoc()).content.awards
    check(awards.length === 3 && awards[2].text.en.title === 'Community Prize A3TITLE', 'a staged award is added on Apply')

    // An open draft must reach the PDF and the JSON export too.
    await clickSelector('[data-edit-key="profile.name"]')
    await selectAll()
    await typeText('Kurniawati Wulandari PNAMEDRAFT')
    const draftPdf = await print('draft-open')
    check(squash(draftPdf.normal).includes('PNAMEDRAFT'), 'native printing applies the open draft first')
    checkClean('draft PDF', draftPdf)

    await clickSelector('[data-edit-key="contact.email"]')
    await selectAll()
    await typeText('json.export.ctmail@example.com')
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: work, eventsEnabled: true }, '')
    const downloaded = cdp.once('Browser.downloadProgress', (params) => params.state !== 'inProgress')
    await click('Export')
    await clickMenuItem('Export JSON')
    const progress = await Promise.race([downloaded, Bun.sleep(10_000).then(() => ({ state: 'timeout' }))])
    check(progress.state === 'completed', `JSON export downloads (${progress.state})`)
    const exported = JSON.parse(await Bun.file(join(work, (await Array.fromAsync(new Bun.Glob('*.json').scan(work)))[0]!)).text())
    check(exported.contact.email === 'json.export.ctmail@example.com', 'JSON export applies the open draft first')

    await click('Done')
    check((await listeners()) === idleListeners, `no listeners left after closing editors (${await listeners()} active, ${idleListeners} at rest)`)
    check((await frames()) === 0, 'no idle frame work after editing')

    await Bun.sleep(900)
    await load()
    const reloaded = await storedDoc()
    check(
      reloaded.profile.text.en.headline === 'Principal Engineer PHEADEDIT' &&
        reloaded.profile.text.en.name === 'Kurniawati Wulandari PNAMEDRAFT' &&
        reloaded.contact.email === 'json.export.ctmail@example.com' &&
        reloaded.content.awards.length === 3,
      'edits survive a reload',
    )
    check(squash(await evaluate(`document.querySelector('.resume-paper').textContent`)).includes('PHEADEDIT'), 'reloaded paper shows the edits')

    console.log('\nPhone sheet with an open keyboard')
    await seed(fixture, prefs)
    await viewport(375, 812)
    await click('Edit')
    await clickSelector('[data-edit-key="profile.headline"]')
    // A software keyboard shrinks the visual viewport; emulate it by shrinking the window.
    await viewport(375, 420)
    const sheet = await evaluate(`(() => {
      const sheet = document.querySelector('.edit-sheet'); if (!sheet) return null
      const apply = [...sheet.querySelectorAll('button')].find((b) => b.type === 'submit')
      const r = apply.getBoundingClientRect(); const input = sheet.querySelector('input')
      return { visible: r.bottom <= innerHeight && r.top >= 0, size: Math.min(r.width, r.height), font: parseFloat(getComputedStyle(input).fontSize), scale: getComputedStyle(sheet).zoom }
    })()`)
    check(!!sheet && sheet.visible && sheet.size >= 44 && sheet.font >= 16, `sheet actions stay visible above the keyboard (${JSON.stringify(sheet)})`)
    const [sheetScroll, sheetClient] = await evaluate(`[document.documentElement.scrollWidth, document.documentElement.clientWidth]`)
    check(sheetScroll <= sheetClient + 1, `no overflow with the sheet open (${sheetScroll} <= ${sheetClient} + 1)`)
    await key('Escape')
    await viewport(1440, 900)

    console.log('\nSide panels')
    const panelState = () => evaluate(`({ sections: !!document.getElementById('sections-panel'), settings: !!document.getElementById('settings-panel') })`)
    const overflow = async () => {
      const [scroll, client] = await evaluate(`[document.documentElement.scrollWidth, document.documentElement.clientWidth]`)
      return { ok: scroll <= client + 1, scroll, client }
    }
    const smallPanelTargets = () => evaluate(`[...document.querySelectorAll('.app-actions button, .side-panel button, .side-panel .drag-handle')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 43.5 || r.height < 43.5) }).map((b) => b.getAttribute('aria-label') || b.textContent.trim())`)
    for (const [width, height] of [[320, 640], [375, 812], [768, 1024], [1024, 768], [1440, 900]] as const) {
      await seed(fixture, prefs)
      await viewport(width, height)
      check(JSON.stringify(await panelState()) === '{"sections":false,"settings":false}', `${width}px: both panels start closed`)
      await click('Sections')
      check(await evaluate(`document.activeElement?.id === 'sections-panel-title'`), `${width}px: opening Sections focuses its heading`)
      await click('Settings')
      const both = await panelState()
      const wide = width >= 1024
      check(both.settings && both.sections === wide, `${width}px: ${wide ? 'both panels open side by side' : 'Settings replaces Sections'} (${JSON.stringify(both)})`)
      if (wide) {
        const columns = await evaluate(`(() => { const s = document.getElementById('sections-panel').getBoundingClientRect(), p = document.querySelector('.resume-paper').getBoundingClientRect(), g = document.getElementById('settings-panel').getBoundingClientRect(); return s.right <= p.left + 1 && p.right <= g.left + 1 })()`)
        check(columns, `${width}px: Sections, CV and Settings sit in three columns`)
      } else {
        const above = await evaluate(`document.getElementById('settings-panel').getBoundingClientRect().bottom <= document.querySelector('.resume-paper').getBoundingClientRect().top + 1`)
        check(above, `${width}px: the panel sits above the CV`)
      }
      const flow = await overflow()
      check(flow.ok, `${width}px panels open: scrollWidth ${flow.scroll} <= clientWidth ${flow.client} + 1`)
      const small = await smallPanelTargets()
      check(small.length === 0, `${width}px: every toolbar and panel target is at least 44px${small.length ? ` (${small.join(', ')})` : ''}`)
      await key('Escape')
      check(!(await panelState()).settings && (await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Settings'`)), `${width}px: Escape closes the focused panel and returns focus to its toggle`)
    }

    console.log('\nSide panels across the breakpoint')
    await seed(fixture, prefs)
    await viewport(1440, 900)
    await click('Settings')
    await click('Sections')
    await viewport(768, 1024)
    check(JSON.stringify(await panelState()) === '{"sections":true,"settings":false}', 'narrowing keeps the most recently opened panel')
    await viewport(1440, 900)

    console.log('\nSection navigation')
    const scrollY = () => evaluate(`Math.round(window.scrollY)`)
    const short = structuredClone(fixture)
    short.content.experience = short.content.experience.slice(0, 1)
    for (const kind of ['education', 'projects', 'skills', 'awards'] as const) (short.content as Record<string, unknown[]>)[kind] = []
    await seed(short, prefs)
    await click('Sections')
    await evaluate(`window.scrollTo(0, 0)`)
    await click('Go to Experience')
    check((await scrollY()) === 0, 'short CV: a visible heading does not move the page')
    check(await evaluate(`document.querySelector('[aria-label="Go to Awards"]')?.disabled === true`), 'short CV: an empty section is not navigable in Preview')
    await seed(fixture, prefs)
    await click('Sections')
    await evaluate(`window.scrollTo(0, 0)`)
    // A real click focuses the button; element.click() alone would not.
    await evaluate(`document.querySelector('[aria-label="Go to Awards"]').focus()`)
    await click('Go to Awards')
    const reached = await evaluate(`(() => { const r = document.querySelector('[data-cv-section="awards"] h2').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })()`)
    check(reached && (await scrollY()) > 0, `long CV: navigation brings a later heading into view (scrollY ${await scrollY()})`)
    check(await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Go to Awards'`), 'navigation keeps focus on its button')
    // scrollY can read a pixel off after an instant scroll with no further scrolling, so count real scrolls.
    await evaluate(`(() => { window.__moves = 0; const o = Element.prototype.scrollIntoView; Element.prototype.scrollIntoView = function (...a) { window.__moves++; return o.apply(this, a) }; addEventListener('scroll', () => window.__moves++) })()`)
    await click('Go to Awards')
    check((await evaluate(`window.__moves`)) === 0, 'navigating again to a visible heading does not move the page')

    console.log('\nPanels never reach the PDF')
    await viewport(1440, 900)
    for (const themeKey of ['minimal', 'ats']) {
      for (const documentLocale of ['en', 'id']) {
        for (const mode of ['preview', 'edit']) {
          await seed(fixture, { ...prefs, themeKey, documentLocale })
          if (mode === 'edit') await click('Edit')
          const closed = await print(`${themeKey}-${documentLocale}-${mode}-panels-closed`)
          await click('Sections')
          await click('Settings')
          const open = await print(`${themeKey}-${documentLocale}-${mode}-panels-open`)
          check(samePdf(closed, open), `${themeKey} ${documentLocale} ${mode}: panels open print identical text, order, pages and word positions (${open.pages} pages)`)
          checkClean(`${themeKey} ${documentLocale} ${mode} panels open`, open)
          check(!/Go to |Hidden from the resume|Disembunyikan dari resume/.test(open.normal), `${themeKey} ${documentLocale} ${mode}: no panel text in the PDF`)
        }
      }
    }

    console.log('\nNo horizontal overflow')
    for (const themeKey of ['minimal', 'ats']) {
      await seed(fixture, { ...prefs, themeKey })
      for (const [width, height] of [[320, 640], [375, 812], [768, 1024], [1440, 900], [812, 375]] as const) {
        await viewport(width, height)
        const [scroll, client] = await evaluate(`[document.documentElement.scrollWidth, document.documentElement.clientWidth]`)
        check(scroll <= client + 1, `${themeKey} at ${width}x${height}: scrollWidth ${scroll} <= clientWidth ${client} + 1`)
      }
      await click('Edit')
      await clickSelector('[data-entry="experience:exp_1"]')
      for (const [width, height] of [[320, 640], [375, 812], [768, 1024], [1440, 900], [812, 375]] as const) {
        await viewport(width, height)
        const [scroll, client] = await evaluate(`[document.documentElement.scrollWidth, document.documentElement.clientWidth]`)
        const small = await evaluate(`[...document.querySelectorAll('.app-actions button, .entry-actions button, .add-entry')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 43.5 || r.height < 43.5) }).length`)
        check(scroll <= client + 1 && small === 0, `${themeKey} editing at ${width}x${height}: scrollWidth ${scroll} <= ${client} + 1, ${small} targets under 44px`)
      }
      await click('Done')
    }
  } finally {
    chromium.stop()
    server.stop()
  }

  if (failures) {
    console.log(`\nverify:ats: ${failures} check(s) failed. PDFs kept in ${work}`)
    process.exit(1)
  }
  if (process.env.KEEP_ATS_ARTIFACTS) console.log(`Artifacts kept in ${work}`)
  else rmSync(work, { recursive: true, force: true })
  console.log('\nverify:ats: OK')
}

main().catch((error) => {
  console.error(error)
  console.error(`PDFs kept in ${work}`)
  process.exit(1)
})
