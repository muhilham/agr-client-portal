export interface RemotePathPattern {
  protocol?: string
  hostname: string
  port?: string
  pathname?: string
  search?: string
}

/**
 * Mirror of Next.js `remotePatterns` path matching (lib/match-pattern):
 * `**` matches any characters including `/`, `*` and `?` exclude `/`.
 * Kept intentionally strict so the config test in this folder fails on
 * a pattern that Next.js itself would reject (and vice versa).
 */
export function pathnameMatches(pathname: string, pattern: string): boolean {
  const re = patternToRegex(pattern)
  if (re === null) return false
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  return re.test(normalized)
}

function patternToRegex(pattern: string): RegExp | null {
  // Next.js rejects patterns without a leading slash
  if (!pattern.startsWith('/')) return null
  let out = ''
  for (const char of pattern) {
    switch (char) {
      case '*':
        out += '\u0000STAR\u0000'
        break
      case '?':
        out += '[^/]'
        break
      default:
        out += char.replace(/[.+^${}()|[\]\\/]/g, '\\$&')
    }
  }
  // collapse '**' pairs (and longer runs) into '.*'; single '*' → '[^/]*'
  out = out.replace(/(\u0000STAR\u0000){2,}/g, '\u0000GLOBSTAR\u0000')
  out = out.replace(/\u0000STAR\u0000/g, '[^/]*')
  out = out.replace(/\u0000GLOBSTAR\u0000/g, '.*')
  return new RegExp(`^${out}$`)
}

export function matchPattern(pattern: RemotePathPattern, url: URL): boolean {
  if (url.protocol !== `${pattern.protocol ?? 'https'}:`) return false
  if (url.hostname !== pattern.hostname) return false
  if (pattern.port !== undefined && pattern.port !== '' && url.port !== pattern.port) {
    return false
  }
  if (pattern.pathname !== undefined && !pathnameMatches(url.pathname, pattern.pathname)) {
    return false
  }
  if (pattern.search !== undefined) {
    const search = url.search.replace(/^\?/, '')
    if (pattern.search === '') return search === ''
    const re = patternToRegex(`/${pattern.search}`)
    if (!re || !re.test(`/${search}`)) return false
  }
  return true
}
