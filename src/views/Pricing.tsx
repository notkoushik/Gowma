import { useState, useEffect } from "react"
import { inr } from "../data/mock"
import { useStore } from "../store/store"
import { Eyebrow, Panel, PanelHead, Tag } from "../lib/ui"
import { Crown, Database, CheckCircle2, RotateCcw, ShieldCheck, Loader2 } from "lucide-react"

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-ink-soft font-medium">{label}</span>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const inputCls =
  "w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] font-mono text-ink tabular outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition disabled:opacity-60 disabled:cursor-not-allowed"

export default function Pricing() {
  const { pricingConfig, updatePricing, currentRole, setCurrentRole } = useStore()
  const isSuperAdmin = currentRole === "super_admin"

  const [freeKm, setFreeKm] = useState(pricingConfig.freeKm)
  const [perKm, setPerKm] = useState(pricingConfig.perKm)
  const [extraRate, setExtraRate] = useState(pricingConfig.extraUnitRate)
  const [extraUnit, setExtraUnit] = useState(pricingConfig.extraUnitMin)
  const [taxPct, setTaxPct] = useState(pricingConfig.taxPct)
  const [commission, setCommission] = useState(pricingConfig.commissionPct)
  const [bufferMin, setBufferMin] = useState(pricingConfig.bufferMin)
  const [maxDuration, setMaxDuration] = useState(pricingConfig.maxDurationMin)
  const [rounding, setRounding] = useState(pricingConfig.rounding)
  const [isSaving, setIsSaving] = useState(false)

  // Synchronize inputs whenever backend / DB pricingConfig changes
  useEffect(() => {
    setFreeKm(pricingConfig.freeKm)
    setPerKm(pricingConfig.perKm)
    setExtraRate(pricingConfig.extraUnitRate)
    setExtraUnit(pricingConfig.extraUnitMin)
    setTaxPct(pricingConfig.taxPct)
    setCommission(pricingConfig.commissionPct)
    setBufferMin(pricingConfig.bufferMin)
    setMaxDuration(pricingConfig.maxDurationMin)
    setRounding(pricingConfig.rounding)
  }, [pricingConfig])

  const isDirty =
    freeKm !== pricingConfig.freeKm ||
    perKm !== pricingConfig.perKm ||
    extraRate !== pricingConfig.extraUnitRate ||
    extraUnit !== pricingConfig.extraUnitMin ||
    taxPct !== pricingConfig.taxPct ||
    commission !== pricingConfig.commissionPct ||
    bufferMin !== pricingConfig.bufferMin ||
    maxDuration !== pricingConfig.maxDurationMin ||
    rounding !== pricingConfig.rounding

  const handleReset = () => {
    setFreeKm(pricingConfig.freeKm)
    setPerKm(pricingConfig.perKm)
    setExtraRate(pricingConfig.extraUnitRate)
    setExtraUnit(pricingConfig.extraUnitMin)
    setTaxPct(pricingConfig.taxPct)
    setCommission(pricingConfig.commissionPct)
    setBufferMin(pricingConfig.bufferMin)
    setMaxDuration(pricingConfig.maxDurationMin)
    setRounding(pricingConfig.rounding)
  }

  const handlePublish = async () => {
    if (!isSuperAdmin || isSaving) return
    setIsSaving(true)
    try {
      await updatePricing({
        freeKm,
        perKm,
        extraUnitRate: extraRate,
        extraUnitMin: extraUnit,
        taxPct,
        commissionPct: commission,
        bufferMin,
        maxDurationMin: maxDuration,
        rounding,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Live sample calc (from the requirements' example)
  const base = 3500
  const selectedMin = 120
  const distance = 12.4
  const addons = 450

  const extraMin = Math.max(0, selectedMin - 60)
  const extraCharge = Math.ceil(extraMin / extraUnit) * extraRate
  const chargeableKm = Math.max(0, distance - freeKm)
  const transportRaw = chargeableKm * perKm
  const transport = Math.round(transportRaw / 10) * 10
  const preTax = base + extraCharge + transport + addons
  const tax = Math.round((preTax * taxPct) / 100)
  const total = preTax + tax
  const gomaaCut = Math.round(((base + extraCharge) * commission) / 100)

  const formattedUpdatedAt = pricingConfig.updatedAt
    ? new Date(pricingConfig.updatedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Live System Default"

  return (
    <div className="space-y-6">
      {/* Super Admin Captain Master Economics Banner */}
      <div className="rounded-sm border border-amber-300/80 bg-linear-to-r from-amber-50 via-amber-100/50 to-amber-50/20 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-sm bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Crown size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif text-[17px] font-semibold text-amber-950">
                  Captain's Master Platform Economics
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-600 text-white shadow-2xs">
                  <ShieldCheck size={11} /> Captain Supreme Authority
                </span>
              </div>
              <p className="text-[12px] text-amber-900/80 mt-1 max-w-2xl leading-relaxed">
                As Super Admin ("Captain"), you hold sovereign control over platform base slabs, extra duration rates,
                per-km transit charges, GST taxation brackets, and the 20% platform commission model across all Gaushalas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
            <div className="flex items-center gap-2 bg-white/90 border border-amber-200/80 rounded px-3 py-1.5 text-[11px] font-mono text-ink shadow-2xs">
              <Database size={13} className="text-forest shrink-0" />
              <span>Table: <strong className="text-forest">MasterPricingConfig</strong> (#1)</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest animate-pulse" />
            </div>
          </div>
        </div>

        {/* Database Audit Metadata */}
        <div className="mt-3.5 pt-3 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-amber-950/70 font-mono">
          <div className="flex items-center gap-3">
            <span>Last Database Synced: <strong className="text-ink">{formattedUpdatedAt}</strong></span>
            <span>•</span>
            <span>Authorized By: <strong className="text-ink">{pricingConfig.updatedByName || "Vikramaditya Hegde"}</strong> ({pricingConfig.updatedByRole || "SUPER_ADMIN"})</span>
          </div>
          <div className="flex items-center gap-1.5 text-forest font-sans font-medium text-[12px]">
            <CheckCircle2 size={13} />
            <span>PostgreSQL Prisma Live Persistent Engine</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          {!isSuperAdmin && (
            <div className="bg-amber-50 border border-amber-300 rounded-sm p-4 text-[12.5px] text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div>
                <strong className="font-semibold block sm:inline">
                  Super Admin (Captain) Authority Required:{" "}
                </strong>
                <span>
                  You are currently logged in as Operations Admin. Platform pricing formulas, distance slabs, and commission
                  percentages are strictly restricted to the Super Admin Captain.
                </span>
              </div>
              <button
                onClick={() => setCurrentRole("super_admin")}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-1.5 rounded text-[11.5px] transition shadow-2xs cursor-pointer"
              >
                Switch to Captain Role
              </button>
            </div>
          )}

          <Panel>
            <PanelHead
              title="Extra-time & duration"
              desc="First 60 minutes included in the base booking price"
            />
            <div className="grid sm:grid-cols-2 gap-5 p-5">
              <Field label="Standard duration" hint="minutes">
                <input className={inputCls} value="60" disabled />
              </Field>
              <Field label="Extra-time unit" hint="minutes">
                <select
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={extraUnit}
                  onChange={(e) => setExtraUnit(Number(e.target.value))}
                >
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                </select>
              </Field>
              <Field label="Extra-time charge" hint={`per ${extraUnit} min`}>
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={extraRate}
                  onChange={(e) => setExtraRate(Number(e.target.value))}
                />
              </Field>
              <Field label="Max booking duration" hint="minutes">
                <input
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={maxDuration}
                  type="number"
                  onChange={(e) => setMaxDuration(Number(e.target.value))}
                />
              </Field>
            </div>
          </Panel>

          <Panel>
            <PanelHead
              title="Distance-based transport"
              desc="Chargeable KM = max(0, total distance − free distance)"
            />
            <div className="grid sm:grid-cols-2 gap-5 p-5">
              <Field label="Free transport distance" hint="km">
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={freeKm}
                  onChange={(e) => setFreeKm(Number(e.target.value))}
                />
              </Field>
              <Field label="Per-KM charge" hint="₹ / km">
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={perKm}
                  onChange={(e) => setPerKm(Number(e.target.value))}
                />
              </Field>
              <Field label="Distance rounding rule">
                <select
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={rounding}
                  onChange={(e) => setRounding(e.target.value)}
                >
                  <option>Nearest ₹10</option>
                  <option>Nearest ₹1</option>
                  <option>Round up ₹50</option>
                </select>
              </Field>
              <Field label="Maximum service radius" hint="km">
                <input className={inputCls} defaultValue={35} type="number" disabled />
              </Field>
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Taxes, commission & buffer" />
            <div className="grid sm:grid-cols-3 gap-5 p-5">
              <Field label="Applicable tax" hint="%">
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={taxPct}
                  onChange={(e) => setTaxPct(Number(e.target.value))}
                />
              </Field>
              <Field label="GOMAA commission" hint="%">
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={commission}
                  onChange={(e) => setCommission(Number(e.target.value))}
                />
              </Field>
              <Field label="Buffer between bookings" hint="minutes">
                <input
                  disabled={!isSuperAdmin}
                  className={inputCls}
                  value={bufferMin}
                  type="number"
                  onChange={(e) => setBufferMin(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-4 border-t border-line">
              <div className="space-y-1">
                <span className="text-[11.5px] text-ink-faint max-w-md block">
                  Synchronizes directly with the PostgreSQL database. Live checkout calculations across all consumer apps update automatically.
                </span>
                {isDirty && (
                  <span className="text-[11.5px] text-amber-600 font-medium inline-flex items-center gap-1">
                    ● Unsaved changes pending publish
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                {isDirty && isSuperAdmin && (
                  <button
                    onClick={handleReset}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-ink-soft hover:text-ink border border-line rounded-sm hover:bg-paper-deep transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    Reset
                  </button>
                )}
                <button
                  onClick={handlePublish}
                  disabled={!isSuperAdmin || isSaving}
                  className={`inline-flex items-center justify-center gap-2 rounded-sm px-5 py-2 text-[13px] font-medium transition-colors shadow-2xs min-w-[190px] ${
                    isSuperAdmin
                      ? "bg-saffron text-white hover:bg-saffron-deep cursor-pointer"
                      : "bg-paper-deep text-ink-faint border border-line cursor-not-allowed opacity-60"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Saving to PostgreSQL...</span>
                    </>
                  ) : isSuperAdmin ? (
                    <>
                      <Database size={14} />
                      <span>Publish & Sync to DB</span>
                    </>
                  ) : (
                    "Super Admin Only"
                  )}
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="xl:sticky xl:top-6">
          <PanelHead
            title="Live price preview"
            desc="Sample: 120-min cow booking · 12.4 km"
          />
          <div className="p-5">
            <Eyebrow>Breakdown</Eyebrow>
            <div className="mt-3 space-y-2.5 text-[13px]">
              {[
                ["Base booking (60 min incl.)", base],
                [
                  `Extra time (${extraMin} min → ${extraMin / extraUnit} × ${inr(extraRate)})`,
                  extraCharge,
                ],
                [
                  `Transport (${chargeableKm.toFixed(1)} km × ${inr(perKm)})`,
                  transport,
                ],
                ["Add-ons (mala, flowers)", addons],
                [`Tax (${taxPct}%)`, tax],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between">
                  <span className="text-ink-soft pr-3">{l}</span>
                  <span className="font-mono text-ink tabular whitespace-nowrap">
                    {inr(v as number)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-line-strong">
              <span className="font-serif text-[16px] text-ink">
                Customer total
              </span>
              <span className="font-mono text-[22px] text-ink tabular">
                {inr(total)}
              </span>
            </div>

            <div className="mt-5 rounded-sm bg-paper border border-line p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-soft">
                  GOMAA commission
                </span>
                <Tag tone="saffron">{commission}%</Tag>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-faint">GOMAA share</span>
                <span className="font-mono text-ink tabular">
                  {inr(gomaaCut)}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-faint">Gosala payable</span>
                <span className="font-mono text-forest tabular">
                  {inr(base + extraCharge - gomaaCut)}
                </span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
