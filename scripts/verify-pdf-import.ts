#!/usr/bin/env bun
/**
 * Drives the PDF import in headless Chromium against a running deployment.
 * jsdom cannot check layout, real uploads or the real extractor, so this is
 * the browser-level check for widths, keyboard use, long source text,
 * cancellation, replacement and an unavailable backend.
 *
 * Usage:
 *   bun scripts/verify-pdf-import.ts URL                 combined deployment, backend up
 *   bun scripts/verify-pdf-import.ts URL --backend-down  combined deployment, backend stopped
 *   bun scripts/verify-pdf-import.ts URL --static        static-only build: no PDF option
 * Needs chromium. Uses a throwaway profile; screenshots go to a temp directory.
 */
import { mkdtempSync, copyFileSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const PDF = (name: string) => join(ROOT, 'services/pdf-import/tests/fixtures/pdf', `${name}.pdf`)
const work = mkdtempSync(join(tmpdir(), 'verify-pdf-import-'))
const url = process.argv[2]
const mode = process.argv[3] ?? '--up'
if (!url) {
  console.error('usage: bun scripts/verify-pdf-import.ts URL [--backend-down|--static]')
  process.exit(2)
}

let failures = 0
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

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
        if (message.error) handlers.reject(new Error(message.error.message))
        else handlers.resolve(message.result)
      } else for (const listener of this.listeners) listener(message)
    })
  }

  static async connect(target: string) {
    const socket = new WebSocket(target)
    await new Promise((ok, fail) => {
      socket.addEventListener('open', ok, { once: true })
      socket.addEventListener('error', fail, { once: true })
    })
    return new Cdp(socket)
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.id
    this.socket.send(JSON.stringify({ id, method, params, ...(this.sessionId ? { sessionId: this.sessionId } : {}) }))
    return new Promise((ok, fail) => this.pending.set(id, { resolve: ok, reject: fail }))
  }

  once(method: string): Promise<any> {
    return new Promise((ok) => {
      const listener = (message: any) => {
        if (message.method !== method) return
        this.listeners = this.listeners.filter((other) => other !== listener)
        ok(message.params)
      }
      this.listeners.push(listener)
    })
  }

  close() {
    this.socket.close()
  }
}

const browser = Bun.spawn(
  ['chromium', '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${join(work, 'profile')}`, 'about:blank'],
  { stdout: 'ignore', stderr: 'pipe' },
)
const reader = browser.stderr.getReader()
let log = ''
while (!/DevTools listening on (ws:\/\/\S+)/.test(log)) {
  const { value, done } = await reader.read()
  if (done) throw new Error(`Chromium exited early:\n${log}`)
  log += new TextDecoder().decode(value)
}
reader.releaseLock()
const cdp = await Cdp.connect(/DevTools listening on (ws:\/\/\S+)/.exec(log)![1]!)
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
cdp.sessionId = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).sessionId
await cdp.send('Page.enable')
await cdp.send('Runtime.enable')
await cdp.send('DOM.enable')
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })

