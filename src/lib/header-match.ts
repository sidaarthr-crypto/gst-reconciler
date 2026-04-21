/** Collapse newlines / repeated spaces for header matching (GSTN-style multi-line headers). */
export function collapseHeaderText(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/₹/g, "")
    .trim()
}

function tokenizeHeader(raw: string): string[] {
  return collapseHeaderText(raw)
    .replace(/\([^)]*\)/g, " ")
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function tokensSubsequence(headerTokens: string[], aliasTokens: string[]): boolean {
  let j = 0
  for (const t of headerTokens) {
    if (j < aliasTokens.length && t === aliasTokens[j]) {
      j += 1
    }
  }
  return j === aliasTokens.length
}

export function headerMatchesAlias(rawHeader: string, alias: string): boolean {
  const collapsed = collapseHeaderText(rawHeader)
  const a = alias.toLowerCase().trim()
  if (!a) return false
  if (collapsed === a) return true
  if (collapsed.includes(`(${a})`)) return true

  const aliasParts = a.split(/\s+/).filter(Boolean)
  if (aliasParts.length >= 2) {
    const headerTokens = tokenizeHeader(rawHeader)
    return tokensSubsequence(headerTokens, aliasParts)
  }

  if (a.length <= 3) {
    const headerTokens = tokenizeHeader(rawHeader)
    return headerTokens.includes(a)
  }

  return collapsed.includes(a)
}

/** Resolve a header cell name from the sheet when any alias matches (same rules as parser). */
export function findHeaderForAliases(
  headers: string[],
  aliases: readonly string[],
): string | null {
  const sortedAliases = [...aliases].sort((x, y) => y.length - x.length)

  for (const alias of sortedAliases) {
    const a = alias.toLowerCase().trim()
    const normalisedHeaders = headers.map((h) => collapseHeaderText(h))
    const idxExact = normalisedHeaders.findIndex((h) => h === a)
    if (idxExact !== -1) return headers[idxExact]!
  }

  for (const raw of headers) {
    for (const alias of sortedAliases) {
      if (headerMatchesAlias(raw, alias)) {
        return raw
      }
    }
  }
  return null
}
