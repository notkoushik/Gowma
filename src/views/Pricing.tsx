import { useState } from "react"
import { inr } from "../data/mock"
import { useStore, useToast } from "../store/store"
import { Eyebrow, Panel, PanelHead, Tag } from "../lib/ui"

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
  "w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] font-mono text-ink tabular outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"

export default function Pricing() {
  const { pricingConfig, updatePricing, currentRole } = useStore()
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

  const handlePublish = () => {
    if (!isSuperAdmin) return
    updatePricing({
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
      <div className="space-y-6">
        {!isSuperAdmin && (
          <div className="bg-amber-50 border border-amber-300 rounded-sm p-4 text-[12.5px] text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <strong className="font-semibold block sm:inline">
                Super Admin Authority Required:{" "}
              </strong>
              <span>
                Platform pricing formulas, distance slabs, and commission
                percentage are exclusively controlled by the Super Admin.
                Read-only preview active.
              </span>
            </div>
            <Tag tone="warn">Super Admin Only</Tag>
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
                className={inputCls}
                value={extraUnit}
                onChange={(e) => setExtraUnit(Number(e.target.value))}
              >
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </Field>
            <Field label="Extra-time charge" hint={`per ${extraUnit} min`}>
              <input
                type="number"
                className={inputCls}
                value={extraRate}
                onChange={(e) => setExtraRate(Number(e.target.value))}
              />
            </Field>
            <Field label="Max booking duration" hint="minutes">
              <input
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
                className={inputCls}
                value={freeKm}
                onChange={(e) => setFreeKm(Number(e.target.value))}
              />
            </Field>
            <Field label="Per-KM charge" hint="₹ / km">
              <input
                type="number"
                className={inputCls}
                value={perKm}
                onChange={(e) => setPerKm(Number(e.target.value))}
              />
            </Field>
            <Field label="Distance rounding rule">
              <select
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
              <input className={inputCls} defaultValue={35} type="number" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Taxes, commission & buffer" />
          <div className="grid sm:grid-cols-3 gap-5 p-5">
            <Field label="Applicable tax" hint="%">
              <input
                type="number"
                className={inputCls}
                value={taxPct}
                onChange={(e) => setTaxPct(Number(e.target.value))}
              />
            </Field>
            <Field label="GOMAA commission" hint="%">
              <input
                type="number"
                className={inputCls}
                value={commission}
                onChange={(e) => setCommission(Number(e.target.value))}
              />
            </Field>
            <Field label="Buffer between bookings" hint="minutes">
              <input
                className={inputCls}
                value={bufferMin}
                type="number"
                onChange={(e) => setBufferMin(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t border-line">
            <span className="text-[11.5px] text-ink-faint max-w-md">
              Changes apply to new bookings only. Historical bookings keep their
              checkout snapshot and are never recalculated.
            </span>
            <button
              onClick={handlePublish}
              disabled={!isSuperAdmin}
              className={`rounded-sm px-4 py-2 text-[13px] font-medium transition-colors shadow-2xs ${
                isSuperAdmin
                  ? "bg-saffron text-white hover:bg-saffron-deep cursor-pointer"
                  : "bg-paper-deep text-ink-faint border border-line cursor-not-allowed opacity-60"
              }`}
            >
              {isSuperAdmin
                ? "Publish configuration"
                : "Super Admin Required to Publish"}
            </button>
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
  )
}
