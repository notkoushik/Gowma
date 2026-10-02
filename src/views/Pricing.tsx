import { useState, useEffect, useMemo } from "react"
import { inr } from "../data/mock"
import { useStore, useToast } from "../store/store"
import { Eyebrow, Panel, PanelHead, Tag } from "../lib/ui"
import {
  Crown,
  Database,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Loader2,
  SlidersHorizontal,
  Building2,
  Users,
  Search,
  Plus,
  Edit3,
  Trash2,
  Store,
  PawPrint,
  Check,
  X,
  AlertCircle,
  PackageCheck,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react"
import { DEFAULT_GOSALA_OFFERINGS, type GosalaOfferingItem, type GosalaOfferingCategory } from "../data/gosalas"

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

const CATEGORY_COLORS: Record<GosalaOfferingCategory, { bg: string; text: string; label: string }> = {
  puja: { bg: "bg-purple-100 text-purple-900 border-purple-200", text: "text-purple-800", label: "Pooja & Garland" },
  feed: { bg: "bg-emerald-100 text-emerald-900 border-emerald-200", text: "text-emerald-800", label: "Grass & Fodder" },
  prasadam: { bg: "bg-amber-100 text-amber-900 border-amber-200", text: "text-amber-800", label: "Sacred Prasadam" },
  decoration: { bg: "bg-indigo-100 text-indigo-900 border-indigo-200", text: "text-indigo-800", label: "Chunni & Vastra" },
}

interface PricingProps {
  initialSector?: "global" | "gosalas"
  onSectorChange?: (sector: "global" | "gosalas") => void
}

export default function Pricing({ initialSector = "global", onSectorChange }: PricingProps) {
  const { notify } = useToast()
  const {
    pricingConfig,
    updatePricing,
    currentRole,
    setCurrentRole,
    gosalas,
    updateGosala,
    animals,
    updateAnimal,
    managers,
    profiles,
  } = useStore()
  const isSuperAdmin = currentRole === "super_admin"

  // Active sector: "global" (Master Pricing) vs "gosalas" (Individual Gaushala Offerings & Cattle Pricing)
  const [sector, setSector] = useState<"global" | "gosalas">(initialSector)

  useEffect(() => {
    if (initialSector && initialSector !== sector) {
      setSector(initialSector)
    }
  }, [initialSector])

  const handleSwitchSector = (sec: "global" | "gosalas") => {
    setSector(sec)
    if (onSectorChange) onSectorChange(sec)
    try {
      const auth = currentRole || "super_admin"
      if (sec === "gosalas") {
        window.location.hash = `#${auth}/pricing/gosalas`
      } else {
        window.location.hash = `#${auth}/pricing`
      }
    } catch {}
  }

  // ---------------- Sector 1: Global Platform State ----------------
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

  // Live sample calc
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

  // ---------------- Sector 2: Individual Gaushala Pricing State ----------------
  const [selectedGosalaId, setSelectedGosalaId] = useState<string>(gosalas[0]?.id || "")
  const [gosalaSearch, setGosalaSearch] = useState("")

  // Ensure selected gosala is valid
  useEffect(() => {
    if (gosalas.length > 0 && !gosalas.some((g) => g.id === selectedGosalaId)) {
      setSelectedGosalaId(gosalas[0].id)
    }
  }, [gosalas, selectedGosalaId])

  const filteredGosalas = useMemo(() => {
    if (!gosalaSearch.trim()) return gosalas
    const q = gosalaSearch.toLowerCase()
    return gosalas.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.region.toLowerCase().includes(q) ||
        g.address.toLowerCase().includes(q)
    )
  }, [gosalas, gosalaSearch])

  const activeGosala = useMemo(() => {
    return gosalas.find((g) => g.id === selectedGosalaId) || gosalas[0]
  }, [gosalas, selectedGosalaId])

  // Animals at this Gaushala
  const gosalaAnimals = useMemo(() => {
    if (!activeGosala) return []
    return animals.filter((a) => a.gosala === activeGosala.name)
  }, [animals, activeGosala])

  // Offerings / items at this Gaushala
  const gosalaItems: GosalaOfferingItem[] = useMemo(() => {
    if (!activeGosala) return DEFAULT_GOSALA_OFFERINGS
    if (activeGosala.items && activeGosala.items.length > 0) {
      return activeGosala.items
    }
    return DEFAULT_GOSALA_OFFERINGS
  }, [activeGosala])

  // Assigned Manager for this Gaushala
  const assignedManager = useMemo(() => {
    if (!activeGosala) return null
    return (
      managers.find(
        (m) =>
          m.gosala === activeGosala.name ||
          (m.gosalas && m.gosalas.includes(activeGosala.name)) ||
          m.id === activeGosala.managerId
      ) || null
    )
  }, [managers, activeGosala])

  // Governing Admin details
  const governingAdmin = {
    name: profiles?.admin?.name || "Devendra Sharma",
    role: "Chief of Regional Operations",
    email: profiles?.admin?.email || "admin@gomaa.in",
    phone: "+91 94220 18492",
    hub: "Pune Metropolitan Operations Hub",
  }

  // Animal Price Quick Edit State
  const [editingAnimalName, setEditingAnimalName] = useState<string | null>(null)
  const [editingAnimalPrice, setEditingAnimalPrice] = useState<number>(3500)

  const handleSaveAnimalPrice = (animalName: string) => {
    if (!isSuperAdmin) return
    updateAnimal(animalName, { price: Number(editingAnimalPrice) })
    setEditingAnimalName(null)
    notify(`Updated darshan price for ${animalName} to ${inr(editingAnimalPrice)}`, "ok")
  }

  // Item Add / Edit Modal State
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemName, setItemName] = useState("")
  const [itemCategory, setItemCategory] = useState<GosalaOfferingCategory>("puja")
  const [itemPrice, setItemPrice] = useState(150)
  const [itemDesc, setItemDesc] = useState("")
  const [itemMaxQty, setItemMaxQty] = useState(5)
  const [itemInStock, setItemInStock] = useState(true)

  const handleOpenAddItem = () => {
    if (!isSuperAdmin) return
    setEditingItemId(null)
    setItemName("")
    setItemCategory("puja")
    setItemPrice(150)
    setItemDesc("")
    setItemMaxQty(5)
    setItemInStock(true)
    setItemModalOpen(true)
  }

  const handleOpenEditItem = (it: GosalaOfferingItem) => {
    if (!isSuperAdmin) return
    setEditingItemId(it.id)
    setItemName(it.name)
    setItemCategory(it.category)
    setItemPrice(it.price)
    setItemDesc(it.desc)
    setItemMaxQty(it.maxQty || 5)
    setItemInStock(it.inStock)
    setItemModalOpen(true)
  }

  const handleSaveItem = () => {
    if (!isSuperAdmin || !activeGosala) return
    if (!itemName.trim()) {
      notify("Please provide a name for the offering item", "warn")
      return
    }

    const currentList = activeGosala.items && activeGosala.items.length > 0
      ? activeGosala.items
      : DEFAULT_GOSALA_OFFERINGS

    let updatedList: GosalaOfferingItem[] = []
    if (editingItemId) {
      updatedList = currentList.map((it) =>
        it.id === editingItemId
          ? {
              ...it,
              name: itemName.trim(),
              category: itemCategory,
              price: Number(itemPrice) || 0,
              desc: itemDesc.trim(),
              maxQty: Number(itemMaxQty) || 5,
              inStock: itemInStock,
            }
          : it
      )
      notify(`Updated item '${itemName.trim()}' for ${activeGosala.name}`, "ok")
    } else {
      const newItem: GosalaOfferingItem = {
        id: `item-${Date.now()}`,
        name: itemName.trim(),
        category: itemCategory,
        price: Number(itemPrice) || 0,
        desc: itemDesc.trim(),
        maxQty: Number(itemMaxQty) || 5,
        inStock: itemInStock,
      }
      updatedList = [newItem, ...currentList]
      notify(`Added offering '${itemName.trim()}' to ${activeGosala.name}`, "ok")
    }

    updateGosala(activeGosala.id, { items: updatedList })
    setItemModalOpen(false)
  }

  const handleToggleStock = (it: GosalaOfferingItem) => {
    if (!isSuperAdmin || !activeGosala) return
    const currentList = activeGosala.items && activeGosala.items.length > 0
      ? activeGosala.items
      : DEFAULT_GOSALA_OFFERINGS

    const updatedList = currentList.map((item) =>
      item.id === it.id ? { ...item, inStock: !item.inStock } : item
    )
    updateGosala(activeGosala.id, { items: updatedList })
    notify(
      `${it.name} is now ${!it.inStock ? "IN STOCK" : "OUT OF STOCK"} at ${activeGosala.name}`,
      "ok"
    )
  }

  const handleDeleteItem = (it: GosalaOfferingItem) => {
    if (!isSuperAdmin || !activeGosala) return
    if (!confirm(`Are you sure you want to remove '${it.name}' from ${activeGosala.name}?`)) return

    const currentList = activeGosala.items && activeGosala.items.length > 0
      ? activeGosala.items
      : DEFAULT_GOSALA_OFFERINGS

    const updatedList = currentList.filter((item) => item.id !== it.id)
    updateGosala(activeGosala.id, { items: updatedList })
    notify(`Removed '${it.name}' from ${activeGosala.name}`, "ok")
  }

  return (
    <div className="space-y-6">
      {/* ---------------- 2-Sector Segmented Tab Bar ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint block">
            Platform Economic Architecture
          </span>
          <h2 className="font-serif text-[22px] text-ink font-semibold mt-0.5">
            {sector === "global"
              ? "Sector 1: Global Platform Economics & Formulas"
              : "Sector 2: Individual Gaushala Pricing & Offerings"}
          </h2>
        </div>

        {/* 2-Sector Pill Switcher */}
        <div className="inline-flex p-1 bg-paper-deep border border-line rounded-sm text-[12.5px] font-medium self-start sm:self-auto shadow-2xs">
          <button
            onClick={() => handleSwitchSector("global")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xs transition-all cursor-pointer ${
              sector === "global"
                ? "bg-white text-ink font-semibold shadow-xs"
                : "text-ink-soft hover:text-ink hover:bg-card/50"
            }`}
          >
            <SlidersHorizontal
              size={14}
              className={sector === "global" ? "text-saffron-deep" : "text-ink-faint"}
            />
            <span>Global Platform Rules</span>
          </button>
          <button
            onClick={() => handleSwitchSector("gosalas")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xs transition-all cursor-pointer ${
              sector === "gosalas"
                ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold shadow-xs"
                : "text-ink-soft hover:text-ink hover:bg-card/50"
            }`}
          >
            <Building2
              size={14}
              className={sector === "gosalas" ? "text-white" : "text-amber-700"}
            />
            <span>Individual Gaushala Pricing</span>
            {gosalas.length > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  sector === "gosalas"
                    ? "bg-amber-900 text-amber-100"
                    : "bg-paper text-ink-faint border border-line"
                }`}
              >
                {gosalas.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTOR 1: GLOBAL PLATFORM ECONOMICS                                       */}
      {/* ========================================================================= */}
      {sector === "global" && (
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
      )}

      {/* ========================================================================= */}
      {/* SECTOR 2: INDIVIDUAL GAUSHALA PRICING & OFFERINGS                         */}
      {/* ========================================================================= */}
      {sector === "gosalas" && (
        <div className="space-y-6">
          {/* Sector 2 Captain Authority Banner */}
          <div className="rounded-sm border border-amber-300/80 bg-linear-to-r from-amber-50 via-amber-100/50 to-amber-50/20 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-sm bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Store size={20} className="stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-[17px] font-semibold text-amber-950">
                      Captain's Individual Gaushala Pricing &amp; Offering Control
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-600 text-white shadow-2xs">
                      <Crown size={11} /> Captain Exclusive Sector
                    </span>
                  </div>
                  <p className="text-[12px] text-amber-900/80 mt-1 max-w-2xl leading-relaxed">
                    Configure the sacred cattle ceremonial darshan prices and manage the devotional items, fresh fodder grass,
                    and Vedic products sold at each individual Gaushala. Every Gaushala is linked with its assigned custodian Manager
                    and governing Regional Operations Admin.
                  </p>
                </div>
              </div>

              {!isSuperAdmin && (
                <div className="bg-amber-100 border border-amber-300 rounded px-3 py-2 text-[11.5px] text-amber-950 flex items-center gap-2 self-start md:self-center">
                  <ShieldAlert size={14} className="text-amber-700 shrink-0" />
                  <span>Read-only preview. Super Admin Captain holds sovereign edit authority.</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-card border border-line rounded-sm p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Total Gaushalas
              </span>
              <div className="font-serif text-[24px] text-ink font-semibold mt-1">
                {gosalas.length}
              </div>
              <span className="text-[11px] text-forest font-medium">In Active Network</span>
            </div>

            <div className="bg-card border border-line rounded-sm p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Cattle Darshan Rates
              </span>
              <div className="font-serif text-[24px] text-ink font-semibold mt-1">
                {animals.length}
              </div>
              <span className="text-[11px] text-saffron-deep font-medium">Animals Priced</span>
            </div>

            <div className="bg-card border border-line rounded-sm p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Cataloged Items
              </span>
              <div className="font-serif text-[24px] text-ink font-semibold mt-1">
                {gosalaItems.length}
              </div>
              <span className="text-[11px] text-purple-700 font-medium">Offerings Sold</span>
            </div>

            <div className="bg-card border border-line rounded-sm p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Sole Authority
              </span>
              <div className="font-serif text-[18px] text-amber-950 font-semibold mt-1 flex items-center gap-1.5">
                <Crown size={16} className="text-amber-600" />
                <span>Super Admin</span>
              </div>
              <span className="text-[11px] text-amber-700 font-mono font-medium">Captain Controls</span>
            </div>
          </div>

          {/* Gaushala Selector & Filter Strip */}
          <div className="bg-card border border-line rounded-sm p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-forest" />
                <span className="font-serif text-[15px] font-semibold text-ink">
                  Select Gaushala to Manage Offerings &amp; Rates
                </span>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  value={gosalaSearch}
                  onChange={(e) => setGosalaSearch(e.target.value)}
                  placeholder="Search Gaushalas or region..."
                  className="w-full bg-paper border border-line rounded-xs pl-8 pr-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-faint outline-none focus:border-saffron focus:ring-1 focus:ring-saffron"
                />
              </div>
            </div>

            {/* Gaushala Horizontal Pill Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
              {filteredGosalas.map((g) => {
                const isSelected = g.id === selectedGosalaId
                const animalCount = animals.filter((a) => a.gosala === g.name).length
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGosalaId(g.id)}
                    className={`whitespace-nowrap px-3.5 py-2 rounded-sm text-[12.5px] font-medium transition-all flex items-center gap-2 border cursor-pointer ${
                      isSelected
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-paper text-ink-soft border-line hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    <Building2 size={13} className={isSelected ? "text-white" : "text-ink-faint"} />
                    <span>{g.name}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? "bg-amber-800 text-amber-100"
                          : "bg-paper-deep text-ink-faint"
                      }`}
                    >
                      {animalCount} cows
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {activeGosala ? (
            <div className="space-y-6">
              {/* ---------------- 3-Tier Administrative Hierarchy Card ---------------- */}
              <div className="bg-card border border-line rounded-sm p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-saffron-deep" />
                    <span className="font-serif text-[15.5px] font-semibold text-ink">
                      Administrative Governance Chain for {activeGosala.name}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] bg-paper-deep text-ink-faint px-2 py-0.5 rounded border border-line">
                    Registration: {activeGosala.trustRegistrationNo || "AWBI/MH/2018/00492"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                  {/* Tier 1: Regional Operations Admin */}
                  <div className="p-3.5 bg-paper rounded border border-line space-y-1 relative">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-forest font-bold">
                        1. Regional Operations Admin
                      </span>
                      <span className="h-2 w-2 rounded-full bg-forest" />
                    </div>
                    <div className="font-serif text-[14.5px] font-semibold text-ink mt-1">
                      {governingAdmin.name}
                    </div>
                    <div className="text-[11.5px] text-ink-soft">{governingAdmin.role}</div>
                    <div className="text-[11px] text-ink-faint font-mono mt-1">
                      {governingAdmin.email} • {governingAdmin.phone}
                    </div>
                    <div className="text-[10px] text-ink-faint italic mt-1">
                      Jurisdiction: {governingAdmin.hub}
                    </div>
                  </div>

                  {/* Tier 2: Assigned Gosala Manager / Custodian */}
                  <div className="p-3.5 bg-paper rounded border border-line space-y-1 relative">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-saffron-deep font-bold">
                        2. Assigned Gosala Custodian
                      </span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          assignedManager?.status === "Active" ? "bg-forest" : "bg-amber-500"
                        }`}
                      />
                    </div>
                    <div className="font-serif text-[14.5px] font-semibold text-ink mt-1">
                      {assignedManager ? assignedManager.name : activeGosala.managerName || "Unassigned"}
                    </div>
                    <div className="text-[11.5px] text-ink-soft">
                      {assignedManager ? "Designated On-Site Manager" : "Acting Custodian Pending"}
                    </div>
                    <div className="text-[11px] text-ink-faint font-mono mt-1">
                      {assignedManager?.email || activeGosala.email || "manager@gomaa.in"} •{" "}
                      {assignedManager?.phone || activeGosala.contactPhone || "Not Listed"}
                    </div>
                    <div className="text-[10px] text-ink-faint italic mt-1">
                      Status: {assignedManager?.status || "Active Duty"}
                    </div>
                  </div>

                  {/* Tier 3: Gaushala Entity */}
                  <div className="p-3.5 bg-paper rounded border border-line space-y-1 relative">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-amber-700 font-bold">
                        3. Gaushala Shelter Entity
                      </span>
                      <span className="h-2 w-2 rounded-full bg-amber-600" />
                    </div>
                    <div className="font-serif text-[14.5px] font-semibold text-ink mt-1">
                      {activeGosala.name}
                    </div>
                    <div className="text-[11.5px] text-ink-soft truncate">{activeGosala.address}</div>
                    <div className="text-[11px] text-ink-faint font-mono mt-1">
                      Region: {activeGosala.region} • Capacity: {activeGosala.capacity} Cattle
                    </div>
                    <div className="text-[10px] text-forest font-medium mt-1">
                      AWBI Certified Trust Facility
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------------- SECTION A: Sacred Herd Cattle Darshan Rates ---------------- */}
              <Panel>
                <PanelHead
                  title={`Sacred Cattle Darshan Pricing · ${activeGosala.name}`}
                  desc="Base 60-min ceremonial darshan booking rate per individual cow, bull, and calf"
                  right={
                    <div className="flex items-center gap-2">
                      <Tag tone="saffron">{gosalaAnimals.length} Bovines Registered</Tag>
                    </div>
                  }
                />

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[700px]">
                    <thead>
                      <tr>
                        {[
                          "Animal & Tag ID",
                          "Type & Breed",
                          "Age & Health",
                          "Base Darshan Price",
                          "Super Admin Action",
                        ].map((h) => (
                          <th
                            key={h}
                            className="font-mono text-[10px] uppercase tracking-wider text-ink-faint font-medium px-5 py-3 border-b border-line text-left bg-paper-deep/40"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gosalaAnimals.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-ink-faint">
                            <PawPrint size={24} className="mx-auto text-ink-faint mb-2 opacity-50" />
                            <p className="font-medium text-ink">No animals registered under this Gaushala yet</p>
                            <p className="text-[12px] text-ink-faint mt-1">
                              Operations Admin can register cows, calves, and bulls in Herd Welfare.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        gosalaAnimals.map((animal) => {
                          const isEditing = editingAnimalName === animal.name
                          return (
                            <tr
                              key={animal.name}
                              className="border-b border-line/70 hover:bg-paper/50 transition-colors"
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-sm overflow-hidden bg-paper-deep border border-line shrink-0">
                                    <img
                                      src={animal.photo || "https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&w=300&q=80"}
                                      alt={animal.name}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div>
                                    <div className="font-serif text-[14px] font-semibold text-ink">
                                      {animal.name}
                                    </div>
                                    <div className="font-mono text-[10px] text-ink-faint">
                                      Tag: {animal.tagId || "IN-MH-PUN-01"}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-3.5 text-[13px] text-ink">
                                <span className="font-medium">{animal.type}</span>
                                <span className="text-ink-faint block text-[11px]">
                                  {animal.breed || "Indigenous Gir"}
                                </span>
                              </td>

                              <td className="px-5 py-3.5 text-[12px] text-ink-soft">
                                <div>{animal.age || `${animal.ageYears || 4} years`}</div>
                                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 mt-0.5">
                                  {animal.status || "Available"}
                                </span>
                              </td>

                              <td className="px-5 py-3.5 font-mono text-[14px] text-ink font-semibold tabular">
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[12px] text-ink-faint">₹</span>
                                    <input
                                      type="number"
                                      autoFocus
                                      value={editingAnimalPrice}
                                      onChange={(e) => setEditingAnimalPrice(Number(e.target.value))}
                                      className="w-24 bg-card border border-amber-400 rounded px-2 py-1 text-[13px] font-mono outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                  </div>
                                ) : (
                                  <span>{inr(animal.price || 3500)}</span>
                                )}
                              </td>

                              <td className="px-5 py-3.5">
                                {isSuperAdmin ? (
                                  isEditing ? (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleSaveAnimalPrice(animal.name)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-forest text-white rounded text-[11.5px] font-medium hover:opacity-90 transition cursor-pointer"
                                      >
                                        <Check size={12} /> Save
                                      </button>
                                      <button
                                        onClick={() => setEditingAnimalName(null)}
                                        className="p-1 text-ink-faint hover:text-ink transition cursor-pointer"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingAnimalName(animal.name)
                                        setEditingAnimalPrice(animal.price || 3500)
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition cursor-pointer"
                                    >
                                      <Edit3 size={11} /> Edit Price
                                    </button>
                                  )
                                ) : (
                                  <span className="text-[11px] text-ink-faint italic">
                                    Captain Locked
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* ---------------- SECTION B: Sacred Store Offerings & Add-ons Sold at Gaushala ---------------- */}
              <Panel>
                <PanelHead
                  title={`Devotional Store Offerings & Items · ${activeGosala.name}`}
                  desc="Pooja malas, green fodder grass baskets, A2 Gir cow ghee and sacred seva items sold at this shelter"
                  right={
                    isSuperAdmin ? (
                      <button
                        onClick={handleOpenAddItem}
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-sm px-3.5 py-1.5 text-[12px] font-medium hover:opacity-90 transition shadow-2xs cursor-pointer"
                      >
                        <Plus size={13} /> Add New Offering / Item
                      </button>
                    ) : null
                  }
                />

                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gosalaItems.map((item) => {
                      const catBadge = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.puja
                      return (
                        <div
                          key={item.id}
                          className={`rounded-sm border p-4 transition-all relative flex flex-col justify-between ${
                            item.inStock
                              ? "bg-card border-line hover:border-amber-300 hover:shadow-xs"
                              : "bg-paper-deep/40 border-line/60 opacity-70"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${catBadge.bg}`}
                              >
                                {catBadge.label}
                              </span>
                              <span
                                className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                  item.inStock
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-rose-50 text-rose-800 border border-rose-200"
                                }`}
                              >
                                {item.inStock ? "In Stock" : "Out of Stock"}
                              </span>
                            </div>

                            <div className="font-serif text-[15px] font-semibold text-ink mt-2.5">
                              {item.name}
                            </div>
                            <p className="text-[12px] text-ink-faint mt-1 leading-relaxed line-clamp-2">
                              {item.desc}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-ink-faint uppercase font-mono block">
                                Seva Price
                              </span>
                              <span className="font-mono text-[16px] text-ink font-semibold tabular">
                                {inr(item.price)}
                              </span>
                            </div>

                            {isSuperAdmin ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleToggleStock(item)}
                                  title={item.inStock ? "Mark as Out of Stock" : "Mark as In Stock"}
                                  className={`p-1.5 rounded transition cursor-pointer text-[11px] ${
                                    item.inStock
                                      ? "text-emerald-700 hover:bg-emerald-50"
                                      : "text-ink-faint hover:bg-paper-deep"
                                  }`}
                                >
                                  <PackageCheck size={14} />
                                </button>
                                <button
                                  onClick={() => handleOpenEditItem(item)}
                                  title="Edit Item Details"
                                  className="p-1.5 text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  title="Delete Item"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-ink-faint italic font-mono">
                                Read Only
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Panel>
            </div>
          ) : (
            <div className="p-8 text-center text-ink-faint bg-card border border-line rounded-sm">
              <Building2 size={32} className="mx-auto text-ink-faint mb-2 opacity-50" />
              <p className="font-serif text-[16px] text-ink font-medium">No Gaushalas Available</p>
              <p className="text-[12px] text-ink-soft mt-1">
                Please register a Gaushala first in the Gaushalas Network section.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT GAUSHALA OFFERING ITEM (SUPER ADMIN ONLY)               */}
      {/* ========================================================================= */}
      {itemModalOpen && activeGosala && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-amber-300 rounded-sm w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-amber-600" />
                <h3 className="font-serif text-[17px] font-semibold text-ink">
                  {editingItemId ? "Edit Offering Item" : "Add New Offering Item"}
                </h3>
              </div>
              <button
                onClick={() => setItemModalOpen(false)}
                className="text-ink-faint hover:text-ink transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-[11.5px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded px-3 py-1.5 font-mono">
              Target Gaushala: <strong>{activeGosala.name}</strong>
            </div>

            <div className="space-y-3.5">
              <Field label="Item / Offering Name" hint="e.g. Marigold Garland, A2 Ghee">
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Enter offering title"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value as GosalaOfferingCategory)}
                    className={inputCls}
                  >
                    <option value="puja">Pooja &amp; Garland</option>
                    <option value="feed">Grass &amp; Fodder</option>
                    <option value="prasadam">Sacred Prasadam</option>
                    <option value="decoration">Chunni &amp; Vastra</option>
                  </select>
                </Field>

                <Field label="Seva Price" hint="₹ INR">
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Description" hint="Devotional meaning & quantity">
                <textarea
                  rows={2}
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Brief description of the sacred item"
                  className={`${inputCls} font-sans`}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Max Qty / Booking">
                  <input
                    type="number"
                    value={itemMaxQty}
                    onChange={(e) => setItemMaxQty(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={itemInStock}
                      onChange={(e) => setItemInStock(e.target.checked)}
                      className="accent-amber-600 rounded"
                    />
                    <span className="text-[12.5px] font-medium text-ink">In Stock / Available</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="px-3 py-1.5 text-[12.5px] text-ink-soft hover:text-ink transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded text-[12.5px] font-medium hover:opacity-90 transition cursor-pointer shadow-2xs"
              >
                {editingItemId ? "Save Changes" : "Add to Gaushala"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
