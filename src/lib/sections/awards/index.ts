import { createId, idOf, isRecord, str, textNode } from '$lib/model/coerce'
import type { AwardItem, AwardText } from '$lib/model/types'
import type { SectionModule } from '../types'

export const awardText = (raw: unknown): AwardText => {
  const value = isRecord(raw) ? raw : {}
  return {
    title: str(value.title),
    issuer: str(value.issuer),
    description: str(value.description),
  }
}

const awards: SectionModule<AwardItem, AwardText> = {
  kind: 'awards',
  order: 4,
  labelKey: 'section.awards',
  translatableFields: ['title', 'issuer', 'description'],
  emptyItem: () => ({ id: createId('awd'), date: '', text: textNode(undefined, awardText) }),
  validate: (input) =>
    (Array.isArray(input) ? input : []).filter(isRecord).map((raw) => ({
      id: idOf(raw, 'awd'),
      date: str(raw.date),
      text: textNode(raw.text, awardText),
    })),
}

export default awards
