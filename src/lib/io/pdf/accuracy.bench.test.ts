import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { scoreProposal, stripStyles, type Golden, type Score } from './accuracy'
import { mapExtraction } from './mapper'
import { parseExtraction } from './validate'

const root = resolve(__dirname, '../../../../services/pdf-import')
const baselinePath = resolve(root, 'bench-results/accuracy.json')
const names = ['en_single', 'id_single', 'two_column', 'five_page', 'progression', 'scanned', 'mixed', 'guide_template']
const assertNoRegression = (before: Pick<Score, 'outcomes'>, score: Pick<Score, 'outcomes'>, label: string) => {
  for (const [path, outcome] of Object.entries(before.outcomes)) if (outcome === 'correct') expect(score.outcomes[path], `${label}/${path}`).toBe('correct')
  const errors = (s: Pick<Score, 'outcomes'>) => Object.values(s.outcomes).filter(o => o === 'wrong' || o === 'extra').length
  expect(errors(score), `${label} wrong + extra`).toBeLessThanOrEqual(errors(before))
}
it('rejects loss of a correct unit even when other units improve', () => {
  const before = { outcomes: { name: 'correct', company: 'wrong', role: 'missing' } } as const
  const after = { outcomes: { name: 'missing', company: 'correct', role: 'correct' } } as const
  expect(() => assertNoRegression(before, after, 'fixture/rules')).toThrow()
})
it('preserves each correct baseline unit and does not add wrong or extra units', () => {
  const fixtures: Record<string, Record<string, Score>> = {}
  const baseline = process.env.BENCH_UPDATE === '1' ? null : JSON.parse(readFileSync(baselinePath, 'utf8')) as { fixtures: typeof fixtures }
  const rows = ['| fixture | mode | recall | precision | unplaced |', '| --- | --- | --- | --- | --- |']
  const ratio = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)}%` : '—'
  for (const name of names) {
    const golden: Golden = JSON.parse(readFileSync(resolve(root, `tests/fixtures/expected/${name}.json`), 'utf8'))
    const parsed = parseExtraction(JSON.parse(readFileSync(resolve(root, `tests/fixtures/contract/valid/extraction_${name}.json`), 'utf8')))
    if (!parsed.ok) throw new Error(JSON.stringify(parsed))
    const scores: Record<string, Score> = fixtures[name] = {}
    for (const mode of ['typography', 'rules']) {
      const score = scores[mode] = scoreProposal(golden, mapExtraction(mode === 'rules' ? stripStyles(parsed.value) : parsed.value, golden.locale))
      if (baseline) {
        const before = baseline.fixtures[name]?.[mode]
        if (!before) throw new Error(`Missing baseline: ${name}/${mode}`)
        assertNoRegression(before, score, `${name}/${mode}`)
      }
      rows.push(`| ${name} | ${mode} | ${ratio(score.correct, score.expected)} | ${ratio(score.correct, score.filled)} | ${score.unplaced} |`)
      for (const [section, counts] of Object.entries(score.bySection)) rows.push(`| ${name}: ${section} | ${mode} | ${ratio(counts.correct, counts.expected)} | ${ratio(counts.correct, counts.filled)} | — |`)
    }
  }
  if (process.env.BENCH_UPDATE === '1') { mkdirSync(resolve(root, 'bench-results'), { recursive: true }); writeFileSync(baselinePath, JSON.stringify({ fixtures }, null, 2) + '\n') }
  if (process.env.BENCH_REPORT === '1') console.log(rows.join('\n'))
})
