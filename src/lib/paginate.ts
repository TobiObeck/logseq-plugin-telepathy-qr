/**
 * Splits a page into chunks small enough to fit in a single QR code.
 *
 * The budget is expressed in UTF-8 bytes because that is what the QR encoder
 * counts. 2900 stays under the 2953 byte ceiling of a version 40 symbol at
 * error correction level L, which leaves the symbol dense enough that a phone
 * camera still reads it comfortably.
 */
export const PART_BYTE_BUDGET = 2900

const encoder = new TextEncoder()

const byteLength = (text: string): number => encoder.encode(text).length

/** Largest prefix of `text` whose UTF-8 encoding stays within `budget`. */
const fitInBytes = (text: string, budget: number): number => {
  if (byteLength(text) <= budget) return text.length

  let low = 0
  let high = text.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (byteLength(text.slice(0, middle)) <= budget) {
      low = middle
    } else {
      high = middle - 1
    }
  }
  return low
}

/** Matches every line together with its trailing newline, if it has one. */
const toLines = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/g) ?? []

/**
 * Packs whole lines into a part until the next one would overflow, so a scan
 * never cuts a line in half. A single line longer than the budget on its own
 * (a minified blob or a long data URI) is hard split as a last resort, since
 * otherwise it could never be encoded at all.
 */
export const paginate = (text: string, budget = PART_BYTE_BUDGET): string[] => {
  const parts: string[] = []
  let current = ''

  for (const line of toLines(text)) {
    const candidate = current + line
    if (current !== '' && byteLength(candidate) > budget) {
      parts.push(current)
      current = line
    } else {
      current = candidate
    }

    while (byteLength(current) > budget) {
      const cut = fitInBytes(current, budget)
      parts.push(current.slice(0, cut))
      current = current.slice(cut)
    }
  }

  if (current !== '') parts.push(current)
  return parts.length > 0 ? parts : ['']
}