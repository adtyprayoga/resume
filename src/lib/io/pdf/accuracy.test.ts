import { describe, expect, it } from 'vitest'
import { emptyDocument } from '$lib/model/document'
import type { Proposal } from './mapper'
import { scoreProposal, stripStyles, type Golden } from './accuracy'

const proposalWith = (): Proposal => ({ locale: 'en', document: emptyDocument(), refs: [], warnings: [], unmatched: [] })
const golden = (sections: Golden['sections'] = {}): Golden => ({ locale: 'en', profile: { name: 'Rina' }, contact: {}, sections, unplaced: 0 })
describe('import accuracy', () => {
  it('scores scalars, lists and entry alignment', () => {
    const proposal = proposalWith()
    proposal.document.profile.text.en.name = 'Rina'
    proposal.document.content.experience = [{ id: 'a', company: 'A', dates: { start: '', end: '' }, text: { en: { role: '', team: '', location: '', bullets: ['x', 'z', 'w'] }, id: { role: '', team: '', location: '', bullets: [] } } }]
    const score = scoreProposal(golden({ experience: [{ company: 'A', bullets: ['x', 'y'] }, { company: 'B' }] }), proposal)
    expect(score).toMatchObject({ expected: 5, filled: 5, correct: 3 })
    expect(score.bySection.experience).toEqual({ expected: 4, filled: 4, correct: 2 })
    expect(score.outcomes).toMatchObject({ 'experience.0.bullets.1': 'wrong', 'experience.0.bullets.2': 'extra', 'experience.1.company': 'missing' })
  })
  it('counts output fields even when unasserted or expected empty', () => {
    const proposal = proposalWith()
    proposal.document.profile.text.en.location = 'Jakarta'
    proposal.document.contact.phone = '123'
    const score = scoreProposal({ ...golden(), profile: { name: 'Rina', location: '' } }, proposal)
    expect(score).toMatchObject({ filled: 2, correct: 0 })
    expect(score.outcomes['profile.location']).toBe('wrong')
    expect(score.outcomes['contact.phone']).toBe('wrong')
  })
  it('normalises whitespace and ignores empty filled values', () => {
    const proposal = proposalWith()
    proposal.document.profile.text.en.name = ' A  B\n'
    expect(scoreProposal({ ...golden(), profile: { name: 'A B' } }, proposal)).toMatchObject({ expected: 1, filled: 1, correct: 1 })
  })
  it('scores an entire date range as one unit and future sections as missing', () => {
    const proposal = proposalWith()
    const score = scoreProposal(golden({ certifications: [{ title: 'Certificate', issuer: '', date: '2024', description: '' }], experience: [{ dates: { start: '2020', end: '2021' } }] }), proposal)
    expect(score).toMatchObject({ expected: 4, filled: 0, correct: 0 })
    expect(score.outcomes['experience.0.dates']).toBe('missing')
    expect(score.outcomes['certifications.0.title']).toBe('missing')
  })
  it('compares complete date ranges rather than awarding partial credit', () => {
    const proposal = proposalWith()
    proposal.document.content.education = [{ id: 'a', dates: { start: '2020', end: '2022' }, gpa: '', text: { en: { school: '', degree: '', field: '', description: '' }, id: { school: '', degree: '', field: '', description: '' } } }]
    const score = scoreProposal({ ...golden(), profile: {}, sections: { education: [{ dates: { start: '2020', end: '2021' } }] } }, proposal)
    expect(score).toMatchObject({ expected: 1, filled: 1, correct: 0, outcomes: { 'education.0.dates': 'wrong' } })
  })
  it('counts every populated field of extra entries', () => {
    const proposal = proposalWith()
    proposal.document.content.skills = [{ id: 'a', text: { en: { title: 'Tools', items: ['Git'] }, id: { title: '', items: [] } } }]
    expect(scoreProposal(golden(), proposal)).toMatchObject({ filled: 2, outcomes: { 'skills.0.title': 'extra', 'skills.0.items.0': 'extra' } })
  })
  it('counts empty and whitespace list positions, including missing and extra slots', () => {
    const proposal = proposalWith()
    proposal.document.content.skills = [{ id: 'a', text: { en: { title: '', items: ['x', '', '  '] }, id: { title: '', items: [] } } }]
    const score = scoreProposal({ ...golden(), profile: {}, sections: { skills: [{ items: ['x'] }] } }, proposal)
    expect(score).toMatchObject({ expected: 1, filled: 3, correct: 1, outcomes: { 'skills.0.items.1': 'extra', 'skills.0.items.2': 'extra' } })
    proposal.document.content.skills[0]!.text.en.items = []
    expect(scoreProposal({ ...golden(), profile: {}, sections: { skills: [{ items: ['', '  '] }] } }, proposal)).toMatchObject({ expected: 2, filled: 0, correct: 0, outcomes: { 'skills.0.items.0': 'missing', 'skills.0.items.1': 'missing' } })
    proposal.document.content.skills[0]!.text.en.items = [' ']
    expect(scoreProposal({ ...golden(), profile: {}, sections: { skills: [{ items: [''] }] } }, proposal)).toMatchObject({ expected: 1, filled: 1, correct: 1, outcomes: { 'skills.0.items.0': 'correct' } })
  })
  it('strips styles without touching anything else', () => {
    const extraction = { contract_version: 1 as const, pages: 1, blocks: [{ id: 'b1', page: 1, label: 'text', group: null, text: 'Hello', bbox: null, style: { bold: true } }] }
    expect(stripStyles(extraction)).toEqual({ ...extraction, blocks: [{ id: 'b1', page: 1, label: 'text', group: null, text: 'Hello', bbox: null }] })
    expect(extraction.blocks[0]!.style).toEqual({ bold: true })
  })
})
