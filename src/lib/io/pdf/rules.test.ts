import { describe, expect, it } from 'vitest'
import { findContacts, findDateRange, isCertificate, isLocation, matchHeading, parseDate, sectionHeading, splitRoleCompany, splitTitleIssuer, splitTrailingLocation, stripBullet } from './rules'

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
    ['Languages', 'unsupported'],
    ['Bahasa', 'unsupported'],
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

describe('matchHeading aliases from the resume guide', () => {
  it.each([
    ['Profile Summary', 'summary'], ['Personal Summary', 'summary'], ['Personal Profile', 'summary'], ['Career Profile', 'summary'],
    ['Competencies & Abilities', 'skills'], ['Skills & Abilities', 'skills'], ['Skills and Competencies', 'skills'],
    ['Competencies & Skills', 'skills'], ['Abilities', 'skills'],
    ['Working Experience', 'experience'], ['Working Experiences', 'experience'], ['Work Experiences', 'experience'],
    ['Professional Experiences', 'experience'], ['Experiences', 'experience'], ['Pengalaman Bekerja', 'experience'],
    ['Education Background', 'education'], ['Education History', 'education'], ['Educational History', 'education'],
    ['Course', 'certifications'], ['Courses', 'certifications'], ['Courses & Certifications', 'certifications'],
    ['Certifications', 'certifications'], ['Certification', 'certifications'], ['Certificates', 'certifications'],
    ['Certificate', 'certifications'], ['Licenses & Certifications', 'certifications'], ['Licences and Certifications', 'certifications'],
    ['Training', 'certifications'], ['Trainings', 'certifications'], ['Kursus', 'certifications'], ['Pelatihan', 'certifications'],
    ['Sertifikasi', 'certifications'], ['Sertifikat', 'certifications'], ['Lisensi dan Sertifikasi', 'certifications'],
    ['References', 'references'], ['Reference', 'references'], ['Referees', 'references'], ['Referensi', 'references'],
    ['Rekomendasi', 'references'],
    ['Hobbies', 'unsupported'], ['Languages', 'unsupported'],
  ] as const)('matches %s', (text, kind) => expect(matchHeading(text)).toBe(kind))
})

describe('isLocation', () => {
  it.each(['Bandung, Indonesia', 'Jakarta Selatan, DKI Jakarta, Indonesia'])('accepts %s', (text) => expect(isLocation(text)).toBe(true))
  it.each(['Bandung', 'Bachelor of Computer Science, 2013 - 2017', 'A B C D E F, G'])('rejects %s', (text) => expect(isLocation(text)).toBe(false))
})