const evaluate = async (expression: string) => {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
  if (exceptionDetails) throw new Error(`${expression}: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`)
  return result.value
}
const settle = () => evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 100))))`)
const waitFor = async (expression: string, label: string, ms = 90_000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await evaluate(expression)) return true
    await Bun.sleep(250)
  }
  check(false, `timed out waiting for ${label}`)
  return false
}
const load = async () => {
  const loaded = cdp.once('Page.loadEventFired')
  await cdp.send('Page.navigate', { url })
  await loaded
  await evaluate('localStorage.clear()')
  const again = cdp.once('Page.loadEventFired')
  await cdp.send('Page.reload')
  await again
  await settle()
}
const viewport = async (width: number, height: number) => {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 800 })
  await settle()
}
const screenshot = async (name: string) => {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(work, `${name}.png`), Buffer.from(data, 'base64'))
}
const clickButton = async (name: string) => {
  const found = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((el) => (el.getAttribute('aria-label') ?? el.textContent.trim()) === ${JSON.stringify(name)})
    if (!b || b.disabled) return false
    b.click(); return true
  })()`)
  if (!found) throw new Error(`no enabled button named "${name}"`)
  await settle()
}
const key = async (keyName: string, code = keyName) => {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: keyName === 'Escape' ? 27 : keyName === 'Tab' ? 9 : 0 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code })
  await settle()
}
const chooseFile = async (path: string) => {
  await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true })
  const chooser = cdp.once('Page.fileChooserOpened')
  await evaluate(`document.querySelector('.file-picker button').click()`)
  const { backendNodeId, mode } = await chooser
  check(mode === 'selectSingle', 'native picker requests exactly one file')
  await cdp.send('DOM.setFileInputFiles', { backendNodeId, files: [path] })
  await cdp.send('Page.setInterceptFileChooserDialog', { enabled: false })
  await settle()
}
const choosePdf = async (name: string) => chooseFile(PDF(name))
let locale: 'en' | 'id' = 'en'
const openImport = async (_label: string, format: 'pdf' | 'json' = 'pdf') => {
  await clickButton(locale === 'en' ? 'Upload' : 'Unggah')
  await clickButton(locale === 'en' ? `Upload ${format.toUpperCase()}` : `Unggah ${format.toUpperCase()}`)
  await waitFor(`!!document.querySelector('[role=dialog]')`, 'import dialog')
}
/** Layout checks shared by every width. */
const layout = async (label: string, width: number) => {
  const report = await evaluate(`(() => {
    const dialog = document.querySelector('[role=dialog]').getBoundingClientRect()
    const small = [...document.querySelectorAll('[role=dialog] button, [role=dialog] summary, [role=dialog] select, [role=dialog] input:not([type=checkbox])')]
      .filter((el) => el.offsetParent !== null && el.getClientRects().length && !el.classList.contains('file-picker-input'))
      .filter((el) => el.getBoundingClientRect().height < 43.5)
      .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40) + ' ' + el.getBoundingClientRect().height.toFixed(3) + 'px')
    return { left: dialog.left, right: dialog.right, scroll: document.documentElement.scrollWidth, inner: innerWidth, small }
  })()`)
  check(report.left >= -0.5 && report.right <= width + 0.5, `${label}: dialog fits ${width}px (${Math.round(report.left)}–${Math.round(report.right)})`)
  check(report.scroll <= report.inner, `${label}: no horizontal page scroll`)
  check(report.small.length === 0, `${label}: every control is at least 44px tall${report.small.length ? ` (${report.small.join(', ')})` : ''}`)
}

const IMPORT_LABEL = mode === '--static' ? 'Import JSON' : 'Import resume'

