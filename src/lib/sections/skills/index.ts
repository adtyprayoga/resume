import { createId, idOf, isRecord, str, strArray, textNode } from '$lib/model/coerce'
import type { SkillGroup, SkillText } from '$lib/model/types'
import type { SectionModule } from '../types'

const text = (raw: unknown): SkillText => {
  const value = isRecord(raw) ? raw : {}
  return { title: str(value.title), items: strArray(value.items) }
}

const skills: SectionModule<SkillGroup, SkillText> = {
  kind: 'skills',
  order: 3,
  labelKey: 'section.skills',
  translatableFields: ['title', 'items'],
  emptyItem: () => ({ id: createId('skl'), text: textNode(undefined, text) }),
  validate: (input) =>
    (Array.isArray(input) ? input : []).filter(isRecord).map((raw) => ({
      id: idOf(raw, 'skl'),
      text: textNode(raw.text, text),
    })),
}

export default skills
