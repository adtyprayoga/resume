import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditCss } from '../../styles/designContract'
const read = (file: string) => readFileSync(file, 'utf8')
it('uses the approved serif token and audits story chrome', () => {
  expect(auditCss('.story { font-family: var(--font-story); }', 'story.css')).toEqual([])
  expect(auditCss('.story { font-family: var(--font-unapproved); }', 'story.css')).not.toEqual([])
  const css = read('src/components/story/story.css')
  expect(css).toContain('var(--font-story)')
  expect(auditCss(css, 'src/components/story/story.css')).toEqual([])
})
it('pulses only icon opacity finitely and suppresses every pulse for reduced motion', () => {
  const css = read('src/components/shell/shell.css')
  expect(css).toMatch(/\.icon-btn\.pulse svg\s*\{[^}]*animation: lamp-glow var\(--dur-lamp\) var\(--ease-out\) 3/)
  expect(css).toMatch(/@keyframes lamp-glow\s*\{\s*0%, 100% \{ opacity: 1; \}\s*50% \{ opacity: 0.35; \}\s*\}/)
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.icon-btn\.pulse svg\s*\{\s*animation: none;/)
  expect(read('src/styles/tokens.css')).toContain('--dur-lamp: 1.2s;')
})
it('floats tips on desktop and shows them as a band under the line on phones', () => {
  const css = read('src/components/story/story.css')
  expect(css).toMatch(/@media \(max-width: 639px\)\s*\{[^}]*\.story-tip-float\s*\{\s*display: none;/)
  expect(css).toMatch(/@media \(min-width: 640px\)\s*\{[^@]*\.story-slot:hover \.story-tip-float,\s*\.story-slot:focus-within \.story-tip-float\s*\{\s*display: block;/)
  expect(css).toMatch(/@media \(min-width: 640px\)\s*\{[^@]*\.story-tip-band\s*\{\s*display: none;/)
})