try {
  if (mode === '--static') {
    await viewport(1440, 900)
    await load()
    await openImport(IMPORT_LABEL, 'json')
    check(!(await evaluate(`!!document.querySelector('input[type=file][accept*="pdf"]')`)), 'static build: no PDF option')
    check(await evaluate(`!!document.querySelector('input[type=file][accept*=json]')`), 'static build: JSON file import still offered')
    const api = await evaluate(`fetch('/api/pdf-import/health').then((r) => r.headers.get('content-type') ?? '')`)
    check(!String(api).includes('json'), 'static build: no PDF service behind the site')
  } else if (mode === '--backend-down') {
    await viewport(375, 812)
    await load()
    check(await evaluate(`!!document.querySelector('.resume-paper')`), 'backend down: the resume still renders')
    await openImport(IMPORT_LABEL)
    await choosePdf('en_single')
    await clickButton('Convert PDF')
    await waitFor(`!!document.querySelector('[role=alert]')`, 'unavailable alert', 20_000)
    const alert = await evaluate(`document.querySelector('[role=alert]').textContent`)
    check(/unavailable/i.test(alert), `backend down: retryable message shown ("${alert.trim()}")`)
    check(await evaluate(`!document.querySelector('input[type=file][accept*=json]')`), 'backend down: PDF dialog stays format-specific')
    check(await evaluate(`![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Convert PDF').disabled`), 'backend down: Convert PDF can be retried')
    await screenshot('backend-down-375')
  } else {
    for (const language of ['en', 'id'] as const) for (const scheme of ['light', 'dark']) {
      locale = language
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
      for (const [width, height] of [[320, 640], [375, 812], [768, 1024], [1440, 900]] as const) {
        await viewport(width, height)
        await load()
        await evaluate(`localStorage.setItem('resume-preferences-v1', JSON.stringify({uiLocale:${JSON.stringify(language)}, documentLocale:'en', themeKey:'minimal', fontScale:'standard', introDismissed:true}))`)
        const loaded = cdp.once('Page.loadEventFired'); await cdp.send('Page.reload'); await loaded; await settle()
        const label = `${width}px ${language} ${scheme}`
        await clickButton(language === 'en' ? 'Upload' : 'Unggah')
        check(await evaluate(`document.activeElement?.getAttribute('role') === 'menuitem'`), `${label}: menu focuses first format`)
        await key('Escape')
        check(await evaluate(`document.activeElement?.getAttribute('aria-label') === ${JSON.stringify(language === 'en' ? 'Upload' : 'Unggah')}`), `${label}: Escape restores Upload focus`)
        await openImport(IMPORT_LABEL)
        await layout(`${label} PDF picker`, width)
        check(await evaluate(`!document.querySelector('textarea') && !document.querySelector('input[accept*=json]')`), `${label}: PDF format isolation`)
        await evaluate(`window.__pdfPosts = 0; window.__originalFetch = window.fetch; window.fetch = (...args) => {if(String(args[0]).includes('/jobs') && args[1]?.method === 'POST') window.__pdfPosts++; return window.__originalFetch(...args)}`)
        const longName = `synthetic-${'long-filename-'.repeat(16)}.pdf`
        const selected = join(work, longName)
        copyFileSync(PDF('en_single'), selected)
        await chooseFile(selected)
        await layout(`${label} long filename`, width)
        check(await evaluate(`window.__pdfPosts === 0`), `${label}: selection alone never uploads`)
        await screenshot(`picker-${width}-${language}-${scheme}`)
        await clickButton(language === 'en' ? 'Remove file' : 'Hapus berkas')
        const drop = async (files: string) => {
          await evaluate(`(() => {const dataTransfer = new DataTransfer(); ${files}; document.querySelector('.file-picker').dispatchEvent(new DragEvent('drop', {bubbles:true, dataTransfer}))})()`); await settle()
        }
        await drop(`dataTransfer.items.add(new File(['wrong'], 'wrong.json', {type:'application/json'}))`)
        check(await evaluate(`!!document.querySelector('.file-picker [role=alert]')`), `${label}: wrong format drop rejected`)
        await drop(`dataTransfer.items.add(new File(['a'], 'a.pdf', {type:'application/pdf'})); dataTransfer.items.add(new File(['b'], 'b.pdf', {type:'application/pdf'}))`)
        check(await evaluate(`!!document.querySelector('.file-picker [role=alert]')`), `${label}: multiple-file drop rejected`)
        await drop(`dataTransfer.items.add(new File(['%PDF-1.4'], 'drop.pdf', {type:'application/pdf'}))`)
        check(await evaluate(`document.querySelector('.file-picker-name')?.textContent === 'drop.pdf' && window.__pdfPosts === 0`), `${label}: valid single drop selects without upload`)
        await clickButton(language === 'en' ? 'Close' : 'Tutup')
        await openImport(IMPORT_LABEL, 'json')
        check(await evaluate(`!document.querySelector('input[accept*=pdf]') && !!document.querySelector('input[accept*=json]') && !document.querySelector('details').open`), `${label}: JSON file first and format isolation`)
        await evaluate(`document.querySelector('details').open = true`); await settle()
        await layout(`${label} JSON alternate methods`, width)
        check(await evaluate(`!!document.querySelector('textarea') && !!document.querySelector('input[type=url]')`), `${label}: paste and URL remain available`)
        await clickButton(language === 'en' ? 'Close' : 'Tutup')
      }
    }
    locale = 'en'
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
    await viewport(375, 812)
    await load()
    await waitFor(`!!localStorage.getItem('resume-document-v1')`, 'initial local document save', 5000)
    const jsonDocument = await evaluate(`localStorage.getItem('resume-document-v1')`)
    const jsonPath = join(work, 'synthetic-resume.json')
    writeFileSync(jsonPath, jsonDocument)
    for (const method of ['file', 'paste', 'url']) {
      await openImport(IMPORT_LABEL, 'json')
      if (method === 'file') {
        await chooseFile(jsonPath)
      } else {
        await evaluate(`document.querySelector('details').open = true`); await settle()
        const selector = method === 'paste' ? 'textarea' : 'input[type=url]'
        const value = method === 'paste' ? jsonDocument : 'https://resume-verification.invalid/resume.json'
        await evaluate(`(() => {const input = document.querySelector(${JSON.stringify(selector)}); input.value=${JSON.stringify(value)}; input.dispatchEvent(new Event('input', {bubbles:true}))})()`)
        await settle()
        if (method === 'url') {
          await cdp.send('Fetch.enable', {patterns:[{urlPattern:'https://resume-verification.invalid/*'}]})
          const response = cdp.once('Fetch.requestPaused').then(({requestId}) => cdp.send('Fetch.fulfillRequest', {requestId, responseCode:200, responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}], body:Buffer.from(jsonDocument).toString('base64')}))
          await clickButton('Load'); await response; await cdp.send('Fetch.disable')
        } else await clickButton('Review pasted JSON')
      }
      if (await waitFor(`document.querySelector('[role=dialog] h2')?.textContent.trim() === 'Review import'`, `JSON ${method} review`, 10000)) {
        check(true, `JSON ${method}: existing review reached`)
        await clickButton('Back')
        if (method === 'file') check(await evaluate(`document.querySelector('.file-picker-name')?.textContent === 'synthetic-resume.json'`), 'JSON file: Back retains selected file')
      } else console.log(`      dialog alert: ${await evaluate(`document.querySelector('[role=dialog] [role=alert]')?.textContent?.trim() ?? '(none)'`)}`)
      await clickButton('Close')
    }
    for (const [width, height] of [[320, 640], [375, 812], [768, 1024], [1440, 900]] as const) {
      await viewport(width, height)
      await load()
      const appearance = await evaluate(`({
        preferences: localStorage.getItem('resume-preferences-v1'),
        avatar: document.querySelector('img.resume-avatar')?.getAttribute('src')
      })`)
      await openImport(IMPORT_LABEL)
      await layout(`${width}px sources`, width)
      await evaluate(`window.__progress = []; window.__originalFetch = window.fetch; window.fetch = async (...args) => { const response = await window.__originalFetch(...args); if(String(args[0]).includes('?progress=1')) { const job = await response.clone().json(); if(job.progress) window.__progress.push(job.progress); } return response }`)
      await choosePdf(width === 375 ? 'five_page' : 'en_single')
      await clickButton('Convert PDF')
      check(await evaluate(`!!document.querySelector('progress') && document.querySelector('progress').max === 100`), `${width}px: native progress exposed while converting`)
      const started = Date.now()
      if (!(await waitFor(`document.querySelector('[role=dialog] h2')?.textContent.trim() === 'Review PDF import'`, `${width}px review`))) continue
      const observations = await evaluate(`window.__progress`)
      check(observations.length > 0 && observations.every((p: any, i: number) => p.percent >= (observations[i-1]?.percent ?? 0)), `${width}px: measured progress polls received without regression`)
      check(await evaluate(`document.querySelector('[role=dialog] [role=status]')?.textContent.includes('100%')`), `${width}px: review announces 100% completion`)
      console.log(`      conversion took ${((Date.now() - started) / 1000).toFixed(1)} s`)
      check(await evaluate(`document.activeElement?.tagName === 'H2'`), `${width}px: focus moves to the review heading`)
      await layout(`${width}px review`, width)
      if (width === 375) {
        await evaluate(`document.querySelector('.pdf-all-text').open = true`)
        await settle()
        const list = await evaluate(`(() => { const l = document.querySelector('.pdf-all-text .pdf-text-list'); return { scroll: l.scrollHeight, client: l.clientHeight, items: l.children.length } })()`)
        check(list.items === 82 && list.scroll > list.client, `375px: long source text scrolls inside its list (${list.items} blocks)`)
        await layout('375px long source text', width)
        check(await evaluate(`document.querySelectorAll('.pdf-entry').length`) === 15, '375px: five-page CV maps 15 experience entries')
      } else {
        check(await evaluate(`[...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Name')?.control?.value`) === 'Jane Doe', `${width}px: proposed name is Jane Doe`)
      }
      await screenshot(`review-${width}`)

      if (width === 1440) {
        // Keyboard: from the heading, Tab reaches Close, then the review's first control; Escape dismisses.
        await key('Tab')
        check(await evaluate(`document.activeElement?.textContent.trim() === 'Close'`), '1440px: Tab from the heading reaches Close')
        await key('Tab')
        check(await evaluate(`document.activeElement?.tagName === 'SELECT'`), '1440px: next Tab reaches the language select')
        await key('Escape')
        check(await evaluate(`!!document.querySelector('[role=dialog]')`), '1440px: Escape does not discard the review')
        await clickButton('Cancel')
        check(await evaluate(`!document.querySelector('[role=dialog]')`), '1440px: Cancel dismisses the review')
        check(await evaluate(`!document.querySelector('.resume-paper')?.textContent.includes('Jane Doe')`), '1440px: dismissing leaves the resume unchanged')

        // Replacement.
        await openImport(IMPORT_LABEL)
        await choosePdf('en_single')
        await clickButton('Convert PDF')
        await waitFor(`document.querySelector('[role=dialog] h2')?.textContent.trim() === 'Review PDF import'`, 'review for replacement')
        await clickButton('Replace resume')
        check(await evaluate(`!document.querySelector('[role=dialog]')`), '1440px: Replace resume closes the dialog')
        check(await evaluate(`document.querySelector('.resume-paper')?.textContent.includes('Jane Doe') ?? false`), '1440px: the paper shows the imported resume')
        check(await evaluate(`JSON.parse(localStorage.getItem('resume-document-v1')).profile.text.en.name`) === 'Jane Doe', '1440px: the imported resume is saved in the browser')
        const importedAppearance = await evaluate(`({
          preferences: localStorage.getItem('resume-preferences-v1'),
          avatar: document.querySelector('img.resume-avatar')?.getAttribute('src'),
          classic: !!document.querySelector('.resume-header') && !document.querySelector('.ats-header')
        })`)
        check(!!appearance.avatar && importedAppearance.avatar === appearance.avatar, '1440px: PDF replacement keeps the existing photo visible')
        check(importedAppearance.classic && importedAppearance.preferences === appearance.preferences, '1440px: PDF replacement preserves Classic, header layout and preferences')

        const reloaded = cdp.once('Page.loadEventFired')
        await cdp.send('Page.reload')
        await reloaded
        await settle()
        check(await evaluate(`!!document.querySelector('.resume-header') && !document.querySelector('.ats-header') && document.querySelector('img.resume-avatar')?.getAttribute('src') === ${JSON.stringify(appearance.avatar)}`), '1440px: Classic header and photo survive a browser reload')

        // Cancellation while converting.
        await openImport(IMPORT_LABEL)
        await choosePdf('five_page')
        await clickButton('Convert PDF')
        await waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Cancel conversion')`, 'cancel button', 10_000)
        await Bun.sleep(1500)
        await clickButton('Cancel conversion')
        const cancelled = await waitFor(`document.querySelector('[role=dialog] [role=status]')?.textContent.includes('Conversion cancelled.') ?? false`, 'cancelled status', 10_000)
        check(cancelled, '1440px: cancelling reports "Conversion cancelled."')
        const freed = await waitFor(`fetch('/api/pdf-import/health').then((r) => r.json()).then((h) => h.busy === false)`, 'slot release', 15_000)
        check(freed, '1440px: the server slot is free after cancelling')
      } else {
        await clickButton('Cancel')
      }
    }

    await viewport(1440, 900)
    await load()
    await openImport(IMPORT_LABEL)
    await choosePdf('progression')
    await clickButton('Convert PDF')
    if (await waitFor(`document.querySelector('[role=dialog] h2')?.textContent.trim() === 'Review PDF import'`, 'progression review')) {
      const counts = await evaluate(`(() => {
        const names = [...document.querySelectorAll('.pdf-entry legend')].map(el => el.textContent.trim())
        return ['Experience', 'Projects', 'Education', 'Skills', 'Awards'].map(kind => names.filter(name => name.startsWith(kind + ' entry ')).length)
      })()`)
      check(JSON.stringify(counts) === JSON.stringify([4, 5, 2, 7, 1]), 'progression: four roles, five projects, two schools, seven skill groups and one award')
      await clickButton('Replace resume')
      check(await evaluate(`document.querySelector('[role=alert]')?.textContent.includes('unplaced text') ?? false`), 'progression: unplaced text still requires acknowledgment')
      await evaluate(`document.querySelector('.pdf-acknowledge input').click()`)
      await clickButton('Replace resume')
      const saved = await evaluate(`(() => {
        const doc = JSON.parse(localStorage.getItem('resume-document-v1'))
        return { dates: doc.content.experience.map(item => item.dates.start), bullets: doc.content.experience.map(item => item.text.en.bullets.length), company: doc.content.experience[3].company }
      })()`)
      check(JSON.stringify(saved.dates) === JSON.stringify(['2022-01', '2018-03', '2018-03', '2022-02']) && JSON.stringify(saved.bullets) === JSON.stringify([5, 4, 2, 2]) && saved.company === '', 'progression: confirmed draft retains role dates, page continuation and independent instructor')

      for (const themeKey of ['minimal', 'ats']) {
        await evaluate(`(() => {
          const preferences = JSON.parse(localStorage.getItem('resume-preferences-v1') ?? '{}')
          localStorage.setItem('resume-preferences-v1', JSON.stringify({ ...preferences, themeKey: ${JSON.stringify(themeKey)} }))
        })()`)
        const loaded = cdp.once('Page.loadEventFired')
        await cdp.send('Page.reload')
        await loaded
        await settle()
        const { data } = await cdp.send('Page.printToPDF', { preferCSSPageSize: true, displayHeaderFooter: false })
        const path = join(work, `progression-${themeKey}.pdf`)
        writeFileSync(path, Buffer.from(data, 'base64'))
        const extracted = Bun.spawnSync(['pdftotext', path, '-'])
        const text = new TextDecoder().decode(extracted.stdout)
        check(extracted.exitCode === 0 && text.includes('MAYA NUSANTARA') && text.includes('Coordinated delivery with public-sector stakeholders.') && text.includes('Certificate System'), `progression ${themeKey}: imported text survives PDF export`)
        check(!/Review PDF import|All extracted text|Text not placed/.test(text), `progression ${themeKey}: review controls stay out of print`)
      }
    }
  }
} catch (error) {
  check(false, String(error))
} finally {
  cdp.close()
  browser.kill()
}

console.log(`\nScreenshots: ${work}`)
console.log(failures ? `${failures} check(s) failed` : 'All checks passed')
process.exit(failures ? 1 : 0)
