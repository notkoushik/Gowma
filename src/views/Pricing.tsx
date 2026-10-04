import { useState, useEffect, useMemo } from "react"
import { inr } from "../data/mock"
import { useStore, useToast, type CustomDynamicFee } from "../store/store"
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
  PlusCircle,
  Edit2,
  Edit3,
  Save,
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
  Layers,
  Settings2,
  Percent,
  BadgePercent,
  Handshake,
  Calculator,
  TrendingDown,
  Scale,
  Receipt,
  Landmark,
  Star,
  Filter,
} from "lucide-react"
import {
  DEFAULT_GOSALA_OFFERINGS,
  type Gosala,
  type GosalaOfferingItem,
  type GosalaOfferingCategory,
  type CustomBovineCategory,
  type PartnershipTier,
  type CommissionType,
  type TaxTreatment,
} from "../data/gosalas"

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
  initialSector?: "global" | "gosalas" | "commissions"
  onSectorChange?: (sector: "global" | "gosalas" | "commissions") => void
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

  // Active sector: "global" (Master Pricing) vs "gosalas" (Individual Gaushala Offerings) vs "commissions" (Gaushala Commission & Economics Settlement Module)
  const [sector, setSector] = useState<"global" | "gosalas" | "commissions">(
    initialSector || "global"
  )

  useEffect(() => {
    if (initialSector && initialSector !== sector) {
      setSector(initialSector)
    }
  }, [initialSector])

  const handleSwitchSector = (sec: "global" | "gosalas" | "commissions") => {
    setSector(sec)
    if (onSectorChange) onSectorChange(sec)
    try {
      const auth = currentRole || "super_admin"
      if (sec === "gosalas") {
        window.location.hash = `#${auth}/pricing/gosalas`
      } else if (sec === "commissions") {
        window.location.hash = `#${auth}/pricing/commissions`
      } else {
        window.location.hash = `#${auth}/pricing`
      }
    } catch {}
  }

  // ---------------- Sector 1: Global Platform State ----------------
  const [standardMin, setStandardMin] = useState(pricingConfig.standardMin ?? 60)
  const [maxRadiusKm, setMaxRadiusKm] = useState(pricingConfig.maxRadiusKm ?? 35)
  const [freeKm, setFreeKm] = useState(pricingConfig.freeKm)
  const [perKm, setPerKm] = useState(pricingConfig.perKm)
  const [extraRate, setExtraRate] = useState(pricingConfig.extraUnitRate)
  const [extraUnit, setExtraUnit] = useState(pricingConfig.extraUnitMin)
  const [taxPct, setTaxPct] = useState(pricingConfig.taxPct)
  const [commission, setCommission] = useState(pricingConfig.commissionPct)
  const [bufferMin, setBufferMin] = useState(pricingConfig.bufferMin)
  const [maxDuration, setMaxDuration] = useState(pricingConfig.maxDurationMin)
  const [rounding, setRounding] = useState(pricingConfig.rounding)
  const [customFees, setCustomFees] = useState<CustomDynamicFee[]>(pricingConfig.customFees ?? [])
  const [isSaving, setIsSaving] = useState(false)

  // Custom Dynamic Fee Modal state
  const [feeModalOpen, setFeeModalOpen] = useState(false)
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [feeName, setFeeName] = useState("")
  const [feeType, setFeeType] = useState<"fixed" | "percentage">("fixed")
  const [feeValue, setFeeValue] = useState<number>(150)
  const [feeAppliedOn, setFeeAppliedOn] = useState<"base" | "total" | "transport">("total")
  const [feeDescription, setFeeDescription] = useState("")
  const [feeEnabled, setFeeEnabled] = useState(true)

  useEffect(() => {
    setStandardMin(pricingConfig.standardMin ?? 60)
    setMaxRadiusKm(pricingConfig.maxRadiusKm ?? 35)
    setFreeKm(pricingConfig.freeKm)
    setPerKm(pricingConfig.perKm)
    setExtraRate(pricingConfig.extraUnitRate)
    setExtraUnit(pricingConfig.extraUnitMin)
    setTaxPct(pricingConfig.taxPct)
    setCommission(pricingConfig.commissionPct)
    setBufferMin(pricingConfig.bufferMin)
    setMaxDuration(pricingConfig.maxDurationMin)
    setRounding(pricingConfig.rounding)
    setCustomFees(pricingConfig.customFees ?? [])
  }, [pricingConfig])

  const isDirty =
    standardMin !== (pricingConfig.standardMin ?? 60) ||
    maxRadiusKm !== (pricingConfig.maxRadiusKm ?? 35) ||
    freeKm !== pricingConfig.freeKm ||
    perKm !== pricingConfig.perKm ||
    extraRate !== pricingConfig.extraUnitRate ||
    extraUnit !== pricingConfig.extraUnitMin ||
    taxPct !== pricingConfig.taxPct ||
    commission !== pricingConfig.commissionPct ||
    bufferMin !== pricingConfig.bufferMin ||
    maxDuration !== pricingConfig.maxDurationMin ||
    rounding !== pricingConfig.rounding ||
    JSON.stringify(customFees) !== JSON.stringify(pricingConfig.customFees ?? [])

  const handleReset = () => {
    setStandardMin(pricingConfig.standardMin ?? 60)
    setMaxRadiusKm(pricingConfig.maxRadiusKm ?? 35)
    setFreeKm(pricingConfig.freeKm)
    setPerKm(pricingConfig.perKm)
    setExtraRate(pricingConfig.extraUnitRate)
    setExtraUnit(pricingConfig.extraUnitMin)
    setTaxPct(pricingConfig.taxPct)
    setCommission(pricingConfig.commissionPct)
    setBufferMin(pricingConfig.bufferMin)
    setMaxDuration(pricingConfig.maxDurationMin)
    setRounding(pricingConfig.rounding)
    setCustomFees(pricingConfig.customFees ?? [])
  }

  const handlePublish = async () => {
    if (!isSuperAdmin || isSaving) return
    setIsSaving(true)
    try {
      await updatePricing({
        standardMin,
        maxRadiusKm,
        freeKm,
        perKm,
        extraUnitRate: extraRate,
        extraUnitMin: extraUnit,
        taxPct,
        commissionPct: commission,
        bufferMin,
        maxDurationMin: maxDuration,
        rounding,
        customFees,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Dynamic fee management handlers
  const handleOpenAddFee = () => {
    if (!isSuperAdmin) return
    setEditingFeeId(null)
    setFeeName("")
    setFeeType("fixed")
    setFeeValue(150)
    setFeeAppliedOn("total")
    setFeeDescription("")
    setFeeEnabled(true)
    setFeeModalOpen(true)
  }

  const handleOpenEditFee = (fee: CustomDynamicFee) => {
    if (!isSuperAdmin) return
    setEditingFeeId(fee.id)
    setFeeName(fee.name)
    setFeeType(fee.type)
    setFeeValue(fee.value)
    setFeeAppliedOn(fee.appliedOn)
    setFeeDescription(fee.description || "")
    setFeeEnabled(fee.enabled)
    setFeeModalOpen(true)
  }

  const handleSaveFee = () => {
    if (!isSuperAdmin) return
    if (!feeName.trim()) {
      notify("Please provide a name for this dynamic value proportionate", "warn")
      return
    }
    if (editingFeeId) {
      setCustomFees((prev) =>
        prev.map((f) =>
          f.id === editingFeeId
            ? {
                ...f,
                name: feeName.trim(),
                type: feeType,
                value: Number(feeValue) || 0,
                appliedOn: feeAppliedOn,
                description: feeDescription.trim(),
                enabled: feeEnabled,
              }
            : f
        )
      )
      notify(`Updated dynamic proportionate '${feeName}'`, "ok")
    } else {
      const newFee: CustomDynamicFee = {
        id: `fee-${Date.now()}`,
        name: feeName.trim(),
        type: feeType,
        value: Number(feeValue) || 0,
        appliedOn: feeAppliedOn,
        description: feeDescription.trim(),
        enabled: feeEnabled,
      }
      setCustomFees((prev) => [...prev, newFee])
      notify(`Added dynamic proportionate '${feeName}'`, "ok")
    }
    setFeeModalOpen(false)
  }

  const handleToggleFee = (feeId: string) => {
    if (!isSuperAdmin) return
    setCustomFees((prev) =>
      prev.map((f) => (f.id === feeId ? { ...f, enabled: !f.enabled } : f))
    )
  }

  const handleDeleteFee = (feeId: string) => {
    if (!isSuperAdmin) return
    setCustomFees((prev) => prev.filter((f) => f.id !== feeId))
    notify("Dynamic fee removed", "info")
  }

  // Live sample calculation with custom dynamic fees
  const base = 3500
  const selectedMin = 120
  const distance = 12.4
  const addons = 450

  const extraMin = Math.max(0, selectedMin - standardMin)
  const extraCharge = Math.ceil(extraMin / extraUnit) * extraRate
  const chargeableKm = Math.max(0, distance - freeKm)
  const transportRaw = chargeableKm * perKm
  const transport = Math.round(transportRaw / 10) * 10

  const enabledCustomFees = customFees.filter((f) => f.enabled)
  const customFeesTotal = enabledCustomFees.reduce((acc, f) => {
    if (f.type === "fixed") return acc + f.value
    if (f.appliedOn === "base") return acc + Math.round((base * f.value) / 100)
    if (f.appliedOn === "transport") return acc + Math.round((transport * f.value) / 100)
    return acc + Math.round(((base + extraCharge + transport + addons) * f.value) / 100)
  }, 0)

  const preTax = base + extraCharge + transport + addons + customFeesTotal
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
    hub: activeGosala?.region || "Regional Operations Hub",
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

  // Gaushala Category Base Price Matrix State
  const [baseCow, setBaseCow] = useState<number>(3500)
  const [basePair, setBasePair] = useState<number>(4800)
  const [baseCalf, setBaseCalf] = useState<number>(2500)
  const [baseBull, setBaseBull] = useState<number>(4500)
  const [baseBuffalo, setBaseBuffalo] = useState<number>(3200)
  const [isEditingBaseRates, setIsEditingBaseRates] = useState(false)
  const [customCommission, setCustomCommission] = useState<number | "">("")

  // Custom Bovine Category Modal State
  const [bovineModalOpen, setBovineModalOpen] = useState(false)
  const [editingBovineId, setEditingBovineId] = useState<string | null>(null)
  const [bovineName, setBovineName] = useState("")
  const [bovineBasePrice, setBovineBasePrice] = useState<number>(3500)
  const [bovineDescription, setBovineDescription] = useState("")
  const [bovineBadgeText, setBovineBadgeText] = useState("Custom Breed")

  useEffect(() => {
    if (activeGosala) {
      setBaseCow(activeGosala.baseCowPrice ?? 3500)
      setBasePair(activeGosala.basePairPrice ?? 4800)
      setBaseCalf(activeGosala.baseCalfPrice ?? 2500)
      setBaseBull(activeGosala.baseBullPrice ?? 4500)
      setBaseBuffalo(activeGosala.baseBuffaloPrice ?? 3200)
      setCustomCommission(
        activeGosala.customCommissionPct !== undefined
          ? activeGosala.customCommissionPct
          : ""
      )
      setIsEditingBaseRates(false)
    }
  }, [activeGosala])

  const handleSaveBaseRates = () => {
    if (!isSuperAdmin || !activeGosala) return
    updateGosala(activeGosala.id, {
      baseCowPrice: Number(baseCow),
      basePairPrice: Number(basePair),
      baseCalfPrice: Number(baseCalf),
      baseBullPrice: Number(baseBull),
      baseBuffaloPrice: Number(baseBuffalo),
      customCommissionPct: customCommission === "" ? undefined : Number(customCommission),
    })
    setIsEditingBaseRates(false)
    notify(`Saved category base darshan rates & economics for ${activeGosala.name}`, "ok")
  }

  const handleOpenAddBovine = () => {
    if (!isSuperAdmin) return
    setEditingBovineId(null)
    setBovineName("")
    setBovineBasePrice(3500)
    setBovineDescription("")
    setBovineBadgeText("Custom Breed")
    setBovineModalOpen(true)
  }

  const handleOpenEditBovine = (cat: CustomBovineCategory) => {
    if (!isSuperAdmin) return
    setEditingBovineId(cat.id)
    setBovineName(cat.name)
    setBovineBasePrice(cat.basePrice)
    setBovineDescription(cat.description || "")
    setBovineBadgeText(cat.badgeText || "Custom Category")
    setBovineModalOpen(true)
  }

  const handleSaveBovine = () => {
    if (!isSuperAdmin || !activeGosala) return
    if (!bovineName.trim()) {
      notify("Please provide a name for this custom bovine category", "warn")
      return
    }

    const currentCustom = activeGosala.customBovineCategories || []
    let updatedList: CustomBovineCategory[] = []

    if (editingBovineId) {
      updatedList = currentCustom.map((c) =>
        c.id === editingBovineId
          ? {
              ...c,
              name: bovineName.trim(),
              basePrice: Number(bovineBasePrice) || 0,
              description: bovineDescription.trim(),
              badgeText: bovineBadgeText.trim() || undefined,
            }
          : c
      )
      notify(`Updated custom bovine category '${bovineName.trim()}'`, "ok")
    } else {
      const newCat: CustomBovineCategory = {
        id: `bovine-${Date.now()}`,
        name: bovineName.trim(),
        basePrice: Number(bovineBasePrice) || 0,
        description: bovineDescription.trim(),
        badgeText: bovineBadgeText.trim() || undefined,
      }
      updatedList = [...currentCustom, newCat]
      notify(`Added custom bovine category '${bovineName.trim()}' to ${activeGosala.name}`, "ok")
    }

    updateGosala(activeGosala.id, { customBovineCategories: updatedList })
    setBovineModalOpen(false)
  }

  const handleDeleteBovine = (catId: string) => {
    if (!isSuperAdmin || !activeGosala) return
    const currentCustom = activeGosala.customBovineCategories || []
    const updatedList = currentCustom.filter((c) => c.id !== catId)
    updateGosala(activeGosala.id, { customBovineCategories: updatedList })
    notify("Custom bovine category removed", "info")
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

  // Delete Offering Item Confirmation Modal State
  const [deleteItemModalOpen, setDeleteItemModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<GosalaOfferingItem | null>(null)

  const handleDeleteItem = (it: GosalaOfferingItem) => {
    if (!isSuperAdmin || !activeGosala) return
    setItemToDelete(it)
    setDeleteItemModalOpen(true)
  }

  const handleConfirmDeleteItem = () => {
    if (!isSuperAdmin || !activeGosala || !itemToDelete) return

    const currentList = activeGosala.items && activeGosala.items.length > 0
      ? activeGosala.items
      : DEFAULT_GOSALA_OFFERINGS

    const updatedList = currentList.filter((item) => item.id !== itemToDelete.id)
    updateGosala(activeGosala.id, { items: updatedList })
    notify(`Removed '${itemToDelete.name}' from ${activeGosala.name}`, "ok")
    setDeleteItemModalOpen(false)
    setItemToDelete(null)
  }

  const handleCancelDeleteItem = () => {
    setDeleteItemModalOpen(false)
    setItemToDelete(null)
  }

  // ---------------- Sector 3: Gaushala Commission & Economics Settlement Module ----------------
  const [commSearch, setCommSearch] = useState("")
  const [commTierFilter, setCommTierFilter] = useState<"all" | "preferred" | "charitable" | "standard" | "tax_exempt">("all")

  // Modal State for Editing Gaushala Economics
  const [econModalOpen, setEconModalOpen] = useState(false)
  const [econTargetGosala, setEconTargetGosala] = useState<Gosala | null>(null)
  const [econTier, setEconTier] = useState<PartnershipTier>("STANDARD")
  const [econCommType, setEconCommType] = useState<CommissionType>("percentage")
  const [econCommValue, setEconCommValue] = useState<number>(20)
  const [econTaxTreatment, setEconTaxTreatment] = useState<TaxTreatment>("standard_gst")
  const [econCustomTaxPct, setEconCustomTaxPct] = useState<number>(5)
  const [econBufferMin, setEconBufferMin] = useState<number>(30)
  const [econNotes, setEconNotes] = useState<string>("")

  const handleOpenEditEconomics = (g: Gosala) => {
    if (!isSuperAdmin) return
    setEconTargetGosala(g)
    setEconTier(
      g.partnershipTier ||
        (g.customCommissionPct !== undefined && g.customCommissionPct < commission
          ? "PREFERRED"
          : "STANDARD")
    )
    setEconCommType(g.commissionType || "percentage")
    setEconCommValue(
      g.commissionType === "fixed"
        ? (g.customCommissionFlat ?? 400)
        : (g.customCommissionPct ?? commission)
    )
    setEconTaxTreatment(g.taxTreatment || "standard_gst")
    setEconCustomTaxPct(g.customTaxPct ?? taxPct)
    setEconBufferMin(g.bufferMinutes ?? bufferMin)
    setEconNotes(g.partnershipNotes || "")
    setEconModalOpen(true)
  }

  const handleSaveEconomics = () => {
    if (!isSuperAdmin || !econTargetGosala) return
    updateGosala(econTargetGosala.id, {
      partnershipTier: econTier,
      commissionType: econCommType,
      customCommissionPct: econCommType === "percentage" ? Number(econCommValue) : undefined,
      customCommissionFlat: econCommType === "fixed" ? Number(econCommValue) : undefined,
      taxTreatment: econTaxTreatment,
      customTaxPct:
        econTaxTreatment === "section_80g_exempt"
          ? 0
          : econTaxTreatment === "reduced_charity_gst"
          ? 5
          : econTaxTreatment === "standard_gst"
          ? 18
          : Number(econCustomTaxPct),
      bufferMinutes: Number(econBufferMin),
      partnershipNotes: econNotes.trim(),
    })
    setEconModalOpen(false)
    notify(`Updated customized settlement economics for ${econTargetGosala.name}`, "ok")
  }

  const handleApplyQuickPreset = (
    g: Gosala,
    preset: "preferred" | "standard" | "charitable"
  ) => {
    if (!isSuperAdmin) return
    if (preset === "preferred") {
      updateGosala(g.id, {
        partnershipTier: "PREFERRED",
        commissionType: "percentage",
        customCommissionPct: 8,
        taxTreatment: "section_80g_exempt",
        customTaxPct: 0,
        bufferMinutes: 30,
        partnershipNotes: "Close Partner Sanctuary - Subsidized 8% preferential commission",
      })
      notify(`Applied Preferred Sanctuary preset (8% comm, 0% tax) to ${g.name}`, "ok")
    } else if (preset === "charitable") {
      updateGosala(g.id, {
        partnershipTier: "CHARITABLE",
        commissionType: "percentage",
        customCommissionPct: 5,
        taxTreatment: "section_80g_exempt",
        customTaxPct: 0,
        bufferMinutes: 45,
        partnershipNotes: "Charitable Welfare Trust - Subsidized 5% seva rate",
      })
      notify(`Applied Charitable Welfare preset (5% comm, 0% tax) to ${g.name}`, "ok")
    } else {
      updateGosala(g.id, {
        partnershipTier: "STANDARD",
        commissionType: "percentage",
        customCommissionPct: commission,
        taxTreatment: "standard_gst",
        customTaxPct: taxPct,
        bufferMinutes: bufferMin,
        partnershipNotes: "Standard Platform Affiliate",
      })
      notify(`Reset ${g.name} to Standard Platform defaults (${commission}% comm)`, "info")
    }
  }

  // Interactive Live Settlement & Payout Simulator State
  const [simGosalaId, setSimGosalaId] = useState<string>(gosalas[0]?.id || "")
  const [simBasePrice, setSimBasePrice] = useState<number>(3500)
  const [simDurationMin, setSimDurationMin] = useState<number>(120)
  const [simDistanceKm, setSimDistanceKm] = useState<number>(12.4)
  const [simAddons, setSimAddons] = useState<number>(450)

  useEffect(() => {
    if (gosalas.length > 0 && !gosalas.some((g) => g.id === simGosalaId)) {
      setSimGosalaId(gosalas[0].id)
    }
  }, [gosalas, simGosalaId])

  const simGosala = useMemo(() => {
    return gosalas.find((g) => g.id === simGosalaId) || gosalas[0]
  }, [gosalas, simGosalaId])

  // Simulator accurate calculations
  const simEffectiveCommPct = simGosala?.customCommissionPct ?? commission
  const simEffectiveCommType = simGosala?.commissionType ?? "percentage"
  const simEffectiveTaxPct =
    simGosala?.taxTreatment === "section_80g_exempt"
      ? 0
      : simGosala?.taxTreatment === "reduced_charity_gst"
      ? 5
      : simGosala?.customTaxPct !== undefined
      ? simGosala.customTaxPct
      : taxPct
  const simEffectiveBuffer = simGosala?.bufferMinutes ?? bufferMin

  const simExtraMin = Math.max(0, simDurationMin - standardMin)
  const simExtraCharge = Math.ceil(simExtraMin / extraUnit) * extraRate
  const simChargeableKm = Math.max(0, simDistanceKm - freeKm)
  const simTransportRaw = simChargeableKm * perKm
  const simTransport = Math.round(simTransportRaw / 10) * 10
  const simSubtotal = simBasePrice + simExtraCharge + simTransport + simAddons
  const simTax = Math.round((simSubtotal * simEffectiveTaxPct) / 100)
  const simCustomerTotal = simSubtotal + simTax

  const simGomaaCut =
    simEffectiveCommType === "fixed"
      ? (simGosala?.customCommissionFlat ?? 400)
      : Math.round(((simBasePrice + simExtraCharge) * simEffectiveCommPct) / 100)

  const simGosalaPayable = Math.max(0, simBasePrice + simExtraCharge - simGomaaCut + simTransport + simAddons)
  const simStandardGomaaCut = Math.round(((simBasePrice + simExtraCharge) * commission) / 100)
  const simSanctuarySavings = Math.max(0, simStandardGomaaCut - simGomaaCut)

  const filteredCommGosalas = useMemo(() => {
    return gosalas.filter((g) => {
      const q = commSearch.toLowerCase()
      const matchSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.region.toLowerCase().includes(q) ||
        (g.partnershipNotes && g.partnershipNotes.toLowerCase().includes(q))

      if (!matchSearch) return false

      if (commTierFilter === "all") return true
      if (commTierFilter === "preferred") {
        return (
          g.partnershipTier === "PREFERRED" ||
          (g.customCommissionPct !== undefined && g.customCommissionPct < commission)
        )
      }
      if (commTierFilter === "charitable") {
        return (
          g.partnershipTier === "CHARITABLE" ||
          (g.customCommissionPct !== undefined && g.customCommissionPct <= 5)
        )
      }
      if (commTierFilter === "tax_exempt") {
        return g.taxTreatment === "section_80g_exempt" || g.customTaxPct === 0
      }
      if (commTierFilter === "standard") {
        return (
          (!g.partnershipTier || g.partnershipTier === "STANDARD") &&
          (g.customCommissionPct === undefined || g.customCommissionPct === commission)
        )
      }
      return true
    })
  }, [gosalas, commSearch, commTierFilter, commission])

  return (
    <div className="space-y-6">
      {/* ---------------- 3-Sector Segmented Tab Bar ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint block">
            Platform Economic Architecture
          </span>
          <h2 className="font-serif text-[22px] text-ink font-semibold mt-0.5">
            {sector === "global"
              ? "Sector 1: Global Platform Economics & Formulas"
              : sector === "gosalas"
              ? "Sector 2: Individual Gaushala Pricing & Offerings"
              : "Sector 3: Gaushala Commission, Tax & Settlement Governance"}
          </h2>
        </div>

        {/* 3-Sector Pill Switcher */}
        <div className="inline-flex p-1 bg-paper-deep border border-line rounded-sm text-[12.5px] font-medium self-start sm:self-auto shadow-2xs overflow-x-auto max-w-full">
          <button
            onClick={() => handleSwitchSector("global")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xs transition-all cursor-pointer whitespace-nowrap ${
              sector === "global"
                ? "bg-white text-ink font-semibold shadow-xs"
                : "text-ink-soft hover:text-ink hover:bg-card/50"
            }`}
          >
            <SlidersHorizontal
              size={14}
              className={sector === "global" ? "text-saffron-deep" : "text-ink-faint"}
            />
            <span>Global Master Rules</span>
          </button>
          <button
            onClick={() => handleSwitchSector("gosalas")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xs transition-all cursor-pointer whitespace-nowrap ${
              sector === "gosalas"
                ? "bg-white text-ink font-semibold shadow-xs"
                : "text-ink-soft hover:text-ink hover:bg-card/50"
            }`}
          >
            <Building2
              size={14}
              className={sector === "gosalas" ? "text-forest" : "text-ink-faint"}
            />
            <span>Gaushala Offerings</span>
            {gosalas.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-paper text-ink-faint border border-line">
                {gosalas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleSwitchSector("commissions")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xs transition-all cursor-pointer whitespace-nowrap ${
              sector === "commissions"
                ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold shadow-xs"
                : "text-ink-soft hover:text-ink hover:bg-card/50"
            }`}
          >
            <Percent
              size={14}
              className={sector === "commissions" ? "text-white" : "text-amber-700"}
            />
            <span>Commission &amp; Economics</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                sector === "commissions"
                  ? "bg-amber-900 text-amber-100"
                  : "bg-amber-100 text-amber-900 border border-amber-300"
              }`}
            >
              Custom Slabs
            </span>
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
                  desc={`First ${standardMin} minutes included in the base booking price`}
                />
                <div className="grid sm:grid-cols-2 gap-5 p-5">
                  <Field label="Standard duration" hint="minutes">
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      className={inputCls}
                      value={standardMin}
                      onChange={(e) => setStandardMin(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Extra-time unit" hint="minutes per slab">
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      className={inputCls}
                      value={extraUnit}
                      onChange={(e) => setExtraUnit(Number(e.target.value))}
                    />
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
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      className={inputCls}
                      value={maxRadiusKm}
                      onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                    />
                  </Field>
                </div>
              </Panel>

              {/* Dynamic Custom Proportionates & Surcharges Panel (Super Admin Dynamic Values) */}
              <Panel>
                <PanelHead
                  title="Dynamic Proportionates & Platform Surcharges"
                  desc="Sovereign Super Admin custom value addition: add arbitrary fixed levies or percentage surcharges"
                  right={
                    isSuperAdmin ? (
                      <button
                        onClick={handleOpenAddFee}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded text-[12px] font-medium shadow-2xs transition cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add Proportionate</span>
                      </button>
                    ) : null
                  }
                />
                <div className="p-5 space-y-3">
                  {customFees.length === 0 ? (
                    <div className="p-6 text-center bg-paper rounded border border-line text-ink-faint">
                      <Sparkles size={24} className="mx-auto text-amber-500 mb-2 opacity-60" />
                      <p className="text-[13px] font-medium text-ink">No Dynamic Proportionates Configured</p>
                      <p className="text-[11.5px] text-ink-faint mt-1">
                        Super Admin can add arbitrary surcharges (e.g. Festival Surcharge, Gau Fodder Welfare Levy, Vedic Priest Handling).
                      </p>
                      {isSuperAdmin && (
                        <button
                          onClick={handleOpenAddFee}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-200 rounded cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Configure First Dynamic Value</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-line text-[10.5px] font-mono uppercase tracking-wider text-ink-faint">
                            <th className="pb-2.5">Proportionate Name</th>
                            <th className="pb-2.5">Rule / Applied On</th>
                            <th className="pb-2.5">Value Addition</th>
                            <th className="pb-2.5">Status</th>
                            {isSuperAdmin && <th className="pb-2.5 text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {customFees.map((fee) => (
                            <tr key={fee.id} className="text-[12.5px] hover:bg-paper/50">
                              <td className="py-2.5 pr-3">
                                <div className="font-medium text-ink flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>{fee.name}</span>
                                </div>
                                {fee.description && (
                                  <div className="text-[11px] text-ink-faint mt-0.5 line-clamp-1">
                                    {fee.description}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className="font-mono text-[11px] bg-paper px-2 py-0.5 rounded border border-line capitalize">
                                  {fee.type === "fixed" ? "Fixed flat levy" : `${fee.value}% of ${fee.appliedOn}`}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className="font-mono font-semibold text-ink">
                                  {fee.type === "fixed" ? inr(fee.value) : `+${fee.value}%`}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3">
                                <button
                                  type="button"
                                  disabled={!isSuperAdmin}
                                  onClick={() => handleToggleFee(fee.id)}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono cursor-pointer transition ${
                                    fee.enabled
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-paper-deep text-ink-faint border border-line"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      fee.enabled ? "bg-emerald-500" : "bg-ink-faint"
                                    }`}
                                  />
                                  <span>{fee.enabled ? "Active" : "Inactive"}</span>
                                </button>
                              </td>
                              {isSuperAdmin && (
                                <td className="py-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditFee(fee)}
                                      className="p-1.5 text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                                      title="Edit dynamic fee"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteFee(fee.id)}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                      title="Delete dynamic fee"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                    [`Base booking (${standardMin} min incl.)`, base],
                    [
                      `Extra time (${extraMin} min → ${extraMin > 0 ? Math.ceil(extraMin / extraUnit) : 0} × ${inr(extraRate)})`,
                      extraCharge,
                    ],
                    [
                      `Transport (${chargeableKm.toFixed(1)} km × ${inr(perKm)})`,
                      transport,
                    ],
                    ["Add-ons (mala, flowers)", addons],
                  ].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between">
                      <span className="text-ink-soft pr-3">{l}</span>
                      <span className="font-mono text-ink tabular whitespace-nowrap">
                        {inr(v as number)}
                      </span>
                    </div>
                  ))}

                  {/* Render enabled custom dynamic fees */}
                  {enabledCustomFees.map((fee) => {
                    const feeAmt =
                      fee.type === "fixed"
                        ? fee.value
                        : fee.appliedOn === "base"
                        ? Math.round((base * fee.value) / 100)
                        : fee.appliedOn === "transport"
                        ? Math.round((transport * fee.value) / 100)
                        : Math.round(((base + extraCharge + transport + addons) * fee.value) / 100)
                    return (
                      <div key={fee.id} className="flex justify-between text-amber-900 bg-amber-50/70 px-2 py-1 rounded">
                        <span className="text-amber-900 pr-3 flex items-center gap-1.5 text-[12px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span>{fee.name}</span>
                          <span className="text-[10px] font-mono text-amber-700">
                            ({fee.type === "fixed" ? inr(fee.value) : `${fee.value}% ${fee.appliedOn}`})
                          </span>
                        </span>
                        <span className="font-mono text-amber-950 font-semibold tabular whitespace-nowrap text-[12.5px]">
                          {inr(feeAmt)}
                        </span>
                      </div>
                    )
                  })}

                  <div className="flex justify-between">
                    <span className="text-ink-soft pr-3">{`Tax (${taxPct}%)`}</span>
                    <span className="font-mono text-ink tabular whitespace-nowrap">
                      {inr(tax)}
                    </span>
                  </div>
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
                      {inr(Math.max(0, base + extraCharge - gomaaCut))}
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

              {/* ---------------- SECTION 0: Gaushala Category Base Price Matrix ---------------- */}
              <div className="bg-card border border-line rounded-sm p-5 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-600" />
                      <h3 className="font-serif text-[16px] font-semibold text-ink">
                        Category Base Price Standard · {activeGosala.name}
                      </h3>
                    </div>
                    <p className="text-[12px] text-ink-soft mt-0.5">
                      Base 60-min darshan rates per cattle category at this sanctuary (Super Admin exclusive)
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleOpenAddBovine}
                        className="px-3 py-1.5 rounded-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-[12px] font-medium flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add Custom Category</span>
                      </button>
                      {isEditingBaseRates ? (
                        <>
                          <button
                            onClick={() => {
                              setBaseCow(activeGosala.baseCowPrice ?? 3500)
                              setBasePair(activeGosala.basePairPrice ?? 4800)
                              setBaseCalf(activeGosala.baseCalfPrice ?? 2500)
                              setBaseBull(activeGosala.baseBullPrice ?? 4500)
                              setBaseBuffalo(activeGosala.baseBuffaloPrice ?? 3200)
                              setCustomCommission(
                                activeGosala.customCommissionPct !== undefined
                                  ? activeGosala.customCommissionPct
                                  : ""
                              )
                              setIsEditingBaseRates(false)
                            }}
                            className="px-3 py-1.5 rounded-sm border border-line bg-paper text-ink-soft text-[12px] hover:text-ink cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveBaseRates}
                            className="px-3.5 py-1.5 rounded-sm bg-forest text-white text-[12px] font-medium hover:bg-forest-deep flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <Save size={13} />
                            <span>Save Rates</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setIsEditingBaseRates(true)}
                          className="px-3.5 py-1.5 rounded-sm bg-paper border border-line text-ink text-[12px] font-medium hover:bg-paper-deep flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Edit2 size={13} />
                          <span>Edit Standard Rates</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Category 1: Cow & Calf Pair */}
                  <div className="p-3.5 rounded border border-amber-300 bg-amber-50/50 space-y-1.5 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-amber-800 font-bold">
                        Special Jodi Seva
                      </span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded font-semibold">
                        Mother + Calf
                      </span>
                    </div>
                    <div className="font-serif text-[13.5px] font-semibold text-ink leading-tight">
                      Cow & Calf Pair (Gau-Vatsa)
                    </div>
                    <div className="text-[11px] text-ink-faint">Single-time joint seva</div>
                    <div className="pt-1 border-t border-amber-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-ink-faint">Base Rate</span>
                      {isEditingBaseRates ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-ink-faint">₹</span>
                          <input
                            type="number"
                            value={basePair}
                            onChange={(e) => setBasePair(Number(e.target.value))}
                            className="w-20 bg-card border border-amber-400 rounded px-1.5 py-0.5 text-[13px] font-mono font-bold text-ink"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-[15px] font-bold text-amber-900 tabular">
                          {inr(basePair)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category 2: Cow */}
                  <div className="p-3.5 rounded border border-line bg-paper space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-forest font-bold">
                        Standard Gau Mata
                      </span>
                      <span className="h-2 w-2 rounded-full bg-forest" />
                    </div>
                    <div className="font-serif text-[13.5px] font-semibold text-ink leading-tight">
                      Sacred Cow (Gau Mata)
                    </div>
                    <div className="text-[11px] text-ink-faint">Individual mother cow</div>
                    <div className="pt-1 border-t border-line flex items-center justify-between">
                      <span className="text-[11px] text-ink-faint">Base Rate</span>
                      {isEditingBaseRates ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-ink-faint">₹</span>
                          <input
                            type="number"
                            value={baseCow}
                            onChange={(e) => setBaseCow(Number(e.target.value))}
                            className="w-20 bg-card border border-forest rounded px-1.5 py-0.5 text-[13px] font-mono font-bold text-ink"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-[15px] font-bold text-forest tabular">
                          {inr(baseCow)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category 3: Calf */}
                  <div className="p-3.5 rounded border border-line bg-paper space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-saffron-deep font-bold">
                        Young Bovine
                      </span>
                      <span className="h-2 w-2 rounded-full bg-saffron" />
                    </div>
                    <div className="font-serif text-[13.5px] font-semibold text-ink leading-tight">
                      Calf (Vatsa)
                    </div>
                    <div className="text-[11px] text-ink-faint">Young calf darshan</div>
                    <div className="pt-1 border-t border-line flex items-center justify-between">
                      <span className="text-[11px] text-ink-faint">Base Rate</span>
                      {isEditingBaseRates ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-ink-faint">₹</span>
                          <input
                            type="number"
                            value={baseCalf}
                            onChange={(e) => setBaseCalf(Number(e.target.value))}
                            className="w-20 bg-card border border-saffron rounded px-1.5 py-0.5 text-[13px] font-mono font-bold text-ink"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-[15px] font-bold text-ink tabular">
                          {inr(baseCalf)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category 4: Bull */}
                  <div className="p-3.5 rounded border border-line bg-paper space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-soft font-bold">
                        Sacred Nandi
                      </span>
                      <span className="h-2 w-2 rounded-full bg-ink" />
                    </div>
                    <div className="font-serif text-[13.5px] font-semibold text-ink leading-tight">
                      Bull (Nandi)
                    </div>
                    <div className="text-[11px] text-ink-faint">Temple pradakshina & puja</div>
                    <div className="pt-1 border-t border-line flex items-center justify-between">
                      <span className="text-[11px] text-ink-faint">Base Rate</span>
                      {isEditingBaseRates ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-ink-faint">₹</span>
                          <input
                            type="number"
                            value={baseBull}
                            onChange={(e) => setBaseBull(Number(e.target.value))}
                            className="w-20 bg-card border border-line-strong rounded px-1.5 py-0.5 text-[13px] font-mono font-bold text-ink"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-[15px] font-bold text-ink tabular">
                          {inr(baseBull)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category 5: Buffalo */}
                  <div className="p-3.5 rounded border border-indigo-200 bg-indigo-50/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-800 font-bold">
                        Mahishi Seva
                      </span>
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    </div>
                    <div className="font-serif text-[13.5px] font-semibold text-ink leading-tight">
                      Buffalo (Mahishi)
                    </div>
                    <div className="text-[11px] text-ink-faint">Indigenous sacred buffalo</div>
                    <div className="pt-1 border-t border-indigo-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-ink-faint">Base Rate</span>
                      {isEditingBaseRates ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-ink-faint">₹</span>
                          <input
                            type="number"
                            value={baseBuffalo}
                            onChange={(e) => setBaseBuffalo(Number(e.target.value))}
                            className="w-20 bg-card border border-indigo-400 rounded px-1.5 py-0.5 text-[13px] font-mono font-bold text-ink"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-[15px] font-bold text-indigo-950 tabular">
                          {inr(baseBuffalo)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Custom Bovine Categories added by Super Admin */}
                  {activeGosala.customBovineCategories &&
                    activeGosala.customBovineCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className="p-3.5 rounded border border-amber-300 bg-amber-50/40 space-y-1.5 relative overflow-hidden group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-amber-900 font-bold truncate max-w-[110px]">
                            {cat.badgeText || "Custom Bovine"}
                          </span>
                          {isSuperAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditBovine(cat)}
                                className="p-0.5 text-amber-700 hover:text-amber-950 transition cursor-pointer"
                                title="Edit custom bovine category"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteBovine(cat.id)}
                                className="p-0.5 text-rose-600 hover:text-rose-800 transition cursor-pointer"
                                title="Delete custom bovine category"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="font-serif text-[13.5px] font-semibold text-ink leading-tight truncate">
                          {cat.name}
                        </div>
                        <div className="text-[11px] text-ink-faint line-clamp-1">
                          {cat.description || "Custom sacred bovine category"}
                        </div>
                        <div className="pt-1 border-t border-amber-200/60 flex items-center justify-between">
                          <span className="text-[11px] text-ink-faint">Base Rate</span>
                          <span className="font-mono text-[15px] font-bold text-amber-900 tabular">
                            {inr(cat.basePrice)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Gaushala Custom Commission Override */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 border border-amber-200/90 rounded p-3 mt-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                      <Percent size={14} />
                    </div>
                    <div>
                      <div className="text-[12.5px] font-semibold text-amber-950">
                        Sanctuary Commission Override
                      </div>
                      <p className="text-[11px] text-amber-900/80">
                        Overrides global master commission ({commission}%). Leave blank to inherit global rate.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-[11.5px] text-ink-soft">Override %:</span>
                    <input
                      type="number"
                      disabled={!isSuperAdmin || !isEditingBaseRates}
                      placeholder={`${commission}%`}
                      value={customCommission}
                      onChange={(e) =>
                        setCustomCommission(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-20 bg-card border border-amber-300 rounded px-2 py-1 text-[12.5px] font-mono text-ink text-right disabled:opacity-70"
                    />
                    <span className="text-[12px] font-mono font-bold text-amber-950">%</span>
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
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium">{animal.type}</span>
                                  {animal.type === "Cow & Calf" && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold border border-amber-300">
                                      Jodi Seva
                                    </span>
                                  )}
                                  {animal.type === "Buffalo" && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 text-indigo-800 rounded font-medium border border-indigo-200">
                                      Mahishi
                                    </span>
                                  )}
                                </div>
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
      {/* SECTOR 3: GAUSHALA COMMISSION, TAX & SETTLEMENT GOVERNANCE MODULE        */}
      {/* ========================================================================= */}
      {sector === "commissions" && (
        <div className="space-y-6">
          {/* Sector 3 Sovereign Header Banner */}
          <div className="rounded-sm border border-amber-300/80 bg-linear-to-r from-amber-50 via-amber-100/50 to-amber-50/20 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-sm bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <BadgePercent size={22} className="stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-[17px] font-semibold text-amber-950">
                      Captain's Gaushala Commission, Tax &amp; Settlement Governance
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-600 text-white shadow-2xs">
                      <Crown size={11} /> Sovereign Settlement Engine
                    </span>
                  </div>
                  <p className="text-[12px] text-amber-900/80 mt-1 max-w-3xl leading-relaxed">
                    Configure tailored financial parameters per individual Gaushala. Assign preferential low-commission rates
                    (5%–10%) to close partner sanctuaries, manage Section 80G tax exemptions, adjust animal turnaround rest buffers,
                    and simulate real-time net direct payouts with an accurate mathematical flow.
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

            {/* Quick Metrics Strip */}
            <div className="mt-4 pt-3.5 border-t border-amber-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-ink">
              <div className="bg-white/80 border border-amber-200/80 rounded p-2.5">
                <span className="text-[10.5px] font-mono uppercase text-ink-faint block">Total Network Sanctuaries</span>
                <span className="font-serif text-[19px] font-bold text-ink">{gosalas.length}</span>
                <span className="text-[10.5px] text-forest block font-medium">AWBI Verified</span>
              </div>
              <div className="bg-white/80 border border-amber-200/80 rounded p-2.5">
                <span className="text-[10.5px] font-mono uppercase text-ink-faint block">Preferential / Subsidized</span>
                <span className="font-serif text-[19px] font-bold text-emerald-800">
                  {gosalas.filter((g) => g.customCommissionPct !== undefined && g.customCommissionPct < commission).length}
                </span>
                <span className="text-[10.5px] text-emerald-700 block font-medium">Special Low Comm (&lt;{commission}%)</span>
              </div>
              <div className="bg-white/80 border border-amber-200/80 rounded p-2.5">
                <span className="text-[10.5px] font-mono uppercase text-ink-faint block">80G Tax-Exempt Trusts</span>
                <span className="font-serif text-[19px] font-bold text-indigo-900">
                  {gosalas.filter((g) => g.taxTreatment === "section_80g_exempt" || g.customTaxPct === 0).length}
                </span>
                <span className="text-[10.5px] text-indigo-700 block font-medium">0% Tax Exemption</span>
              </div>
              <div className="bg-white/80 border border-amber-200/80 rounded p-2.5">
                <span className="text-[10.5px] font-mono uppercase text-ink-faint block">Platform Master Default</span>
                <span className="font-serif text-[19px] font-bold text-amber-950">{commission}%</span>
                <span className="text-[10.5px] text-amber-800 block font-mono">Baseline Rate</span>
              </div>
            </div>
          </div>

          {/* Master Gaushala Commission & Economics Ledger */}
          <Panel>
            <PanelHead
              title="Individual Gaushala Economics Ledger"
              desc="Comprehensive settlement parameters, preferential partnership tiers, and tax profiles per sanctuary"
              right={
                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input
                      value={commSearch}
                      onChange={(e) => setCommSearch(e.target.value)}
                      placeholder="Search Gaushala or region..."
                      className="w-full bg-paper border border-line rounded-xs pl-8 pr-2.5 py-1 text-[12px] text-ink placeholder:text-ink-faint outline-none focus:border-saffron"
                    />
                  </div>
                </div>
              }
            />

            {/* Filter Pills */}
            <div className="px-5 pt-3 pb-1 border-b border-line flex items-center gap-2 overflow-x-auto text-[11.5px]">
              <span className="text-ink-faint flex items-center gap-1 font-mono uppercase text-[10px]">
                <Filter size={11} /> Filter:
              </span>
              {[
                { id: "all", label: `All (${gosalas.length})` },
                {
                  id: "preferred",
                  label: `★ Preferred Low Comm (${
                    gosalas.filter((g) => g.partnershipTier === "PREFERRED" || (g.customCommissionPct !== undefined && g.customCommissionPct < commission)).length
                  })`,
                },
                {
                  id: "charitable",
                  label: `Charitable Seva (≤5%) (${
                    gosalas.filter((g) => g.partnershipTier === "CHARITABLE" || (g.customCommissionPct !== undefined && g.customCommissionPct <= 5)).length
                  })`,
                },
                {
                  id: "tax_exempt",
                  label: `80G Tax Exempt (${
                    gosalas.filter((g) => g.taxTreatment === "section_80g_exempt" || g.customTaxPct === 0).length
                  })`,
                },
                {
                  id: "standard",
                  label: `Standard Default (${commission}%) (${
                    gosalas.filter((g) => (!g.partnershipTier || g.partnershipTier === "STANDARD") && (g.customCommissionPct === undefined || g.customCommissionPct === commission)).length
                  })`,
                },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setCommTierFilter(pill.id as any)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-medium ${
                    commTierFilter === pill.id
                      ? "bg-amber-600 text-white font-semibold shadow-2xs"
                      : "bg-paper text-ink-soft border border-line hover:text-ink hover:border-line-strong"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px] text-left">
                <thead>
                  <tr className="bg-paper-deep/40 border-b border-line text-[10.5px] font-mono uppercase tracking-wider text-ink-faint">
                    <th className="px-5 py-3 font-medium">Gaushala &amp; Region</th>
                    <th className="px-4 py-3 font-medium">Partnership Tier</th>
                    <th className="px-4 py-3 font-medium">Commission Rate</th>
                    <th className="px-4 py-3 font-medium">Tax Treatment</th>
                    <th className="px-4 py-3 font-medium">Rest Buffer</th>
                    <th className="px-4 py-3 font-medium">Partnership Rationale</th>
                    {isSuperAdmin && <th className="px-5 py-3 font-medium text-right">Super Admin Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filteredCommGosalas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-ink-faint">
                        <Building2 size={24} className="mx-auto mb-2 opacity-50 text-ink-faint" />
                        <p className="font-medium text-ink">No Gaushalas match your filter</p>
                        <p className="text-[12px] mt-0.5">Try searching for another name or clearing the filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCommGosalas.map((g) => {
                      const commPct = g.customCommissionPct ?? commission
                      const isSubsidized = g.customCommissionPct !== undefined && g.customCommissionPct < commission
                      const isFlat = g.commissionType === "fixed"
                      const tier = g.partnershipTier || (isSubsidized ? "PREFERRED" : "STANDARD")
                      const is80g = g.taxTreatment === "section_80g_exempt" || g.customTaxPct === 0
                      const buf = g.bufferMinutes ?? bufferMin

                      return (
                        <tr key={g.id} className="hover:bg-paper/50 transition-colors text-[13px]">
                          <td className="px-5 py-3.5">
                            <div className="font-serif font-semibold text-ink flex items-center gap-2">
                              <span>{g.name}</span>
                              {tier === "PREFERRED" && (
                                <Star size={13} className="text-amber-500 fill-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="text-[11.5px] text-ink-soft">{g.region}</div>
                            <div className="text-[10px] text-ink-faint font-mono mt-0.5">
                              Reg: {g.trustRegistrationNo || "AWBI Verified"} • Custodian: {g.managerName || "Designated"}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            {tier === "PREFERRED" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-300">
                                <Star size={10} className="fill-emerald-700" /> Preferred Partner
                              </span>
                            )}
                            {tier === "CHARITABLE" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
                                <Handshake size={10} /> Charitable Seva
                              </span>
                            )}
                            {tier === "STANDARD" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-paper-deep text-ink-soft border border-line">
                                Standard Affiliate
                              </span>
                            )}
                            {tier === "COMMERCIAL" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
                                Commercial Enterprise
                              </span>
                            )}
                            {tier === "CUSTOM" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-300">
                                Bilateral Custom
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            {isFlat ? (
                              <div>
                                <span className="font-mono font-bold text-ink">
                                  {inr(g.customCommissionFlat || 400)}
                                </span>
                                <span className="text-[10px] text-ink-faint block font-mono">Flat / booking</span>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-mono font-bold text-[14px] ${isSubsidized ? "text-emerald-800" : "text-ink"}`}>
                                    {commPct}%
                                  </span>
                                  {isSubsidized && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-100 text-emerald-900 rounded font-semibold">
                                      -{commission - commPct}% off
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10.5px] text-ink-faint block">
                                  {g.customCommissionPct !== undefined ? "Individual Override" : "Master Default"}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            {is80g ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                0% Tax (80G Exempt)
                              </span>
                            ) : g.taxTreatment === "reduced_charity_gst" || g.customTaxPct === 5 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                                5% Concessional GST
                              </span>
                            ) : g.customTaxPct !== undefined ? (
                              <span className="font-mono text-ink font-semibold">
                                {g.customTaxPct}% Custom Tax
                              </span>
                            ) : (
                              <span className="font-mono text-ink-soft">
                                {taxPct}% Standard GST
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="font-mono text-[12px] bg-paper px-2 py-0.5 rounded border border-line">
                              {buf} min rest
                            </span>
                          </td>

                          <td className="px-4 py-3.5 max-w-[240px]">
                            {g.partnershipNotes ? (
                              <p className="text-[12px] text-ink-soft line-clamp-2 leading-relaxed italic">
                                "{g.partnershipNotes}"
                              </p>
                            ) : (
                              <span className="text-[11.5px] text-ink-faint italic font-mono">
                                Standard regional trust agreement
                              </span>
                            )}
                          </td>

                          {isSuperAdmin && (
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditEconomics(g)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[11.5px] font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                >
                                  <Edit2 size={12} />
                                  <span>Configure</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSimGosalaId(g.id)}
                                  className="p-1 text-ink-soft hover:text-ink hover:bg-paper-deep rounded transition cursor-pointer"
                                  title="Load in Settlement Simulator"
                                >
                                  <Calculator size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Interactive Live Settlement & Payout Simulator (Accurate Flow) */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
            <Panel>
              <PanelHead
                title="Interactive Settlement & Fund Flow Simulator"
                desc="Client-side calculation sandbox — test 'what-if' splits in real time (Zero impact on PostgreSQL database until saved)"
                right={
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] text-ink-faint">Active Sanctuary:</span>
                    <select
                      value={simGosalaId}
                      onChange={(e) => setSimGosalaId(e.target.value)}
                      className="bg-card border border-line rounded px-2.5 py-1 text-[12px] font-medium text-ink outline-none focus:border-amber-600"
                    >
                      {gosalas.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.customCommissionPct !== undefined ? `${g.customCommissionPct}% comm` : `${commission}% default`})
                        </option>
                      ))}
                    </select>
                  </div>
                }
              />

              <div className="p-5 space-y-5">
                {/* Sandbox Clarity Notification */}
                <div className="p-3.5 bg-sky-50/80 border border-sky-200 rounded text-[12px] text-sky-900 flex items-start gap-3">
                  <div className="w-7 h-7 rounded bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Calculator size={15} />
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="font-semibold text-sky-950 flex flex-wrap items-center gap-2">
                      <span>Calculation Sandbox / Simulation Mode</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-100 text-sky-800 border border-sky-300 font-bold uppercase tracking-wider">
                        SIMULATION ONLY · NO DATABASE CHANGES
                      </span>
                    </div>
                    <p className="text-sky-800/90 leading-relaxed text-[11.5px]">
                      The inputs below (Base Darshan Rate, Duration, Transit, Offerings) are an <strong>in-memory testing simulator</strong>. Scrolling or adjusting values here calculates financial formulas dynamically on your screen without modifying the database. Live database settings require clicking an explicit <strong>Save</strong> or <strong>Publish</strong> button.
                    </p>
                  </div>
                </div>

                {/* Selected Sanctuary Status Ribbon */}
                {simGosala && (
                  <div className="p-3.5 rounded bg-linear-to-r from-amber-50 via-paper to-amber-50/30 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                        <Building2 size={15} />
                      </div>
                      <div>
                        <div className="font-serif text-[14px] font-semibold text-ink">
                          {simGosala.name} · {simGosala.region}
                        </div>
                        <div className="text-ink-soft text-[11.5px]">
                          Tier: <strong>{simGosala.partnershipTier || "STANDARD"}</strong> •
                          Commission: <strong className="text-emerald-800 font-mono font-bold">{simEffectiveCommPct}%</strong> •
                          Tax Status: <strong className="font-mono">{simEffectiveTaxPct}%</strong> •
                          Buffer: <strong className="font-mono">{simEffectiveBuffer} min</strong>
                        </div>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <button
                        onClick={() => handleOpenEditEconomics(simGosala)}
                        className="px-3 py-1 bg-white border border-amber-300 rounded text-amber-900 font-medium hover:bg-amber-50 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                      >
                        Adjust Terms
                      </button>
                    )}
                  </div>
                )}

                {/* Simulation Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Field label="Base Darshan Rate (Simulated)" hint="₹ INR">
                    <input
                      type="number"
                      value={simBasePrice}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setSimBasePrice(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Booking Duration (Simulated)" hint="minutes">
                    <input
                      type="number"
                      value={simDurationMin}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setSimDurationMin(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Transit Distance (Simulated)" hint="km road distance">
                    <input
                      type="number"
                      step="0.5"
                      value={simDistanceKm}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setSimDistanceKm(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Consecrated Add-ons (Simulated)" hint="₹ pooja/garland">
                    <input
                      type="number"
                      value={simAddons}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setSimAddons(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                </div>

                {/* Explicit Simulator Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-line/60">
                  <button
                    type="button"
                    onClick={() => {
                      setSimBasePrice(simGosala?.baseCowPrice ?? 3500)
                      setSimDurationMin(standardMin)
                      setSimDistanceKm(12.5)
                      setSimAddons(750)
                      notify("Reset simulation values to sanctuary standard defaults", "info")
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium text-ink-soft hover:text-ink border border-line bg-card rounded hover:bg-paper cursor-pointer transition shadow-2xs"
                  >
                    <RotateCcw size={12} />
                    <span>Reset Simulation to Sanctuary Defaults</span>
                  </button>

                  {isSuperAdmin && simGosala && (
                    <button
                      type="button"
                      onClick={() => {
                        updateGosala(simGosala.id, { baseCowPrice: Number(simBasePrice) })
                        notify(`Persisted base rate of ${inr(simBasePrice)} to database for ${simGosala.name}`, "ok")
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-white bg-forest hover:bg-forest-deep rounded shadow-2xs cursor-pointer transition"
                    >
                      <Save size={13} />
                      <span>Save {inr(simBasePrice)} as Sanctuary Base Rate</span>
                    </button>
                  )}
                </div>

                {/* Mathematical Accurate Step-by-Step Fund Flow */}
                <div className="rounded border border-line bg-paper p-4 space-y-3">
                  <div className="font-serif text-[14px] font-semibold text-ink flex items-center justify-between border-b border-line pb-2">
                    <span>Accurate Financial Settlement Flow</span>
                    <span className="font-mono text-[11px] text-ink-faint">Zero-Discrepancy Formula</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12.5px]">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-ink-soft">1. Base Bovine Seva ({standardMin} min):</span>
                        <span className="font-mono font-medium text-ink tabular">{inr(simBasePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-soft">2. Extra Time ({simExtraMin} min):</span>
                        <span className="font-mono font-medium text-ink tabular">{inr(simExtraCharge)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-soft">3. Transit ({simChargeableKm.toFixed(1)} km billable):</span>
                        <span className="font-mono font-medium text-ink tabular">{inr(simTransport)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-soft">4. Fodder &amp; Pooja Add-ons:</span>
                        <span className="font-mono font-medium text-ink tabular">{inr(simAddons)}</span>
                      </div>
                    </div>

                    <div className="space-y-2 border-t md:border-t-0 md:border-l border-line pt-2 md:pt-0 md:pl-4">
                      <div className="flex justify-between font-semibold">
                        <span className="text-ink">Gross Booking Subtotal:</span>
                        <span className="font-mono text-ink tabular">{inr(simSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-indigo-900">
                        <span className="text-ink-soft">
                          Applied Tax ({simEffectiveTaxPct}% {simEffectiveTaxPct === 0 ? "80G Exempt" : "GST"}):
                        </span>
                        <span className="font-mono font-semibold tabular">{inr(simTax)}</span>
                      </div>
                      <div className="flex justify-between font-bold pt-1 border-t border-line text-ink">
                        <span>Devotee Total Paid:</span>
                        <span className="font-mono text-[15px] tabular">{inr(simCustomerTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Fund Split & Direct Settlement Breakdown */}
            <Panel>
              <PanelHead
                title="Settlement Split & Net Payout"
                desc="Platform cut vs Gaushala net share"
              />
              <div className="p-5 space-y-4">
                {/* Visual Proportion Bar */}
                <div>
                  <div className="flex justify-between text-[11.5px] font-mono text-ink-faint mb-1">
                    <span>Gaushala Share ({100 - simEffectiveCommPct}%)</span>
                    <span>GOMAA ({simEffectiveCommPct}%)</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-paper-deep overflow-hidden flex border border-line">
                    <div
                      className="bg-emerald-600 transition-all duration-300"
                      style={{ width: `${Math.max(5, 100 - simEffectiveCommPct)}%` }}
                      title={`Gaushala Net Share: ${100 - simEffectiveCommPct}%`}
                    />
                    <div
                      className="bg-amber-600 transition-all duration-300"
                      style={{ width: `${Math.min(95, simEffectiveCommPct)}%` }}
                      title={`GOMAA Platform Fee: ${simEffectiveCommPct}%`}
                    />
                  </div>
                </div>

                <div className="space-y-2.5 text-[13px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Gross Darshan + Transit:</span>
                    <span className="font-mono text-ink tabular">{inr(simSubtotal)}</span>
                  </div>

                  <div className="flex justify-between text-amber-900 bg-amber-50/70 p-2 rounded">
                    <div>
                      <span className="font-medium text-amber-950 block">GOMAA Platform Retained</span>
                      <span className="text-[11px] text-amber-800">
                        {simEffectiveCommPct}% of seva ({inr(simBasePrice + simExtraCharge)})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-950 tabular self-center text-[14px]">
                      {inr(simGomaaCut)}
                    </span>
                  </div>

                  <div className="flex justify-between text-forest bg-emerald-50/70 p-2.5 rounded border border-emerald-200/80">
                    <div>
                      <span className="font-medium text-forest-deep block text-[13.5px]">
                        Gaushala Direct Net Settlement
                      </span>
                      <span className="text-[11px] text-forest">
                        Seva ({100 - simEffectiveCommPct}%) + 100% Transit &amp; Add-ons
                      </span>
                    </div>
                    <span className="font-mono font-bold text-forest-deep tabular self-center text-[16px]">
                      {inr(simGosalaPayable)}
                    </span>
                  </div>
                </div>

                {/* Sanctuary Advantage / Savings Badge */}
                {simSanctuarySavings > 0 ? (
                  <div className="rounded p-3 bg-emerald-100/70 border border-emerald-300 text-emerald-950 text-[12px] space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-emerald-900">
                      <Star size={13} className="fill-emerald-700 text-emerald-700 shrink-0" />
                      <span>Preferential Sanctuary Advantage</span>
                    </div>
                    <p className="text-emerald-900/90 leading-relaxed">
                      Compared to the standard {commission}% platform rate ({inr(simStandardGomaaCut)}),
                      this sanctuary retains an extra <strong>{inr(simSanctuarySavings)}</strong> per booking to fund fodder &amp; cow welfare!
                    </p>
                  </div>
                ) : (
                  <div className="rounded p-3 bg-paper border border-line text-ink-soft text-[11.5px]">
                    <span className="font-medium text-ink block">Standard Affiliate Split</span>
                    <span>Standard platform {commission}% commission applied to bovine darshan seva.</span>
                  </div>
                )}

                <div className="pt-2 border-t border-line text-[11px] text-ink-faint font-mono flex items-center justify-between">
                  <span>Settlement Dispatch Mode:</span>
                  <span className="text-ink font-semibold">Automated Weekly NACH</span>
                </div>
              </div>
            </Panel>
          </div>
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

      {/* ========================================================================= */}
      {/* MODAL: DYNAMIC DELETE DEVOTIONAL OFFERING CONFIRMATION                   */}
      {/* ========================================================================= */}
      {deleteItemModalOpen && itemToDelete && activeGosala && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={handleCancelDeleteItem}
        >
          <div 
            className="bg-card border border-rose-300/90 rounded-md w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-line pb-3.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Trash2 size={20} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-serif text-[18px] font-semibold text-ink leading-tight">
                    Remove Offering Item?
                  </h3>
                  <p className="text-[12px] text-ink-faint mt-0.5">
                    Review item details below before confirming removal from this shelter
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelDeleteItem}
                className="text-ink-faint hover:text-ink transition p-1 rounded-sm hover:bg-paper-deep cursor-pointer"
                title="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Target Gaushala Origin Banner */}
            <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/90 rounded px-3.5 py-2 text-[12px]">
              <div className="flex items-center gap-2 text-amber-950 font-medium truncate">
                <Building2 size={15} className="text-amber-700 shrink-0" />
                <span className="truncate">Gaushala: <strong>{activeGosala.name}</strong></span>
              </div>
              {activeGosala.region && (
                <span className="text-[10px] font-mono bg-amber-200/70 text-amber-900 px-2.5 py-0.5 rounded-full font-semibold shrink-0">
                  {activeGosala.region}
                </span>
              )}
            </div>

            {/* Comprehensive Item Dossier (What we are really deleting) */}
            <div className="bg-paper border border-line rounded-md p-4 space-y-3 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {(() => {
                      const catBadge = CATEGORY_COLORS[itemToDelete.category] || CATEGORY_COLORS.puja
                      return (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${catBadge.bg}`}>
                          {catBadge.label}
                        </span>
                      )
                    })()}
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${
                        itemToDelete.inStock
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${itemToDelete.inStock ? "bg-emerald-600" : "bg-rose-600"}`} />
                      {itemToDelete.inStock ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                  <h4 className="font-serif text-[17px] font-bold text-ink leading-snug">
                    {itemToDelete.name}
                  </h4>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono uppercase text-ink-faint">Seva Price</div>
                  <div className="font-mono text-[20px] font-bold text-amber-900 tabular">
                    ₹{itemToDelete.price}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="text-[12.5px] text-ink-soft bg-card border border-line/70 rounded p-2.5 leading-relaxed">
                <span className="font-semibold text-ink text-[10.5px] uppercase tracking-wider block mb-0.5 font-mono text-ink-faint">
                  Devotional Meaning &amp; Details:
                </span>
                {itemToDelete.desc || "No special devotional description provided."}
              </div>

              {/* Attribute Grid */}
              <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11.5px] font-mono">
                <div className="bg-card border border-line/70 rounded px-2.5 py-1.5 flex items-center justify-between">
                  <span className="text-ink-faint">Max Allowed / Order:</span>
                  <span className="font-semibold text-ink">{itemToDelete.maxQty || 5} units</span>
                </div>
                <div className="bg-card border border-line/70 rounded px-2.5 py-1.5 flex items-center justify-between">
                  <span className="text-ink-faint">Item Unique ID:</span>
                  <span className="font-semibold text-ink truncate max-w-[90px]">{itemToDelete.id}</span>
                </div>
              </div>
            </div>

            {/* Impact & Warning Notice */}
            <div className="bg-rose-50/70 border border-rose-200/90 rounded p-3 text-[11.5px] text-rose-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-900">
                <ShieldAlert size={14} className="text-rose-600 shrink-0" />
                <span>Devotee Catalog Impact</span>
              </div>
              <p className="leading-relaxed text-rose-900/90 pl-5">
                This item will be immediately delisted from the devotee puja booking tray for <strong>{activeGosala.name}</strong>. Devotees placing new seva requests will not be able to order this item.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
              <button
                type="button"
                onClick={handleCancelDeleteItem}
                className="px-4 py-2 border border-line rounded text-[12.5px] font-medium text-ink-soft hover:text-ink hover:bg-paper-deep transition cursor-pointer"
              >
                Cancel / Keep Item
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded text-[12.5px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-2"
              >
                <Trash2 size={14} />
                <span>Delete Offering</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: ADD / EDIT DYNAMIC VALUE PROPORTIONATE (SUPER ADMIN ONLY)         */}
      {/* ========================================================================= */}
      {feeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-amber-300 rounded-sm w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-600" />
                <h3 className="font-serif text-[17px] font-semibold text-ink">
                  {editingFeeId ? "Edit Dynamic Proportionate" : "Add Dynamic Proportionate Surcharge"}
                </h3>
              </div>
              <button
                onClick={() => setFeeModalOpen(false)}
                className="text-ink-faint hover:text-ink transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-[11.5px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded px-3 py-1.5 font-mono">
              Scope: <strong>Platform Global Master Economics (PostgreSQL Sync)</strong>
            </div>

            <div className="space-y-3.5">
              <Field label="Proportionate Surcharge Name" hint="e.g. Festival Surge, Cow Fodder Welfare Levy">
                <input
                  value={feeName}
                  onChange={(e) => setFeeName(e.target.value)}
                  placeholder="Enter custom surcharge title"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Calculation Mode">
                  <select
                    value={feeType}
                    onChange={(e) => setFeeType(e.target.value as "fixed" | "percentage")}
                    className={inputCls}
                  >
                    <option value="fixed">Fixed ₹ Flat Amount</option>
                    <option value="percentage">Percentage % Proportion</option>
                  </select>
                </Field>

                <Field label="Value" hint={feeType === "fixed" ? "₹ INR" : "% Percent"}>
                  <input
                    type="number"
                    value={feeValue}
                    onChange={(e) => setFeeValue(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
              </div>

              {feeType === "percentage" && (
                <Field label="Proportion Calculation Base" hint="What this percentage is calculated on">
                  <select
                    value={feeAppliedOn}
                    onChange={(e) => setFeeAppliedOn(e.target.value as "base" | "total" | "transport")}
                    className={inputCls}
                  >
                    <option value="total">Subtotal (Base + Extra + Transport + Add-ons)</option>
                    <option value="base">Base Darshan Seva Only</option>
                    <option value="transport">Transport Distance Only</option>
                  </select>
                </Field>
              )}

              <Field label="Description & Rationale" hint="Purpose shown to auditors and administrators">
                <textarea
                  rows={2}
                  value={feeDescription}
                  onChange={(e) => setFeeDescription(e.target.value)}
                  placeholder="Explain why this dynamic proportionate applies"
                  className={`${inputCls} font-sans`}
                />
              </Field>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feeEnabled}
                    onChange={(e) => setFeeEnabled(e.target.checked)}
                    className="accent-amber-600 rounded"
                  />
                  <span className="text-[12.5px] font-medium text-ink">Active &amp; Applied Immediately in Live Calculations</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setFeeModalOpen(false)}
                className="px-3 py-1.5 text-[12.5px] text-ink-soft hover:text-ink transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFee}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded text-[12.5px] font-medium hover:opacity-90 transition cursor-pointer shadow-2xs"
              >
                {editingFeeId ? "Save Dynamic Proportionate" : "Add to Platform Config"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CUSTOM BOVINE CATEGORY (SUPER ADMIN ONLY)              */}
      {/* ========================================================================= */}
      {bovineModalOpen && activeGosala && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-amber-300 rounded-sm w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-amber-600" />
                <h3 className="font-serif text-[17px] font-semibold text-ink">
                  {editingBovineId ? "Edit Custom Bovine Category" : "Add Custom Bovine Category"}
                </h3>
              </div>
              <button
                onClick={() => setBovineModalOpen(false)}
                className="text-ink-faint hover:text-ink transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-[11.5px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded px-3 py-1.5 font-mono">
              Target Sanctuary: <strong>{activeGosala.name}</strong>
            </div>

            <div className="space-y-3.5">
              <Field label="Bovine Category Name" hint="e.g. Punganur Miniature Cow, Vedic Homa Pair">
                <input
                  value={bovineName}
                  onChange={(e) => setBovineName(e.target.value)}
                  placeholder="Enter custom category title"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Badge / Breed Tag" hint="e.g. Rare Indigenous, Vedic Seva">
                  <input
                    value={bovineBadgeText}
                    onChange={(e) => setBovineBadgeText(e.target.value)}
                    placeholder="Badge title"
                    className={inputCls}
                  />
                </Field>

                <Field label="Base Rate (60 min)" hint="₹ INR">
                  <input
                    type="number"
                    value={bovineBasePrice}
                    onChange={(e) => setBovineBasePrice(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Category Description" hint="Ceremonial context, significance, ritual suitability">
                <textarea
                  rows={2}
                  value={bovineDescription}
                  onChange={(e) => setBovineDescription(e.target.value)}
                  placeholder="Brief description for customer booking flows"
                  className={`${inputCls} font-sans`}
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setBovineModalOpen(false)}
                className="px-3 py-1.5 text-[12.5px] text-ink-soft hover:text-ink transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBovine}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded text-[12.5px] font-medium hover:opacity-90 transition cursor-pointer shadow-2xs"
              >
                {editingBovineId ? "Save Category Changes" : "Add to Sanctuary Slabs"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURE GAUSHALA ECONOMICS, COMMISSION & TAX (SUPER ADMIN)      */}
      {/* ========================================================================= */}
      {econModalOpen && econTargetGosala && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-amber-300 rounded-sm w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <BadgePercent size={20} className="text-amber-600" />
                <h3 className="font-serif text-[17px] font-semibold text-ink">
                  Configure Sanctuary Economics &amp; Commission
                </h3>
              </div>
              <button
                onClick={() => setEconModalOpen(false)}
                className="text-ink-faint hover:text-ink transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded px-3 py-2 flex items-center justify-between">
              <div>
                <strong>{econTargetGosala.name}</strong>
                <span className="text-ink-faint text-[11px] block">{econTargetGosala.region}</span>
              </div>
              <span className="font-mono text-[10.5px] bg-white text-amber-950 px-2 py-0.5 rounded border border-amber-200">
                {econTargetGosala.trustRegistrationNo || "AWBI Trust"}
              </span>
            </div>

            {/* Quick 1-Click Policy Presets */}
            <div className="bg-paper p-3 rounded border border-line space-y-1.5">
              <span className="text-[10.5px] font-mono uppercase text-ink-faint block">
                Quick Apply Sovereign Presets:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setEconTier("PREFERRED")
                    setEconCommType("percentage")
                    setEconCommValue(8)
                    setEconTaxTreatment("section_80g_exempt")
                    setEconCustomTaxPct(0)
                    setEconBufferMin(30)
                    setEconNotes("Close Partner Sanctuary - Subsidized 8% preferential commission")
                  }}
                  className="px-2.5 py-1 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-300 rounded font-medium hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                >
                  <Star size={11} className="fill-emerald-700" />
                  <span>Preferred Partner (8% Comm, 0% Tax)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEconTier("CHARITABLE")
                    setEconCommType("percentage")
                    setEconCommValue(5)
                    setEconTaxTreatment("section_80g_exempt")
                    setEconCustomTaxPct(0)
                    setEconBufferMin(45)
                    setEconNotes("Charitable Welfare Trust - Subsidized 5% seva rate")
                  }}
                  className="px-2.5 py-1 text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 rounded font-medium hover:bg-indigo-100 transition cursor-pointer"
                >
                  Charitable Seva (5% Comm)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEconTier("STANDARD")
                    setEconCommType("percentage")
                    setEconCommValue(commission)
                    setEconTaxTreatment("standard_gst")
                    setEconCustomTaxPct(taxPct)
                    setEconBufferMin(bufferMin)
                    setEconNotes("Standard Platform Affiliate")
                  }}
                  className="px-2.5 py-1 text-[11px] bg-paper-deep text-ink-soft border border-line rounded font-medium hover:text-ink transition cursor-pointer"
                >
                  Standard Default ({commission}%)
                </button>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Partnership Tier">
                  <select
                    value={econTier}
                    onChange={(e) => setEconTier(e.target.value as PartnershipTier)}
                    className={inputCls}
                  >
                    <option value="PREFERRED">★ Preferred Partner (Low Commission)</option>
                    <option value="CHARITABLE">Charitable Seva Trust (Subsidized)</option>
                    <option value="STANDARD">Standard Platform Affiliate</option>
                    <option value="COMMERCIAL">Commercial Enterprise</option>
                    <option value="CUSTOM">Bilateral Custom Slab</option>
                  </select>
                </Field>

                <Field label="Commission Model">
                  <select
                    value={econCommType}
                    onChange={(e) => setEconCommType(e.target.value as CommissionType)}
                    className={inputCls}
                  >
                    <option value="percentage">Percentage % Proportion</option>
                    <option value="fixed">Fixed Flat ₹ per booking</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={econCommType === "fixed" ? "Flat Commission" : "Commission Percentage"}
                  hint={econCommType === "fixed" ? "₹ INR" : "% Cut"}
                >
                  <input
                    type="number"
                    value={econCommValue}
                    onChange={(e) => setEconCommValue(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>

                <Field label="Rest Buffer Between Bookings" hint="minutes">
                  <input
                    type="number"
                    value={econBufferMin}
                    onChange={(e) => setEconBufferMin(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Trust Tax Treatment">
                  <select
                    value={econTaxTreatment}
                    onChange={(e) => setEconTaxTreatment(e.target.value as TaxTreatment)}
                    className={inputCls}
                  >
                    <option value="section_80g_exempt">Section 80G Exempt (0% Tax)</option>
                    <option value="reduced_charity_gst">Concessional Charity GST (5%)</option>
                    <option value="standard_gst">Standard Commercial GST (18%)</option>
                    <option value="custom_rate">Custom Tax Percentage</option>
                  </select>
                </Field>

                {econTaxTreatment === "custom_rate" ? (
                  <Field label="Custom Tax %" hint="%">
                    <input
                      type="number"
                      value={econCustomTaxPct}
                      onChange={(e) => setEconCustomTaxPct(Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                ) : (
                  <div className="flex flex-col justify-end pb-2">
                    <span className="text-[11.5px] text-ink-faint">
                      Effective Tax:{" "}
                      <strong className="text-ink font-mono">
                        {econTaxTreatment === "section_80g_exempt"
                          ? "0% (Exempt)"
                          : econTaxTreatment === "reduced_charity_gst"
                          ? "5%"
                          : "18%"}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              <Field label="Partnership Notes &amp; Rationale" hint="Visible in Super Admin ledger &amp; audit">
                <textarea
                  rows={2}
                  value={econNotes}
                  onChange={(e) => setEconNotes(e.target.value)}
                  placeholder="e.g. Partner sanctuary trust; 8% preferential commission agreed for high cattle standards"
                  className={`${inputCls} font-sans`}
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setEconModalOpen(false)}
                className="px-3 py-1.5 text-[12.5px] text-ink-soft hover:text-ink transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEconomics}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded text-[12.5px] font-medium hover:opacity-90 transition cursor-pointer shadow-2xs"
              >
                Save Economics Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Unsaved Changes Action Bar for Sector 1 */}
      {sector === "global" && isDirty && isSuperAdmin && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-ink text-paper px-5 py-2.5 rounded-full shadow-2xl border border-amber-500/50 flex items-center gap-4 text-[12.5px] backdrop-blur-md">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Unsaved pricing modifications pending</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-paper rounded-full text-[11.5px] font-medium transition cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Publish & Sync to DB</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
