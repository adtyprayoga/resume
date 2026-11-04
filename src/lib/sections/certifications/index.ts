import { createId, idOf, isRecord, str, textNode } from '$lib/model/coerce'
import type { CertificationItem, AwardText } from '$lib/model/types'
import type { SectionModule } from '../types'
import { awardText } from '../awards'

const certifications: SectionModule<CertificationItem, AwardText> = {
  kind: 'certifications',
  order: 5,
  labelKey: 'section.certifications',
  translatableFields: ['title', 'issuer', 'description'],
  emptyItem: () => ({ id: createId('crt'), date: '', text: textNode(undefined, awardText) }),
  validate: (input) =>
    (Array.isArray(input) ? input : []).filter(isRecord).map((raw) => ({
      id: idOf(raw, 'crt'),
      date: str(raw.date),
      text: textNode(raw.text, awardText),
    })),
}

export default certifications