describe('splitTrailingLocation', () => {
  it('splits a trailing location only when it is one', () => {
    expect(splitTrailingLocation('Contoh Consulting - Bandung, Indonesia')).toEqual({ head: 'Contoh Consulting', location: 'Bandung, Indonesia' })
    expect(splitTrailingLocation('Contoh Edu | Surabaya, Indonesia')).toEqual({ head: 'Contoh Edu', location: 'Surabaya, Indonesia' })
    expect(splitTrailingLocation('PT A – B — Jakarta Selatan, Indonesia')).toEqual({ head: 'PT A – B', location: 'Jakarta Selatan, Indonesia' })
    expect(splitTrailingLocation('Universitas Contoh - S1 Informatika')).toBeNull()
    expect(splitTrailingLocation(' - Bandung, Indonesia')).toBeNull()
    expect(splitTrailingLocation('Bandung, Indonesia')).toBeNull()
  })
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

  it.each(['+62 812 3456 2019', '0812 3456 2020', '+1 415 555 1999'])('keeps the phone number %j', (text) => {
    expect(findContacts(text).map((c) => [c.field, c.value])).toEqual([['phone', text]])
  })

  it.each(['2013 - 2017', '2019 – 2020', 'Jan 2019 - Dec 2020', '2019 - 2021 (2 years)', 'Jakarta, 2013 - 2017 2019'])('still ignores the date range %j', (text) => {
    expect(findContacts(text)).toEqual([])
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

  it.each(['➔ ', '→ ', '➜ ', '➤ ', '➣ ', '✓ ', '✔ ', '■ ', '□ ', '◆ ', '◇ ', '❖ ', '○ '])('strips %s', (g) =>
    expect(stripBullet(`${g}Soft Skills: X`).text).toBe('Soft Skills: X'))

  it('strips the ASCII arrow Docling writes for ➔', () => {
    expect(stripBullet('-> Soft Skills: X')).toEqual({ text: 'Soft Skills: X', from: 3 })
  })

  it.each(['A->B', '->', '->B', '=> Soft Skills', '> Soft Skills'])('leaves %j alone', (text) => {
    expect(stripBullet(text)).toEqual({ text, from: 0 })
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

describe('splitTitleIssuer', () => {
  it('splits a course row at the last spaced dash and reads a trailing "| date"', () => {
    const text = 'Business English Training - Contoh Language Centre | Jun 2025'
    const row = splitTitleIssuer(text)
    expect(row).toMatchObject({ title: 'Business English Training', issuer: 'Contoh Language Centre', date: { start: '2025-06' } })
    expect(text.slice(row!.date!.from, row!.date!.to)).toBe('Jun 2025')
  })

  it('splits at the last dash and leaves the date null without one', () => {
    expect(splitTitleIssuer('Hanyu Shuiping Kaoshi / Mandarin Test - Contoh Institute')).toEqual({
      title: 'Hanyu Shuiping Kaoshi / Mandarin Test', issuer: 'Contoh Institute', date: null,
    })
    expect(splitTitleIssuer('Cloud - Data - Example Academy')).toMatchObject({ title: 'Cloud - Data', issuer: 'Example Academy' })
  })

  it('reads a date after a dash or comma, and splits "Title, Issuer, year"', () => {
    expect(splitTitleIssuer('Professional Testing Certificate — Example Institute — 2023')).toMatchObject({
      title: 'Professional Testing Certificate', issuer: 'Example Institute', date: { start: '2023' },
    })
    expect(splitTitleIssuer('Foundation Testing Certificate, Example Board, 2024')).toMatchObject({
      title: 'Foundation Testing Certificate', issuer: 'Example Board', date: { start: '2024' },
    })
  })

  it('keeps a dated row without an issuer whole', () => {
    expect(splitTitleIssuer('AWS Certified Cloud Practitioner | Mar 2023')).toMatchObject({
      title: 'AWS Certified Cloud Practitioner', issuer: '', date: { start: '2023-03' },
    })
  })

  it.each([
    'Presentation, negotiation, and business writing',
    'Dashboards, Power Query, 2024 and data modelling',
    'Business English Training - Contoh Language Centre | Jun 2025 Presentation, negotiation',
    'Data Analysis',
  ])('returns null for %j', (text) => expect(splitTitleIssuer(text)).toBeNull())
})

describe('isCertificate', () => {
  it.each(['Foundation Testing Certificate', 'AWS Certified Developer', 'Business English Training', 'Data Analysis Course',
    'Driving Licence', 'Sertifikasi BNSP', 'Kursus Bahasa Inggris', 'Pelatihan Kepemimpinan', 'Lisensi Ahli K3'])('%s is a certificate', (text) => {
    expect(isCertificate(text)).toBe(true)
  })
  it.each(['National Service Gold Pin, Civic Agency, 2021', 'Bahasa Indonesia (Native); English (Conversational)'])('%s is not', (text) => {
    expect(isCertificate(text)).toBe(false)
  })
})

describe('sectionHeading for certifications and references', () => {
  it('reads a plain-text "Certifications:" or "References:" label as content, not a section', () => {
    expect(sectionHeading('Certifications:', 'text')).toBeNull()
    expect(sectionHeading('References:', 'list_item')).toBeNull()
    expect(sectionHeading('Certifications:', 'section_header')).toBe('certifications')
    expect(sectionHeading('Certifications', 'text')).toBe('certifications')
  })
})
