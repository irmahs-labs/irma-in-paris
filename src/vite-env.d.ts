/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The account service; set locally, where its cookie is localhost's. */
  readonly VITE_AUTH_URL?: string;
}
