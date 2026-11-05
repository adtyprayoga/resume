/**
 * What each story blank is for, and the lesson from the user's resume guide
 * (docs/superpowers/specs/2026-11-04-resume-guidance-notes.md) behind it.
 * Tips are interface text: shown in the interface language, never written
 * into the resume.
 */
import type { Locale } from '$lib/model/types'
import type { Chapter, StoryPage } from './story'

type Bilingual = Record<Locale, string>
export interface Tip {
  text: Bilingual
  example: Bilingual
}

const tip = (en: string, id: string, exampleEn: string, exampleId = exampleEn): Tip => ({
  text: { en, id },
  example: { en: `Example: ${exampleEn}`, id: `Contoh: ${exampleId}` },
})

/** Keyed by slot, the last part of a blank id; chapter-specific meanings override below. */
const BY_SLOT: Record<string, Tip> = {
  secondary: tip(
    'A second field that supports your main one. Together they tell HR where you fit.',
    'Bidang kedua yang relevan dengan bidang utama Anda. Keduanya memberi tahu HR di mana Anda cocok.',
    'Learning & Development | HR Generalist',
  ),
  differentiator: tip(
    'What sets you apart from other candidates: your added value. Being tech-savvy speeds up admin work, and companies love efficiency. A language counts too: English or Mandarin raises your value.',
    'Apa yang membedakan Anda dari kandidat lain, apa nilai tambahnya? Tech savvy membuat administrasi lebih cepat, dan perusahaan menyukai efisiensi. Bahasa juga bisa: kemampuan bahasa Inggris atau Mandarin menaikkan daya jual.',
    'Tech Savvy, or Fluent in English',
    'Tech Savvy, atau Fasih Bahasa Inggris',
  ),
  city: tip(
    'Just the city, no full address. HR only needs a rough idea of where you live.',
    'Cukup nama kota saja, tidak perlu alamat lengkap. HR hanya perlu perkiraan tempat tinggal Anda.',
    'Jakarta',
  ),
  email: tip(
    'An address you check every day, ideally one with your name in it.',
    'Alamat yang Anda periksa setiap hari, sebaiknya yang memakai nama Anda.',
    'dewi.lestari@gmail.com',
  ),
  phone: tip(
    'A number HR can reach by both WhatsApp and an ordinary call.',
    'Nomor yang bisa dihubungi HR lewat WhatsApp maupun telepon biasa.',
    '+62 812 3456 7890',
  ),
  linkedin: tip(
    'Your LinkedIn profile address, so HR can read more of your story.',
    'Alamat profil LinkedIn Anda, agar HR bisa membaca lebih banyak kisah Anda.',
    'linkedin.com/in/dewilestari',
  ),
  years: tip(
    'Write a number: numbers set you apart. Three years and five years sell very differently.',
    'Tuliskan angka, karena angka yang membedakan Anda dari kandidat lain. Pengalaman 3 tahun dan 5 tahun nilai jualnya berbeda.',
    '5',
  ),
  field: tip(
    'The field you work in, matching the career you are aiming for.',
    'Bidang yang Anda tekuni, sesuai dengan karier yang Anda tuju.',
    'Learning & Development',
  ),
  industries: tip(
    'The industries you have worked in. HR often prefers candidates from its own industry: FMCG HR likes FMCG experience, banking HR likes banking.',
    'Industri tempat Anda pernah bekerja. HR sering memilih kandidat dari industri yang sama: HR FMCG lebih suka pengalaman FMCG, HR perbankan lebih suka perbankan.',
    'FMCG, banking, retail',
    'FMCG, perbankan, ritel',
  ),
  expertise: tip(
    'Your strongest hard skills, the ones relevant to the job you want. A skill that does not fit your target career adds little.',
    'Hard skill terkuat Anda yang relevan dengan pekerjaan yang dituju. Keahlian yang tidak sesuai dengan tujuan karier nilainya jadi kecil.',
    'training needs analysis, e-learning design',
    'analisis kebutuhan pelatihan, desain e-learning',
  ),
  audience: tip(
    'If your work serves people, say who: from which level to which level.',
    'Jika pekerjaan Anda melayani orang, sebutkan siapa: dari level mana sampai level mana.',
    'new hires to senior managers',
    'karyawan baru hingga manajer senior',
  ),
  strengths: tip(
    'Soft skills you use every day in the career you want.',
    'Soft skill yang Anda gunakan sehari-hari dalam karier yang dituju.',
    'patient, detail-oriented, adaptable',
    'sabar, teliti, mudah beradaptasi',
  ),
  hardField: tip(
    'The name of your main skill area, usually your field. It becomes the title of the skill group.',
    'Nama bidang keahlian utama Anda, biasanya bidang kerja Anda. Ini menjadi judul kelompok keahlian.',
    'Training',
  ),
  hardItems: tip(
    'The hard skills of your field, separated by commas. Aiming for HR? Think interviewing with the STAR method, or HRIS.',
    'Hard skill di bidang Anda, dipisahkan koma. Ingin ke HR? Misalnya interview metode STAR atau HRIS.',
    'Training design, Facilitation, Needs analysis',
    'Desain pelatihan, Fasilitasi, Analisis kebutuhan',
  ),
  tools: tip(
    'Supporting skills: the tools your work relies on. Reports, for example, mean Microsoft Office or Google Workspace.',
    'Keahlian penunjang: alat yang dibutuhkan pekerjaan Anda. Membuat laporan, misalnya, butuh Microsoft Office atau Google Workspace.',
    'Microsoft Excel, Google Slides, Canva',
  ),
  soft: tip(
    'Soft skills the job market asks for. Check job portals for what roles like yours demand, then write those.',
    'Soft skill yang diminta pasar kerja. Cek dulu di job portal soft skill apa yang dicari untuk posisi seperti Anda, lalu tuliskan.',
    'Communication, Teamwork, Problem solving',
    'Komunikasi, Kerja sama tim, Pemecahan masalah',
  ),
  languages: tip(
    'Languages you speak, each with its level, ideally from a test result.',
    'Bahasa yang Anda kuasai, masing-masing dengan levelnya, sebaiknya dari hasil tes.',
    'English (IELTS 7.0), Mandarin (HSK 3)',
    'Inggris (IELTS 7.0), Mandarin (HSK 3)',
  ),
  level: tip(
    'The level of this language, from a test or certificate if you have one.',
    'Level bahasa ini, dari hasil tes atau sertifikat jika ada.',
    'Fluent, IELTS 7.0',
    'Fasih, IELTS 7.0',
  ),
  wanted: tip(
    'Skills the job adverts you want keep asking for, and that you really have.',
    'Keahlian yang sering diminta lowongan yang Anda incar, dan benar-benar Anda kuasai.',
    'Stakeholder management, LMS administration',
  ),
  company: tip(
    'The company name. If it is not well known, a note on its industry helps HR judge its scale.',
    'Nama perusahaan. Jika kurang dikenal, sebutkan industrinya agar HR bisa menilai skalanya.',
    'PT Nusantara Retail',
  ),
  role: tip('Your job title there.', 'Jabatan Anda di sana.', 'Training Officer'),
  location: tip(
    'The city where you worked. Just the city.',
    'Kota tempat Anda bekerja. Cukup nama kotanya.',
    'Surabaya',
  ),
  start: tip('The month you started.', 'Bulan Anda mulai.', 'March 2021', 'Maret 2021'),
  end: tip('The month it ended.', 'Bulan berakhirnya.', 'June 2023', 'Juni 2023'),
  achievement: tip(
    'Something you can put a number on: how many people, how much faster, which target you hit. Ask yourself where the company improved because you were there.',
    'Sesuatu yang bisa diberi angka: berapa orang, seberapa cepat, target apa yang tercapai. Tanyakan pada diri sendiri: perusahaan terbantu di bagian mana sejak ada Anda?',
    '120 new hires onboarded in 2023',
    '120 karyawan baru di-onboarding pada 2023',
  ),
  with: tip(
    'The teams or people you worked with. Stakeholders show the reach of your work.',
    'Tim atau orang yang bekerja dengan Anda. Stakeholder menunjukkan jangkauan pekerjaan Anda.',
    'the HR and Sales teams',
    'tim HR dan Sales',
  ),
  goal: tip(
    'What that collaboration achieved: its impact.',
    'Apa yang dicapai dari kerja sama itu: dampaknya.',
    'onboarding 15% faster',
    'onboarding 15% lebih cepat',
  ),
  school: tip(
    'Your university, or your school if you have not been to university.',
    'Nama kampus Anda, atau nama sekolah jika belum berkesempatan kuliah.',
    'Universitas Indonesia',
  ),
  degree: tip('Your degree level.', 'Jenjang pendidikan Anda.', "Bachelor's degree", 'S1'),
  gpa: tip(
    'Your GPA, written against its scale.',
    'IPK Anda, ditulis beserta skalanya.',
    '3.45/4.00',
  ),
  title: tip(
    'The name of the course, training or certification.',
    'Nama kursus, pelatihan, atau sertifikasi.',
    'Certified Professional Trainer',
  ),
  issuer: tip(
    'Who ran it. The more credible the provider, the more it is worth on your resume.',
    'Lembaga penyelenggaranya. Semakin kredibel lembaganya, semakin tinggi daya tawarnya di CV.',
    'Coursera, BNSP',
  ),
  date: tip('The month and year you took it.', 'Bulan dan tahun pelaksanaannya.', 'May 2024', 'Mei 2024'),
  topics: tip(
    'The main topics you learned that matter for the career you want.',
    'Poin-poin utama yang dipelajari dan dibutuhkan untuk karier yang dituju.',
    'adult learning, evaluation models',
    'pembelajaran orang dewasa, model evaluasi',
  ),
  name: tip(
    'Someone able to judge your work, ideally a former supervisor, not a peer.',
    'Orang yang mampu menilai kompetensi Anda selama bekerja, sebaiknya atasan, bukan rekan sejawat.',
    'Anggi Rania',
  ),
  position: tip(
    'Their position and company.',
    'Posisi dan perusahaan orang tersebut.',
    'HR Manager at PT ABC',
    'HR Manager di PT ABC',
  ),
}

/** Same slot, different meaning in this chapter. */
const BY_CHAPTER: Partial<Record<Chapter, Record<string, Tip>>> = {
  education: {
    field: tip('Your major or field of study.', 'Jurusan atau bidang studi Anda.', 'Psychology', 'Psikologi'),
    start: tip('When you started studying there.', 'Kapan Anda mulai belajar di sana.', 'August 2015', 'Agustus 2015'),
    end: tip('When you graduated, or expect to.', 'Kapan Anda lulus, atau perkiraan lulus.', 'July 2019', 'Juli 2019'),
  },
  references: {
    phone: tip('A number where they can be reached.', 'Nomor yang bisa dihubungi.', '+62 811 2345 678'),
    email: tip('Their email address.', 'Alamat email mereka.', 'anggi.rania@gmail.com'),
  },
}

export const tipFor = (chapter: StoryPage['chapter'], blankId: string): Tip | undefined => {
  const parts = blankId.split(':')
  // Language levels are numbered: competencies:level:<group>:<index>.
  const slot = parts[1] === 'level' ? 'level' : parts.at(-1)!
  return (chapter === 'ending' ? undefined : BY_CHAPTER[chapter]?.[slot]) ?? BY_SLOT[slot]
}
