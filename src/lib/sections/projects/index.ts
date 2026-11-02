import { createId, dateRange, idOf, isRecord, str, strArray, textNode } from '$lib/model/coerce'
import { safeHref } from '$lib/model/sanitize'
import type { ProjectItem, ProjectText } from '$lib/model/types'
import type { SectionModule } from '../types'

const text = (raw: unknown): ProjectText => {
  const value = isRecord(raw) ? raw : {}
  return {
    name: str(value.name),
    role: str(value.role),
    description: str(value.description),
    bullets: strArray(value.bullets),
  }
}

const projects: SectionModule<ProjectItem, ProjectText> = {
  kind: 'projects',
  order: 2,
  labelKey: 'section.projects',
  translatableFields: ['name', 'role', 'description', 'bullets'],
  emptyItem: () => ({
    id: createId('prj'),
    link: '',
    techStack: [],
    dates: { start: '', end: null },
    text: textNode(undefined, text),
  }),
  validate: (input) =>
    (Array.isArray(input) ? input : []).filter(isRecord).map((raw) => ({
      id: idOf(raw, 'prj'),
      link: safeHref(str(raw.link)),
      techStack: strArray(raw.techStack),
      dates: dateRange(raw.dates),
      text: textNode(raw.text, text),
    })),
}

export default projects
