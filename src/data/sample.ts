// `?inline` emits a data URL at build time, so the sample document is
// self-contained: its photo survives a JSON export the same way a user's does.
import avatarSample from './avatar-sample.jpg?inline'
import { emptyDocument } from '$lib/model/document'
import type { ResumeDocument } from '$lib/model/types'

/** First-run content and test fixture. Entirely fictional. */
export const sampleDocument = (): ResumeDocument => ({
  ...emptyDocument(),
  contact: {
    email: 'budi.santoso@example.com',
    phone: '+62 811 2345 678',
    website: 'https://budisantoso.example.com',
    github: 'https://github.com/example',
    linkedin: 'https://linkedin.com/in/example',
    avatar: avatarSample,
  },
  profile: {
    text: {
      id: {
        name: 'Budi Santoso',
        headline: 'Perekayasa Perangkat Lunak Senior',
        location: 'Jakarta, Indonesia',
        summary:
          'Perekayasa perangkat lunak dengan tujuh tahun pengalaman membangun layanan backend dan antarmuka web berskala besar. Fokus pada keandalan sistem, kualitas data, dan pendampingan rekan tim.',
      },
      en: {
        name: 'Budi Santoso',
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
        company: 'PT Nusantara Digital',
        dates: { start: '2022-03', end: null, current: true },
        text: {
          id: {
            role: 'Perekayasa Perangkat Lunak Senior',
            team: 'Platform Pembayaran',
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
        company: 'Tokobangun',
        dates: { start: '2019-08', end: '2022-02' },
        text: {
          id: {
            role: 'Perekayasa Perangkat Lunak',
            team: 'Pengalaman Penjual',
            location: 'Bandung',
            bullets: [
              'Membangun dasbor analitik penjual yang digunakan oleh lebih dari 12.000 merchant aktif.',
              'Memangkas waktu muat halaman katalog sebesar 55% melalui pemecahan bundel dan caching sisi tepi.',
            ],
          },
          en: {
            role: 'Software Engineer',
            team: 'Seller Experience',
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
        link: 'https://github.com/example/antrean',
        techStack: ['TypeScript', 'PostgreSQL', 'Redis'],
        dates: { start: '2023-02', end: '2023-11' },
        text: {
          id: {
            name: 'Antrean',
            role: 'Penulis',
            description:
              'Pustaka antrean pekerjaan ringan untuk Node.js dengan jaminan pengiriman tepat sekali.',
            bullets: [
              'Mencapai 1.200 bintang GitHub dan dipakai pada produksi oleh tiga perusahaan.',
              'Menulis dokumentasi dwibahasa serta rangkaian uji dengan cakupan 94%.',
            ],
          },
          en: {
            name: 'Antrean',
            role: 'Author',
            description:
              'A lightweight job queue library for Node.js with exactly-once delivery guarantees.',
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
            title: 'Penghargaan Perekayasa Tahun Ini',
            issuer: 'PT Nusantara Digital',
            description: 'Diberikan atas kepemimpinan teknis pada migrasi platform pembayaran.',
          },
          en: {
            title: 'Engineer of the Year',
            issuer: 'PT Nusantara Digital',
            description: 'Awarded for technical leadership on the payments platform migration.',
          },
        },
      },
    ],
  },
})

const SAMPLE_JSON = JSON.stringify(sampleDocument())

/** True only for the bundled sample, untouched; a returning user's resume never matches. */
export const isSampleDocument = (doc: ResumeDocument): boolean => JSON.stringify(doc) === SAMPLE_JSON
