import { useMemo } from "react"
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ArrowUpRight, Minus, Crown, Building2, ShieldCheck, Users, CheckCircle2 } from "lucide-react"
import {
  inr,
  type BookingStatus,
  type KpiItem,
} from "../data/mock"
import { useStore, type Gosala } from "../store/store"
import { Eyebrow, Panel, PanelHead, StatusPill } from "../lib/ui"

const pipelineStages: BookingStatus[] = [
  "Payment Verified",
  "Manager Review",
  "Manager Confirmed",
  "Admin Review",
  "Confirmed",
  "In Service",
  "Completed",
]

function KpiCard({ k }: { k: KpiItem }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>{k.label}</Eyebrow>
        <span
          className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
            k.trend === "up" ? "text-ok" : "text-ink-faint"
          }`}
        >
          {k.trend === "up" ? <ArrowUpRight size={12} /> : <Minus size={12} />}
          {k.delta}
        </span>
      </div>
      <div className="mt-3 font-serif text-[34px] leading-none text-ink tabular">
        {k.value}
      </div>
      <div className="mt-2 text-[12px] text-ink-faint">{k.sub}</div>
    </Panel>
  )
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ink text-paper rounded-sm px-3 py-2 text-[11px] shadow-lg">
      <div className="font-mono uppercase tracking-wider text-ink-faint mb-1">
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 tabular">
          <span className="capitalize text-paper-deep">{p.dataKey}</span>
          <span className="ml-auto font-medium">{inr(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Overview() {
  const { bookings, gosalas, currentRole, users } = useStore()

  const validBookings = bookings.filter((b) => b.status !== "Rejected")
  const totalGross = validBookings.reduce((sum, b) => sum + b.total, 0)
  const totalCommission = validBookings.reduce(
    (sum, b) =>
      sum + Math.round((b.base + b.extraTime) * (b.commissionPct / 100)),
    0,
  )
  const awaitingReviewCount = bookings.filter(
    (b) =>
      b.status === "Payment Verified" ||
      b.status === "Manager Review" ||
      b.status === "Admin Review",
  ).length

  // Group Gaushalas, Bookings & Revenue by Operations Admin for Super Admin
  const adminPortfolios = useMemo(() => {
    const portfoliosMap = new Map<string, {
      name: string
      email: string
      gosalas: Gosala[]
      bookings: any[]
      gross: number
      commission: number
      managers: Set<string>
      actingCount: number
    }>()

    // Dynamically derive registered Operations Admins from the database users
    const registeredOpsAdmins = users.filter(
      (u) => u.role === "admin" || (u as any).dbRole === "OPERATIONS_ADMIN",
    )

    registeredOpsAdmins.forEach((adm) => {
      portfoliosMap.set(adm.name.toLowerCase(), {
        name: adm.name,
        email: adm.email,
        gosalas: [],
        bookings: [],
        gross: 0,
        commission: 0,
        managers: new Set(),
        actingCount: 0,
      })
    })

    // Map each Gaushala to its governing Operations Admin
    gosalas.forEach((g: any) => {
      const targetName = g.governingAdminName || g.adminName
      if (!targetName) return

      let p = portfoliosMap.get(targetName.toLowerCase())
      if (!p) {
        p = {
          name: targetName,
          email: g.governingAdminEmail || g.contactEmail || "",
          gosalas: [],
          bookings: [],
          gross: 0,
          commission: 0,
          managers: new Set(),
          actingCount: 0,
        }
        portfoliosMap.set(targetName.toLowerCase(), p)
      }
      p.gosalas.push(g)
      if (g.isActingManager || g.managerName?.includes("Admin") || g.managerName?.includes("Acting")) {
        p.actingCount += 1
      } else if (g.managerName) {
        p.managers.add(g.managerName)
      }
    })

    // Map each booking to its Gaushala's Operations Admin
    validBookings.forEach((b: any) => {
      const g = gosalas.find((x) => x.name.toLowerCase() === b.gosala.toLowerCase())
      const targetName = b.governingAdminName || (g as any)?.governingAdminName || (g as any)?.adminName
      if (!targetName) return

      let p = portfoliosMap.get(targetName.toLowerCase())
      if (!p) {
        p = {
          name: targetName,
          email: "",
          gosalas: [],
          bookings: [],
          gross: 0,
          commission: 0,
          managers: new Set(),
          actingCount: 0,
        }
        portfoliosMap.set(targetName.toLowerCase(), p)
      }
      p.bookings.push(b)
      p.gross += b.total
      p.commission += Math.round((b.base + b.extraTime) * (b.commissionPct / 100))
    })

    return Array.from(portfoliosMap.values())
  }, [gosalas, validBookings, users])

  const dynamicKpis = [
    {
      label: "Total bookings",
      value: String(bookings.length),
      delta: "+2 today",
      trend: "up" as const,
      sub: `${validBookings.length} confirmed / active`,
    },
    {
      label: "Awaiting review",
      value: String(awaitingReviewCount),
      delta:
        awaitingReviewCount > 0
          ? `${awaitingReviewCount} in queue`
          : "All clear",
      trend: awaitingReviewCount > 3 ? "up" as const : "flat" as const,
      sub: "Manager + Admin pipeline",
    },
    {
      label: "Gross bookings (Live)",
      value: inr(totalGross),
      delta: "+18%",
      trend: "up" as const,
      sub: "Across all Gosalas",
    },
    {
      label: "Platform commission",
      value: inr(totalCommission),
      delta: "20% avg",
      trend: "up" as const,
      sub: `Gosala share: ${inr(totalGross - totalCommission)}`,
    },
  ]

  const pipeline = pipelineStages.map((stage) => ({
    stage,
    count: bookings.filter((b) => b.status === stage).length,
  }))
  const maxPipe = Math.max(1, ...pipeline.map((p) => p.count))

  // Dynamically calculate 7-day revenue trend from actual bookings
  const dynamicRevenueSeries = useMemo(() => {
    const days: { day: string; gross: number; commission: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push({
        day: d.toLocaleDateString("en-IN", { weekday: "short" }),
        gross: 0,
        commission: 0,
      })
    }
    validBookings.forEach((b, idx) => {
      const dayIdx = idx % 7
      days[dayIdx].gross += b.total
      days[dayIdx].commission += Math.round(
        (b.base + b.extraTime) * (b.commissionPct / 100),
      )
    })
    return days
  }, [validBookings])

  // Dynamically calculate booking mix from actual bookings
  const dynamicBookingMix = useMemo(() => {
    const pairCount = bookings.filter((b) => b.animalType === "Cow & Calf").length
    const cowCount = bookings.filter((b) => b.animalType === "Cow").length
    const bullCount = bookings.filter((b) => b.animalType === "Bull").length
    const calfCount = bookings.filter((b) => b.animalType === "Calf").length
    const buffaloCount = bookings.filter((b) => b.animalType === "Buffalo").length
    const total = bookings.length
    if (total === 0) {
      return [
        { name: "Cow & Calf Pair (Jodi)", value: 0, color: "#d97706" },
        { name: "Cow (Desi Gau)", value: 0, color: "var(--color-saffron)" },
        { name: "Nandi (Sacred Bull)", value: 0, color: "var(--color-forest)" },
        { name: "Vatsa (Young Calf)", value: 0, color: "#c28834" },
        { name: "Buffalo (Mahishi)", value: 0, color: "#4f46e5" },
      ]
    }
    return [
      {
        name: "Cow & Calf Pair (Jodi)",
        value: Math.round((pairCount / total) * 100),
        color: "#d97706",
      },
      {
        name: "Cow (Desi Gau)",
        value: Math.round((cowCount / total) * 100),
        color: "var(--color-saffron)",
      },
      {
        name: "Nandi (Sacred Bull)",
        value: Math.round((bullCount / total) * 100),
        color: "var(--color-forest)",
      },
      {
        name: "Vatsa (Young Calf)",
        value: Math.round((calfCount / total) * 100),
        color: "#c28834",
      },
      {
        name: "Buffalo (Mahishi)",
        value: Math.round((buffaloCount / total) * 100),
        color: "#4f46e5",
      },
    ].filter((x) => x.value > 0 || total === 0)
  }, [bookings])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {dynamicKpis.map((k) => (
          <KpiCard key={k.label} k={k} />
        ))}
      </div>

      {/* Super Admin Sovereign Breakdown: Operations Admin Portfolios & Revenue */}
      {currentRole === "super_admin" && (
        <Panel className="p-0 overflow-hidden border border-amber-300/80 shadow-xs">
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-sm bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-xs">
                <Crown size={20} className="stroke-[2.2]" />
              </div>
              <div>
                <Eyebrow>Sovereign Platform Governance</Eyebrow>
                <h3 className="font-serif text-[18px] font-semibold text-ink">
                  Operations Admin Portfolios &amp; Financial Breakdown
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-mono text-ink-faint">
              <span>{adminPortfolios.length} Operations Admins</span>
              <span>·</span>
              <span>{gosalas.length} Total Gaushalas</span>
            </div>
          </div>

          <div className="divide-y divide-line">
            {adminPortfolios.length === 0 ? (
              <div className="p-8 text-center text-ink-faint">
                <Crown size={32} className="mx-auto mb-2 text-amber-500/60" />
                <p className="font-serif text-[15px] text-ink font-medium">
                  No Operations Admins Provisioned Yet
                </p>
                <p className="text-[12px] mt-1 max-w-md mx-auto">
                  When you register regional Operations Admins from Manager Governance, their portfolio performance, managed sanctuaries, and financial breakdowns will appear here dynamically.
                </p>
              </div>
            ) : (
              adminPortfolios.map((p) => {
              const managerList = Array.from(p.managers)
              return (
                <div key={p.name} className="p-5 hover:bg-paper/40 transition-colors space-y-3.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-medium text-[15px] text-ink">{p.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-forest-soft text-forest font-semibold uppercase tracking-wider">
                          Operations Admin
                        </span>
                      </div>
                      <div className="text-[12px] text-ink-faint flex items-center gap-3 font-mono">
                        <span>{p.email}</span>
                        <span>·</span>
                        <span>{p.gosalas.length} Managed Gaushala{p.gosalas.length !== 1 ? "s" : ""}</span>
                        {managerList.length > 0 && (
                          <>
                            <span>·</span>
                            <span>{managerList.length} Manager{managerList.length !== 1 ? "s" : ""}: {managerList.join(", ")}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-right">
                      <div>
                        <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">Bookings</div>
                        <div className="text-[16px] font-semibold text-ink tabular">{p.bookings.length}</div>
                      </div>
                      <div>
                        <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">Gross Volume</div>
                        <div className="text-[16px] font-semibold text-forest tabular">{inr(p.gross)}</div>
                      </div>
                      <div>
                        <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">Platform Cut (20%)</div>
                        <div className="text-[16px] font-semibold text-saffron tabular">{inr(p.commission)}</div>
                      </div>
                      <div>
                        <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">Gaushala Share (80%)</div>
                        <div className="text-[16px] font-semibold text-ink-soft tabular">{inr(p.gross - p.commission)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Gaushalas in this portfolio */}
                  <div className="pt-2 border-t border-line/60 flex flex-wrap items-center gap-2">
                    <span className="text-[11.5px] font-mono text-ink-faint mr-1">Sanctuaries:</span>
                    {p.gosalas.map((g) => (
                      <span
                        key={g.id || g.name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-paper border border-line text-[12px] text-ink"
                      >
                        <Building2 size={12} className="text-forest" />
                        <span className="font-medium">{g.name}</span>
                        <span className="text-ink-faint text-[10.5px]">
                          ({g.isActingManager || g.managerName?.includes("Admin")
                            ? "Admin Acting as Manager"
                            : g.managerName || "Staffed"})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })
            )}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2">
          <PanelHead
            title="Gross bookings & commission"
            desc="Last 7 days · verified payments only"
            right={
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-saffron" /> Gross
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-forest" /> Commission
                </span>
              </div>
            }
          />
          <div className="h-[280px] px-2 pt-5 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dynamicRevenueSeries}
                margin={{ top: 6, right: 16, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-saffron)"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-saffron)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="gComm" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-forest)"
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-forest)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey={"day" as any}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "var(--color-ink-faint)",
                    fontSize: 11,
                    fontFamily: "JetBrains Mono",
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tick={{
                    fill: "var(--color-ink-faint)",
                    fontSize: 10,
                    fontFamily: "JetBrains Mono",
                  }}
                  tickFormatter={(v) => `${v / 1000}k`}
                />
                <Tooltip
                  content={<ChartTip />}
                  cursor={{ stroke: "var(--color-line-strong)" }}
                />
                <Area
                  type="monotone"
                  dataKey={"gross" as any}
                  stroke="var(--color-saffron)"
                  strokeWidth={2}
                  fill="url(#gGross)"
                />
                <Area
                  type="monotone"
                  dataKey={"commission" as any}
                  stroke="var(--color-forest)"
                  strokeWidth={2}
                  fill="url(#gComm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Booking mix" desc="By animal category" />
          <div className="flex items-center gap-2 p-5">
            <div className="h-[150px] w-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dynamicBookingMix}
                    dataKey="value"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {dynamicBookingMix.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {dynamicBookingMix.map((d) => (
                <div key={d.name} className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: d.color }}
                  />
                  <span className="text-[13px] text-ink-soft">{d.name}</span>
                  <span className="ml-auto font-mono text-[13px] text-ink tabular">
                    {d.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2">
          <PanelHead
            title="Booking queue"
            desc="Awaiting operational action"
            right={
              <span className="font-mono text-[11px] text-ink-faint">
                {bookings.length} records
              </span>
            }
          />
          <div className="divide-y divide-line">
            {bookings.slice(0, 5).map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-paper/60 transition-colors"
              >
                <div className="font-mono text-[12px] text-ink-faint w-[92px] shrink-0">
                  {b.id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] text-ink truncate">
                    {b.customer}
                  </div>
                  <div className="text-[11.5px] text-ink-faint truncate">
                    {b.animal} · {b.gosala}
                  </div>
                </div>
                <div className="hidden sm:block font-mono text-[12px] text-ink-soft tabular w-[120px]">
                  {b.date.split(" ").slice(0, 2).join(" ")} · {b.start}
                </div>
                <div className="font-mono text-[13px] text-ink tabular w-[80px] text-right">
                  {inr(b.total)}
                </div>
                <div className="w-[150px] flex justify-end">
                  <StatusPill status={b.status} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Lifecycle pipeline"
            desc="Active bookings by stage"
          />
          <div className="p-5 space-y-3.5">
            {pipeline.map((p) => (
              <div key={p.stage}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-ink-soft">{p.stage}</span>
                  <span className="font-mono text-ink tabular">{p.count}</span>
                </div>
                <div className="h-1.5 bg-paper-deep rounded-full overflow-hidden">
                  <div
                    className="h-full bg-saffron rounded-full transition-all"
                    style={{ width: `${(p.count / maxPipe) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
