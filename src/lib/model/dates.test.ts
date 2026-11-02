import { describe, expect, it } from 'vitest'
import { formatMonth, formatRange } from './dates'

describe('formatMonth', () => {
  it('formats a year-month in the requested locale', () => {
    expect(formatMonth('2022-03', 'en')).toMatch(/Mar 2022/)
    expect(formatMonth('2022-03', 'id')).toMatch(/2022/)
  })

  it('formats a bare year as the year', () => {
    expect(formatMonth('2022', 'en')).toBe('2022')
  })

  it('passes through free text rather than mangling it', () => {
    expect(formatMonth('Summer 2024', 'en')).toBe('Summer 2024')
    expect(formatMonth('2022-13', 'en')).toBe('2022-13')
  })

  it('returns an empty string for blank input', () => {
    expect(formatMonth('   ', 'en')).toBe('')
  })

  it('does not shift the month across a timezone boundary', () => {
    expect(formatMonth('2022-01', 'en')).toMatch(/Jan 2022/)
    expect(formatMonth('2022-12', 'en')).toMatch(/Dec 2022/)
  })
})

describe('formatRange', () => {
  it('joins start and end', () => {
    expect(formatRange({ start: '2019-08', end: '2022-02' }, 'en', 'Present')).toMatch(
      /Aug 2019 – Feb 2022/,
    )
  })

  it('uses the present label for a current role', () => {
    expect(formatRange({ start: '2022-03', end: null, current: true }, 'en', 'Present')).toMatch(
      /Mar 2022 – Present/,
    )
  })

  it('renders a lone start without a dash', () => {
    expect(formatRange({ start: '2022-03', end: null }, 'en', 'Present')).toMatch(/^Mar 2022$/)
  })

  it('returns an empty string when the range is empty', () => {
    expect(formatRange({ start: '', end: null }, 'en', 'Present')).toBe('')
  })
})
