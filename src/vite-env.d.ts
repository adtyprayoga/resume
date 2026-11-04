/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module '*?inline' {
  const dataUrl: string
  export default dataUrl
}

interface ImportMetaEnv {
  /** "1" in the combined deployment, which proxies /api/pdf-import to the PDF service. */
  readonly VITE_PDF_IMPORT?: string
}
