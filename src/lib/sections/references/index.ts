import { createId, idOf, isRecord, str, textNode } from '$lib/model/coerce'
import type { ReferenceItem, ReferenceText } from '$lib/model/types'
import type { SectionModule } from '../types'

const referenceText = (input: unknown): ReferenceText => {
  const raw = isRecord(input) ? input : {}
  return { name: str(raw.name), position: str(raw.position), note: str(raw.note) }
}
const references: SectionModule<ReferenceItem, ReferenceText> = {
  kind: 'references',
  order: 6,
  labelKey: 'section.references',
  translatableFields: ['name', 'position', 'note'],
  emptyItem: () => ({ id: createId('ref'), phone: '', email: '', text: textNode(undefined, referenceText) }),
  validate: (input) => (Array.isArray(input) ? input : []).filter(isRecord).map((raw) => ({
    id: idOf(raw, 'ref'),
    phone: str(raw.phone),
    email: str(raw.email),
    text: textNode(raw.text, referenceText),
  })),
}
export default references
