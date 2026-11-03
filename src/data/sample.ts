// `?inline` emits a data URL at build time, so the sample document is
// self-contained: its photo survives a JSON export the same way a user's does.
import avatarSample from './avatar-sample.jpg?inline'
import { emptyDocument } from '$lib/model/document'
import type { ResumeDocument } from '$lib/model/types'

/** First-run content and test fixture. Entirely fictional. */
export const sampleDocument = (): ResumeDocument => ({
  ...emptyDocument(),
  contact: {
    email: 'aditya.prayoga@example.com',
    phone: '+62 811 2345 678',
    website: 'https://adityapryg.dev',
    github: 'https://github.com/example',
    linkedin: 'https://linkedin.com/in/example',
    avatar: avatarSample,
  },
  profile: {
    text: {
      id: {
        name: 'Aditya Prayoga',
        headline: 'Programmer Senior',
        location: 'Jakarta, Indonesia',
        summary:
          'Programmer dengan tujuh tahun pengalaman membangun layanan backend dan antarmuka web berskala besar. Fokus pada keandalan sistem, kualitas data, dan pendampingan rekan tim.',
      },
      en: {
        name: 'Aditya Prayoga',
        headline: 'Senior Software Engineer',
        location: 'Jakarta, Indonesia',
        summary:
          'Software engineer with seven years building backend services and large-scale web interfaces. Focused on system reliability, data quality, and mentoring teammates.',
      },
    },
  },
  content: {
    experience: [
      {
        id: 'exp_sample_1',
        company: 'PT Arkasa Melanglang Buana',
        dates: { start: '2022-03', end: null, current: true },
        text: {
          id: {
            role: 'Programmer Senior',
            team: 'Fitur Pembayaran',
            location: 'Jakarta',
            bullets: [
              'Memimpin migrasi layanan pembayaran ke arsitektur berbasis antrean, menurunkan kegagalan transaksi sebesar 38%.',
              'Merancang ulang skema basis data transaksi sehingga waktu kueri laporan harian turun dari 40 detik ke 3 detik.',
              'Mendampingi empat perekayasa junior melalui tinjauan kode mingguan dan sesi perancangan.',
            ],
          },
          en: {
            role: 'Senior Software Engineer',
            team: 'Payments Platform',
            location: 'Jakarta',
            bullets: [
              'Led the migration of payment services to a queue-based architecture, cutting transaction failures by 38%.',
              'Redesigned the transaction database schema, reducing daily report query time from 40s to 3s.',
              'Mentored four junior engineers through weekly code reviews and design sessions.',
            ],
          },
        },
      },
      {
        id: 'exp_sample_2',
        company: 'Tokobangun Tidur Lagi',
        dates: { start: '2019-08', end: '2022-02' },
        text: {
          id: {
            role: 'Programmer',
            team: 'POS & Analitik Penjualan',
            location: 'Bandung',
            bullets: [
              'Membangun dasbor analitik penjualan yang digunakan oleh lebih dari 12.000 merchant aktif.',
              'Memangkas waktu muat halaman katalog sebesar 55% melalui pemecahan bundel dan caching sisi tepi.',
            ],
          },
          en: {
            role: 'Software Engineer',
            team: 'POS & Seller Analytics',
            location: 'Bandung',
            bullets: [
              'Built the seller analytics dashboard used by over 12,000 active merchants.',
              'Cut catalogue page load time by 55% through bundle splitting and edge caching.',
            ],
          },
        },
      },
    ],
    education: [
      {
        id: 'edu_sample_1',
        gpa: '3.72 / 4.00',
        dates: { start: '2015-08', end: '2019-07' },
        text: {
          id: {
            school: 'Institut Teknologi Bandung',
            degree: 'Sarjana Teknik',
            field: 'Teknik Informatika',
            description: 'Tugas akhir mengenai penjadwalan tugas terdistribusi pada kluster heterogen.',
          },
          en: {
            school: 'Bandung Institute of Technology',
            degree: 'Bachelor of Engineering',
            field: 'Informatics Engineering',
            description: 'Final project on distributed task scheduling across heterogeneous clusters.',
          },
        },
      },
    ],
    projects: [
      {
        id: 'prj_sample_1',
        link: 'https://github.com/example/Ngantre',
        techStack: ['TypeScript', 'PostgreSQL', 'Redis'],
        dates: { start: '2023-02', end: '2023-11' },
        text: {
          id: {
            name: 'Ngantre',
            role: 'Pencipta',
            description:
              'Libary antrean pekerjaan ringan untuk Node.js dengan jaminan pengiriman.',
            bullets: [
              'Mencapai 1.200 bintang di GitHub dan diadopsi oleh tiga perusahaan.',
              'Menulis dokumentasi dwibahasa serta rangkaian uji dengan cakupan 94%.',
            ],
          },
          en: {
            name: 'Antrean',
            role: 'Author',
            description:
              'A lightweight job queue library for Node.js with delivery guarantees.',
            bullets: [
              'Reached 1,200 GitHub stars and production use at three companies.',
              'Wrote bilingual documentation and a test suite at 94% coverage.',
            ],
          },
        },
      },
    ],
    skills: [
      {
        id: 'skl_sample_1',
        text: {
          id: {
            title: 'Bahasa & Kerangka Kerja',
            items: ['TypeScript', 'Go', 'Python', 'Svelte', 'Node.js'],
          },
          en: {
            title: 'Languages & Frameworks',
            items: ['TypeScript', 'Go', 'Python', 'Svelte', 'Node.js'],
          },
        },
      },
      {
        id: 'skl_sample_2',
        text: {
          id: {
            title: 'Infrastruktur',
            items: ['PostgreSQL', 'Redis', 'Kubernetes', 'Terraform', 'GitHub Actions'],
          },
          en: {
            title: 'Infrastructure',
            items: ['PostgreSQL', 'Redis', 'Kubernetes', 'Terraform', 'GitHub Actions'],
          },
        },
      },
    ],
    awards: [
      {
        id: 'awd_sample_1',
        date: '2024-05',
        text: {
          id: {
            title: 'Penghargaan Programmer Terbaik 2026',
            issuer: 'PT Arkasa Melanglang Buana',
            description: 'Diberikan atas kepemimpinan teknis pada migrasi platform pembayaran.',
          },
          en: {
            title: 'Engineer of the Year',
            issuer: 'PT Arkasa Melanglang Buana',
            description: 'Awarded for technical leadership on the payments platform migration.',
          },
        },
      },
    ],
  },
})

/** Key order differs after a storage round trip (validation rebuilds objects), so sort it away. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  )

const SAMPLE = canonical(sampleDocument())

/** True only for the bundled sample, untouched; a returning user's resume never matches. */
export const isSampleDocument = (doc: ResumeDocument): boolean => canonical(doc) === SAMPLE
