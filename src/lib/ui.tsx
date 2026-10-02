import type { ReactNode } from "react"
import type { BookingStatus } from "../data/mock"

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`bg-card border border-line rounded-sm ${className}`}>
      {children}
    </section>
  )
}

export function PanelHead({
  title,
  desc,
  right,
}: {
  title: string
  desc?: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
      <div>
        <h3 className="font-serif text-[17px] leading-tight text-ink">
          {title}
        </h3>
        {desc && <p className="text-[12.5px] text-ink-faint mt-0.5">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

const statusTone: Record<BookingStatus, { fg: string; bg: string; dot: string }> =
  {
    "Payment Verified": { fg: "text-info", bg: "bg-info-soft", dot: "bg-info" },
    "Manager Review": { fg: "text-warn", bg: "bg-warn-soft", dot: "bg-warn" },
    "Manager Confirmed": {
      fg: "text-forest",
      bg: "bg-forest-soft",
      dot: "bg-forest",
    },
    "Admin Review": {
      fg: "text-saffron-deep",
      bg: "bg-saffron-soft",
      dot: "bg-saffron",
    },
    Confirmed: { fg: "text-ok", bg: "bg-ok-soft", dot: "bg-ok" },
    "In Service": { fg: "text-info", bg: "bg-info-soft", dot: "bg-info" },
    Completed: {
      fg: "text-ink-soft",
      bg: "bg-paper-deep",
      dot: "bg-ink-faint",
    },
    Rejected: { fg: "text-danger", bg: "bg-danger-soft", dot: "bg-danger" },
    Cancelled: { fg: "text-danger", bg: "bg-danger-soft", dot: "bg-danger" },
    "Driver Assigned": { fg: "text-info", bg: "bg-info-soft", dot: "bg-info" },
    "En Route": { fg: "text-saffron-deep", bg: "bg-saffron-soft", dot: "bg-saffron" },
    "At Altar": { fg: "text-forest", bg: "bg-forest-soft", dot: "bg-forest" },
  }

export function StatusPill({ status }: { status: BookingStatus }) {
  const t = statusTone[status] || {
    fg: "text-ink-soft",
    bg: "bg-paper-deep",
    dot: "bg-ink-faint",
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${t.bg} ${t.fg} rounded-full pl-1.5 pr-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {status}
    </span>
  )
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "ok" | "warn" | "danger" | "info" | "saffron"
}) {
  const map: Record<string, string> = {
    neutral: "bg-paper-deep text-ink-soft",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
    saffron: "bg-saffron-soft text-saffron-deep",
  }
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}
    >
      {children}
    </span>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </div>
  )
}
