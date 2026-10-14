import { lazy, type ComponentType } from 'react'

const KEY = 'op.chunkReload'

/** True for the browser's "this page file is gone" errors, which happen when a tab opened before a deploy asks for an old file. */
export function isStaleChunkError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i.test(m)
}

/**
 * React.lazy for a page that survives a deploy: if the page file is missing (the tab still has the old build), reload once to get the
 * new build instead of showing an error. A second failure right after the reload is a real error and is shown.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches React.lazy, which accepts any component props
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const page = await load()
      try { sessionStorage.removeItem(KEY) } catch { /* storage may be blocked */ }
      return page
    } catch (e) {
      let reloaded = false
      try { reloaded = sessionStorage.getItem(KEY) === location.pathname } catch { /* storage may be blocked */ }
      if (isStaleChunkError(e) && !reloaded) {
        try { sessionStorage.setItem(KEY, location.pathname) } catch { /* reload anyway */ }
        location.reload()
        return new Promise<{ default: T }>(() => {})
      }
      throw e
    }
  })
}
