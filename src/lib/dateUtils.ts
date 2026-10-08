/**
 * Standard Date Formatting & Normalization Utilities for GOMAA
 * Ensures consistent Indian date formats (e.g. "5 Oct 2026") across all views,
 * preventing duplicate date entries in filters and selectors (e.g. "05 Oct 2026" vs "5 Oct 2026").
 */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

/**
 * Normalizes any date string or Date object to the standard "D Mon YYYY" format (e.g. "5 Oct 2026").
 * Strips leading zeros so that "05 Oct 2026" and "5 Oct 2026" become identical.
 */
export function normalizeDateStr(d: string | Date | null | undefined): string {
  if (!d) return ""

  if (d instanceof Date) {
    if (isNaN(d.getTime())) return ""
    const day = d.getDate()
    const month = MONTH_NAMES[d.getMonth()]
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  }

  const s = String(d).trim()
  if (!s) return ""

  // Case 1: Standard or zero-padded "05 Oct 2026" or "5 Oct 2026" or "05-Oct-2026"
  const dmyMatch = s.match(/^0*(\d+)[-\s]+([A-Za-z]+)[-\s]+(\d{4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const mStr = dmyMatch[2].toLowerCase()
    const monthIndex = MONTH_MAP[mStr]
    const month = monthIndex !== undefined ? MONTH_NAMES[monthIndex] : dmyMatch[2]
    const year = dmyMatch[3]
    return `${day} ${month} ${year}`
  }

  // Case 2: ISO "2026-10-05" or "2026-10-5"
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoMatch) {
    const year = isoMatch[1]
    const mNum = parseInt(isoMatch[2], 10) - 1
    const day = parseInt(isoMatch[3], 10)
    const month = MONTH_NAMES[mNum] || "Oct"
    return `${day} ${month} ${year}`
  }

  // Case 3: Fallback generic split
  const parts = s.split(/[\s-]+/)
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    if (!isNaN(day)) {
      const mStr = parts[1].toLowerCase()
      const monthIndex = MONTH_MAP[mStr]
      const month = monthIndex !== undefined ? MONTH_NAMES[monthIndex] : parts[1]
      return `${day} ${month} ${parts[2]}`
    }
  }

  // Case 4: Native Date parse attempt
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getDate()} ${MONTH_NAMES[parsed.getMonth()]} ${parsed.getFullYear()}`
  }

  return s
}

/**
 * Returns today's date in canonical format (e.g. "5 Oct 2026").
 */
export function getTodayReference(): string {
  return normalizeDateStr(new Date())
}

/**
 * Compares two dates safely by normalizing them first.
 */
export function isSameDate(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): boolean {
  if (!a || !b) return false
  return normalizeDateStr(a) === normalizeDateStr(b)
}

/**
 * Returns millisecond timestamp for chronological sorting.
 */
export function parseDateTimestamp(s: string): number {
  if (!s) return 0
  const norm = normalizeDateStr(s)
  const parts = norm.split(" ")
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const mStr = parts[1].toLowerCase()
    const month = MONTH_MAP[mStr] ?? 8
    const year = parseInt(parts[2], 10)
    return new Date(year, month, day).getTime()
  }
  const fallback = new Date(s).getTime()
  return isNaN(fallback) ? 0 : fallback
}

/**
 * Formats a date label for compact tabs/chips (e.g. "5 Oct").
 */
export function getDateChipLabel(d: string): string {
  const norm = normalizeDateStr(d)
  const parts = norm.split(" ")
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`
  }
  return norm
}
