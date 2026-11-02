import { createId, dateRange, idOf, isRecord, str, strArray, textNode } from '$lib/model/coerce'
import type { ExperienceItem, ExperienceText } from '$lib/model/types'
import type { SectionModule } from '../types'

const text = (raw: unknown): ExperienceText => {
  const value = isRecord(raw) ? raw : {}
  return {
    role: str(value.role),
    team: str(value.team),
    location: str(value.location),
    bullets: strArray(value.bullets),
  }
}

const experience: SectionModule<ExperienceItem, ExperienceText> = {
  kind: 'experience',
  order: 0,
  labelKey: 'section.experience',
  translatableFields: ['role', 'team', 'location', 'bullets'],
  emptyItem: () => ({
    id: createId('exp'),
    company: '',
    dates: { start: '', end: null },
    text: textNode(undefined, text),
  }),
  validate: (input) =>
    (Array.isArray(input) ? input : []).filter(isRecord).map((raw) => ({
      id: idOf(raw, 'exp'),
      company: str(raw.company),
      dates: dateRange(raw.dates),
      text: textNode(raw.text, text),
    })),
}

export default experience
