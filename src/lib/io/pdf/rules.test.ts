import { describe, expect, it } from 'vitest'
import { findContacts, findDateRange, matchHeading, parseDate, splitRoleCompany, stripBullet } from './rules'

describe('matchHeading', () => {
  it.each([
    ['Experience', 'experience'],
    ['WORK EXPERIENCE', 'experience'],
    ['Pengalaman Kerja', 'experience'],
    ['Riwayat Pekerjaan:', 'experience'],
    ['Experience (continued, page 2)', 'experience'],
    ['Education', 'education'],
    ['Pendidikan', 'education'],
    ['Projects', 'projects'],
    ['Proyek', 'projects'],
    ['Skills', 'skills'],
    ['Keahlian', 'skills'],
    ['Keterampilan', 'skills'],
    ['Awards', 'awards'],
    ['Penghargaan', 'awards'],
    ['Prestasi', 'awards'],
    ['Summary', 'summary'],
    ['Ringkasan', 'summary'],
    ['Profile', 'summary'],
    ['Profil', 'summary'],
    ['Tentang Saya', 'summary'],
    ['Contact', 'contact'],
    ['Kontak', 'contact'],
    ['Certifications', 'unsupported'],
    ['Sertifikasi', 'unsupported'],
    ['Languages', 'unsupported'],
    ['Bahasa', 'unsupported'],
    ['References', 'unsupported'],
  ])('%s → %s', (text, kind) => {
    expect(matchHeading(text)).toBe(kind)
  })

  it.each(['Senior Backend Engineer, Example Payments', 'Jane Doe', 'Experience with Kafka and Go', ''])(
    'does not treat %j as a heading',
    (text) => {
      expect(matchHeading(text)).toBeNull()
    },
  )
})

describe('parseDate', () => {
  it.each([
    ['2017', '2017'],
    ['Jan 2021', '2021-01'],
    ['January 2021', '2021-01'],
    ['Mar 2022', '2022-03'],
    ['Agustus 2019', '2019-08'],
    ['Agu 2019', '2019-08'],
    ['Okt 2020', '2020-10'],
    ['Mei 2018', '2018-05'],
    ['Des 2015', '2015-12'],
    ['03/2020', '2020-03'],
    ['2020-03', '2020-03'],
    ['3.2020', '2020-03'],
  ])('%s → %s', (text, value) => {
    expect(parseDate(text)).toBe(value)
  })

  it.each(['13/2020', 'Spring 2020', '20', 'Jan', '1899'])('rejects %j', (text) => {
    expect(parseDate(text)).toBeNull()
  })
})

describe('findDateRange', () => {
  it('finds a closed range and its span', () => {
    const text = 'Bachelor of Computer Science, 2013 - 2017'
    const found = findDateRange(text)
    expect(found).toMatchObject({ start: '2013', end: '2017', current: false })
    expect(text.slice(found!.from, found!.to)).toBe('2013 - 2017')
  })

  it.each([
    ['Jan 2021 - Present', { start: '2021-01', end: null, current: true }],
    ['Mar 2022 – Sekarang', { start: '2022-03', end: null, current: true }],
    ['Feb 2020 to Current', { start: '2020-02', end: null, current: true }],
    ['2019 sampai saat ini', { start: '2019', end: null, current: true }],
    ['05/2018 — 11/2020', { start: '2018-05', end: '2020-11', current: false }],
    ['Agustus 2016 s.d. Juli 2019', { start: '2016-08', end: '2019-07', current: false }],
  ])('%s', (text, expected) => {
    expect(findDateRange(text)).toMatchObject(expected)
  })

  it('reads a lone date as a start only, never as current', () => {
    expect(findDateRange('Juara 1 Kompetisi Analitik Nasional, 2018')).toMatchObject({ start: '2018', end: null, current: false })
  })

  it('ignores numbers that are not dates', () => {
    expect(findDateRange('Reduced latency by 2000 ms')).toBeNull()
    expect(findDateRange('+62 812 3456 7890')).toBeNull()
    expect(findDateRange('Achievement 1 at company 12.')).toBeNull()
  })
})

describe('findContacts', () => {
  it('finds each contact with its span', () => {
    const text = 'jane.doe@example.com | +62 812 3456 7890 | github.com/janedoe'
    const found = findContacts(text)
    expect(found.map((c) => [c.field, c.value])).toEqual([
      ['email', 'jane.doe@example.com'],
      ['phone', '+62 812 3456 7890'],
      ['github', 'https://github.com/janedoe'],
    ])
    for (const c of found) expect(text.slice(c.from, c.to)).toBe(c.raw)
  })

  it('classifies linkedin and personal sites', () => {
    expect(findContacts('linkedin.com/in/rinaputri').map((c) => [c.field, c.value])).toEqual([
      ['linkedin', 'https://linkedin.com/in/rinaputri'],
    ])
    expect(findContacts('Portfolio: https://rina.design').map((c) => [c.field, c.value])).toEqual([
      ['website', 'https://rina.design'],
    ])
  })

  it('finds Indonesian phone formats', () => {
    expect(findContacts('0812-9876-5432').map((c) => c.value)).toEqual(['0812-9876-5432'])
  })

  it('does not read date ranges or years as phone numbers', () => {
    expect(findContacts('2013 - 2017')).toEqual([])
    expect(findContacts('05/2018 — 11/2020')).toEqual([])
  })

  it('drops unsafe schemes', () => {
    expect(findContacts('javascript:alert(1)')).toEqual([])
  })
})

describe('stripBullet', () => {
  it.each([
    ['• Led migration', 'Led migration'],
    ['¢ Led migration', 'Led migration'],
    ['- Led migration', 'Led migration'],
    ['* Led migration', 'Led migration'],
    ['Led migration', 'Led migration'],
    ['-5% churn', '-5% churn'],
  ])('%s', (text, expected) => {
    expect(stripBullet(text).text).toBe(expected)
  })
})

describe('splitRoleCompany', () => {
  it('splits an explicit "at"', () => {
    expect(splitRoleCompany('Software Engineer at Sample Logistics')).toEqual({ role: 'Software Engineer', company: 'Sample Logistics' })
  })

  it('uses role words to decide which side is the role', () => {
    expect(splitRoleCompany('Senior Backend Engineer, Example Payments')).toEqual({ role: 'Senior Backend Engineer', company: 'Example Payments' })
    expect(splitRoleCompany('Toko Contoh | Analis Data Senior')).toEqual({ role: 'Analis Data Senior', company: 'Toko Contoh' })
  })

  it('returns null when it cannot tell', () => {
    expect(splitRoleCompany('Example Payments, Sample Logistics')).toBeNull()
    expect(splitRoleCompany('Product Designer')).toBeNull()
    expect(splitRoleCompany('Lead Engineer, Engineering Manager')).toBeNull()
  })
})
