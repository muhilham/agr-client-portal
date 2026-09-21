'use client'

/**
 * Strips the `src` query param from the current URL without a re-render or
 * history entry, so shared/bookmarked links never carry stale attribution.
 * Only touches `src` — `reorder` and any other params are preserved.
 */
export function stripSrcParamFromUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('src')) return
  url.searchParams.delete('src')
  window.history.replaceState(window.history.state, '', url.toString())
}
