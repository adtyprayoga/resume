import { describe, expect, it } from 'vitest'
import { bulletSentence, fill, GROUP_TITLES, hardGroupTitle, joinList, NARRATION, summarySentence, type SummaryAnswers } from './templates'

describe('joinList', () => {
  it.each([
    ['en', ['A'], 'A'],
    ['en', ['A', 'B'], 'A and B'],
    ['en', ['A', 'B', 'C'], 'A, B, and C'],
    ['id', ['A'], 'A'],
    ['id', ['A', 'B'], 'A dan B'],
    ['id', ['A', 'B', 'C'], 'A, B, dan C'],
  ] as const)('joins %s items %j', (locale, items, expected) => {
    expect(joinList([...items], locale)).toBe(expected)
  })
})

describe('summarySentence', () => {
  it('writes all answers in English', () => {
    expect(summarySentence({ years: '5', field: 'Learning & Development', industries: ['FMCG', 'banking'], expertise: ['training design'], audience: 'staff to directors', strengths: ['patient', 'curious'] }, 'en'))
      .toBe('I have 5 years of experience in the field of Learning & Development, across industries including FMCG and banking. My expertise involves training design. I have worked with staff to directors. I am known for being patient and curious.')
  })

  it('writes all answers in Indonesian', () => {
    expect(summarySentence({ years: '5', field: 'Pelatihan', industries: ['FMCG', 'perbankan'], expertise: ['desain pelatihan'], audience: 'staf hingga direktur', strengths: ['sabar', 'ingin tahu'] }, 'id'))
      .toBe('Saya memiliki 5 tahun pengalaman di bidang Pelatihan, di berbagai industri termasuk FMCG dan perbankan. Keahlian saya meliputi desain pelatihan. Saya telah bekerja dengan staf hingga direktur. Saya dikenal sebagai pribadi yang sabar dan ingin tahu.')
  })

  it.each([
    [{ years: '5' }, 'I have 5 years of experience.'],
    [{ field: 'Training' }, 'I work in the field of Training.'],
    [{ field: 'Training', industries: ['education', 'healthcare'] }, 'I work in the field of Training, across industries including education and healthcare.'],
    [{ expertise: ['training design'] }, 'My expertise involves training design.'],
    [{ industries: ['education'] }, 'I have experience in industries including education.'],
    [{ years: ' ', industries: [], strengths: [''] }, ''],
  ] satisfies [SummaryAnswers, string][])('handles partial answers %j', (answers, expected) => {
    expect(summarySentence(answers, 'en')).toBe(expected)
  })
})

describe('bulletSentence', () => {
  it.each([
    ['stakeholder', { with: 'teams', goal: 'better service' }, 'en', 'Collaborating with teams to achieve better service.'],
    ['stakeholder', { with: 'teams' }, 'en', 'Collaborating with teams.'],
    ['stakeholder', { goal: 'better service' }, 'en', 'Working towards better service.'],
    ['stakeholder', { with: 'tim', goal: 'layanan yang lebih baik' }, 'id', 'Berkolaborasi dengan tim untuk mencapai layanan yang lebih baik.'],
    ['stakeholder', { with: 'tim' }, 'id', 'Berkolaborasi dengan tim.'],
    ['stakeholder', { goal: 'layanan yang lebih baik' }, 'id', 'Bekerja untuk mencapai layanan yang lebih baik.'],
    ['achievement', { achievement: 'a faster process' }, 'en', 'Contributing to the achievement of a faster process.'],
    ['achievement', { achievement: 'proses yang lebih cepat' }, 'id', 'Berkontribusi dalam pencapaian proses yang lebih cepat.'],
    ['stakeholder', {}, 'en', ''],
    ['achievement', { achievement: ' ' }, 'id', ''],
  ] as const)('writes %s bullet %j in %s', (kind, answers, locale, expected) => {
    expect(bulletSentence(kind, answers, locale)).toBe(expected)
  })
})

it('provides exact group titles', () => {
  expect(GROUP_TITLES).toEqual({
    soft: { en: 'Soft Skills', id: 'Soft Skills' },
    tools: { en: 'Support Technical Skills', id: 'Keterampilan Teknis Pendukung' },
    languages: { en: 'Languages', id: 'Bahasa' },
    core: { en: 'Core Skills', id: 'Keahlian Utama' },
  })
  expect(hardGroupTitle('Training', 'en')).toBe('Training Skills')
  expect(hardGroupTitle('Training', 'id')).toBe('Keahlian Training')
})

it('provides bilingual narration for every key', () => {
  for (const value of Object.values(NARRATION)) {
    expect(value.en.trim()).not.toBe('')
    expect(value.id.trim()).not.toBe('')
  }
  expect(NARRATION.opening).toEqual({
    en: 'Once upon a time, there lived a {headlineFirstPart} called {name}.',
    id: 'Pada suatu masa, hiduplah seorang {headlineFirstPart} bernama {name}.',
  })
  expect(NARRATION.ending).toEqual({
    en: 'And so the story of {name} was written.',
    id: 'Dan begitulah kisah {name} dituliskan.',
  })
})

it('fills named placeholders', () => {
  expect(fill('{name} works with {team}. {name} leads.', { name: 'Ayu', team: 'Design' }))
    .toBe('Ayu works with Design. Ayu leads.')
})
