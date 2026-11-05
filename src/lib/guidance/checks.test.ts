import { describe, expect, it } from 'vitest'
import type { ExperienceItem } from '$lib/model/types'
import {
  groupKind, hasNumber, headlineParts, isNewestFirst, isShortSummary,
  languageWithoutLevel, looksLikeAddress, monthMissing, orderExperienceNewestFirst,
} from './checks'

function job(id: string, start: string, current?: boolean): ExperienceItem {
  return {
    id, company: id, dates: { start, end: current ? null : start, ...(current === undefined ? {} : { current }) },
    text: {
      en: { role: '', team: '', location: '', bullets: [] },
      id: { role: '', team: '', location: '', bullets: [] },
    },
  }
}

describe('headlineParts', () => {
  it.each([
    ['Designer | Writer', ['Designer', 'Writer']],
    [' | Developer || Mentor | ', ['Developer', 'Mentor']],
    ['', []],
    ['  ', []],
  ])('splits %j', (headline, expected) => expect(headlineParts(headline)).toEqual(expected))
})

describe('looksLikeAddress', () => {
  it.each([
    ['Jl. Sudirman No. 5, Jakarta', true],
    ['No. 12', true],
    ['Jl 5', true],
    ['Jakarta, Indonesia, Asia', true],
    ['Tower 12B', true],
    ['Gang Melati', true],
    ['BLOCK A', true],
    ['Jakarta', false],
    ['Jakarta, Indonesia', false],
    ['Streetwear designer', false],
    ['Roadmap specialist', false],
    ['', false],
  ])('checks %j', (location, expected) => expect(looksLikeAddress(location)).toBe(expected))
})

describe('hasNumber', () => {
  it.each([['Led 5 people', true], ['2024', true], ['five people', false], ['', false]])(
    'checks %j', (value, expected) => expect(hasNumber(value)).toBe(expected),
  )
})

describe('isShortSummary', () => {
  it.each([
    ['', true],
    ['one two three', true],
    [Array(24).fill('word').join(' '), true],
    [Array(25).fill('word').join(' '), false],
    [Array(26).fill('word').join('\n'), false],
  ])('checks word count in %j', (summary, expected) => expect(isShortSummary(summary)).toBe(expected))
})

describe('groupKind', () => {
  it.each([
    ['Bahasa', 'languages'],
    ['Foreign Languages', 'languages'],
    ['Soft Skills', 'soft'],
    ['Interpersonal communication', 'soft'],
    ['Support Technical Skills', 'tools'],
    ['Aplikasi', 'tools'],
    ['Training Skills', 'hard'],
    ['Tooling', 'hard'],
    ['Personalization', 'hard'],
    ['', 'hard'],
  ] as const)('classifies %j', (title, expected) => expect(groupKind(title)).toBe(expected))
})

describe('languageWithoutLevel', () => {
  it.each([
    ['English', true], ['Bahasa Indonesia (native)', false],
    ['English (', false], ['Spanish - fluent', true],
  ])('checks %j', (item, expected) => expect(languageWithoutLevel(item)).toBe(expected))
})

describe('isNewestFirst', () => {
  it.each([
    [[], true],
    [[job('new', '2025-06'), job('old', '2024')], true],
    [[job('current', '2020', true), job('dated', '2025-06')], true],
    [[job('new', '2025-01'), job('year', '2025')], true],
    [[job('missing-flag', '2025'), job('false-flag', '2024')], true],
    [[job('year', '2025'), job('month', '2025-01')], false],
    [[job('dated', '2025-06'), job('current', '2020', true)], false],
    [[job('undated', ''), job('new', '2025'), job('blank', ''), job('old', '2024')], true],
    [[job('old', '2024'), job('undated', ''), job('new', '2025')], false],
    [[job('undated-current', '', true), job('old', '2024'), job('new', '2025')], false],
  ] satisfies [ExperienceItem[], boolean][])('checks dated order %#', (items, expected) => {
    expect(isNewestFirst(items)).toBe(expected)
  })
})

describe('orderExperienceNewestFirst', () => {
  it('sorts dated jobs stably and preserves undated positions and input', () => {
    const items = [job('old', '2023'), job('unknown-a', ''), job('tie-a', '2025'), job('current', '2020', true), job('unknown-b', ''), job('tie-b', '2025')]
    const sorted = orderExperienceNewestFirst(items)
    expect(sorted.map(({ id }) => id)).toEqual(['current', 'unknown-a', 'tie-a', 'tie-b', 'unknown-b', 'old'])
    expect(items.map(({ id }) => id)).toEqual(['old', 'unknown-a', 'tie-a', 'current', 'unknown-b', 'tie-b'])
  })
})

describe('monthMissing', () => {
  it.each([
    ['2025', true], ['0000', true], ['2025-01', false], ['25', false], [' 2025 ', false], ['', false],
  ])('checks %j', (date, expected) => expect(monthMissing(date)).toBe(expected))
})
