import { createId, dateRange, idOf, isRecord, str, textNode } from '$lib/model/coerce'
import type { EducationItem, EducationText } from '$lib/model/types'
import type { SectionModule } from '../types'

const text = (raw: unknown): EducationText => {
  const value = isRecord(raw) ? raw : {}
  return {
    school: str(value.school),
    degree: str(value.degree),
    field: str(value.field),
    description: str(value.description),
  }
}

const education: SectionModule<EducationItem, EducationText> = {
  kind: 'education',
  order: 1,
  labelKey: 'section.education',
  translatableFields: ['school', 'degree', 'field', 'description'],
  emptyItem: () => ({
    id: createId('edu'),
    gpa: '',
    dates: { start: '', end: null },
    text: textNode(undefined, text),
  }),
  validate: (input) =>
    (Array.isArray(input) ? input : []).filter(isRecord).map((raw) => ({
      id: idOf(raw, 'edu'),
      gpa: str(raw.gpa),
      dates: dateRange(raw.dates),
      text: textNode(raw.text, text),
    })),
}

export default education
