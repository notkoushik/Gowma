import { useState, useEffect } from "react"
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, UserCheck, Building2, Check, Info } from "lucide-react"
import { roles, type Role, type RoleId } from "../data/roles"
import { initialProfiles } from "../data/profiles"
import { useStore } from "../store/store"

const flow = [
  "Slot held",
  "Payment verified",
  "Manager review",
  "Admin confirmed",
  "Driver assigned",
  "Settled",
]

function RoleCard({
  role,
  active,
  onSelect,
  profileName,
  className = "",
}: {
  role: Role
  active: boolean
  onSelect: () => void
  profileName?: string
  className?: string
}) {
  const Icon = role.icon
  const isSuperAdmin = role.id === "super_admin"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-sm border p-3 sm:p-3.5 transition-all ${className} ${
        active
          ? isSuperAdmin
            ? "border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/30"
            : "border-saffron bg-saffron-soft/50 ring-2 ring-saffron/20"
          : isSuperAdmin
            ? "border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-card hover:border-amber-400"
            : "border-line bg-card hover:border-line-strong"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`h-8 w-8 grid place-items-center rounded-sm shrink-0 ${
            active
              ? isSuperAdmin
                ? "bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-xs"
                : "bg-saffron text-white"
              : isSuperAdmin
                ? "bg-amber-100 text-amber-800"
                : "bg-paper-deep text-ink-soft"
          }`}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-ink leading-tight truncate flex items-center gap-1.5">
            <span>{profileName || role.name}</span>
            {isSuperAdmin && (
              <span className="font-mono text-[8.5px] uppercase font-bold tracking-wider px-1 py-0.2 bg-amber-600 text-white rounded">
                CAPTAIN
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-ink-faint leading-tight truncate mt-0.5">
            {isSuperAdmin ? "Supreme Authority · Treasury & Master Pricing" : `${role.name} · ${role.scope}`}
          </div>
        </div>
      </div>
    </button>
  )
}

export default function Login({
  onSignIn,
}: {
  onSignIn: (role: RoleId) => void
}) {
  const {
    profiles,
    managers,
    gosalas,
    updateProfile,
    setActiveManagerGosala,
    setActiveGosalaFilter,
  } = useStore()
  const [selected, setSelected] = useState<RoleId>("customer")
  const [showPw, setShowPw] = useState(false)
  const role = roles.find((r) => r.id === selected)!
  const currentProfile = profiles[selected]

  const [selectedManagerId, setSelectedManagerId] = useState<string>("")
  const [selectedManagerGosala, setSelectedManagerGosala] = useState<string>("")
  const [emailInput, setEmailInput] = useState<string>("")

  // Set default selected manager if available
  useEffect(() => {
    if (selected === "manager" && managers.length > 0) {
      const activeMgr =
        managers.find((m) => m.id === selectedManagerId) ||
        managers.find((m) => m.status !== "Inactive") ||
        managers[0]
      if (activeMgr) {
        if (!selectedManagerId) {
          setSelectedManagerId(activeMgr.id)
        }
        setEmailInput(activeMgr.email || "manager@gomaa.in")
        const gList =
          activeMgr.gosalas && activeMgr.gosalas.length > 0
            ? activeMgr.gosalas
            : activeMgr.gosala && activeMgr.gosala !== "Unassigned"
              ? [activeMgr.gosala]
              : []
        if (!selectedManagerGosala || !gList.includes(selectedManagerGosala)) {
          setSelectedManagerGosala(gList[0] || "")
        }
      }
    } else {
      setEmailInput(currentProfile?.email || role.demoEmail)
    }
  }, [selected, managers, currentProfile, role])

  const currentManagerObj = managers.find((m) => m.id === selectedManagerId)
  const managerGosalaList: string[] = currentManagerObj
    ? currentManagerObj.gosalas && currentManagerObj.gosalas.length > 0
      ? currentManagerObj.gosalas
      : currentManagerObj.gosala && currentManagerObj.gosala !== "Unassigned"
        ? [currentManagerObj.gosala]
        : []
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selected === "manager" && currentManagerObj) {
      const gList = managerGosalaList
      const targetGosala =
        selectedManagerGosala || gList[0] || currentManagerObj.gosala || ""
      const baseManagerData =
        profiles.manager?.managerData || initialProfiles.manager.managerData!
      await updateProfile("manager", {
        name: currentManagerObj.name,
        email: emailInput || currentManagerObj.email,
        phone: currentManagerObj.phone,
        managerData: {
          ...baseManagerData,
          managerId: currentManagerObj.id || baseManagerData.managerId,
          gosala: targetGosala,
          assignedGosalas: gList,
        },
      })
      if (targetGosala) {
        setActiveManagerGosala(targetGosala)
        setActiveGosalaFilter(targetGosala)
      }
    }
    onSignIn(selected)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden lg:block overflow-hidden bg-forest">
        <img
          src="https://images.unsplash.com/photo-1673229266917-89abfa3ebc58?w=1200&h=1600&fit=crop&auto=format"
          alt="A brown cow with large horns at a Gosala"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#201c16]/92 via-[#201c16]/45 to-[#201c16]/60" />
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-paper">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-sm bg-saffron grid place-items-center font-serif text-[20px] text-white">
              G
            </div>
            <div>
              <div className="font-serif text-[22px] leading-none">GOMAA</div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-paper/70 mt-1">
                Booking Operations
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="font-serif text-[34px] leading-[1.15] text-white">
              One platform, from the first slot hold to final settlement.
            </h2>
            <p className="text-[14px] text-paper/80 mt-4 leading-relaxed">
              Book individual animals from verified Gosalas, with real-time
              availability, distance-based transport pricing and a governed
              manager → admin approval chain.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-2 gap-y-2">
              {flow.map((f, i) => (
                <span key={f} className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-paper/85 bg-white/10 backdrop-blur rounded-full px-2.5 py-1">
                    {f}
                  </span>
                  {i < flow.length - 1 && (
                    <span className="text-saffron text-[11px]">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11.5px] text-paper/70">
            <ShieldCheck size={14} className="text-saffron" />
            Server-side payment verification · atomic slot confirmation ·
            audit-logged approvals
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-sm bg-saffron grid place-items-center font-serif text-[18px] text-white">
              G
            </div>
            <span className="font-serif text-[20px]">GOMAA</span>
          </div>

          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-faint">
            Sign in to your workspace
          </div>
          <h1 className="font-serif text-[28px] text-ink mt-2 leading-tight">
            Welcome back
          </h1>
          <p className="text-[13px] text-ink-faint mt-1.5">
            Select your role, then continue with your credentials.
          </p>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-2.5 mt-7">
            {roles.map((r, i) => (
              <RoleCard
                key={r.id}
                role={r}
                profileName={profiles[r.id]?.name}
                active={selected === r.id}
                onSelect={() => setSelected(r.id)}
                className={i === 4 ? "col-span-2" : ""}
              />
            ))}
          </div>

          {/* Dynamic Manager Account & Gaushala Target Picker */}
          {selected === "manager" && managers.length > 0 && (
            <div className="mt-5 p-3.5 bg-card border border-line rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                  <UserCheck size={14} className="text-saffron" />
                  Select Registered Manager Account
                </div>
                <span className="text-[10px] font-mono text-ink-faint">
                  {managers.length} in roster
                </span>
              </div>

              <select
                value={selectedManagerId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedManagerId(id)
                  const chosen = managers.find((m) => m.id === id)
                  if (chosen) {
                    setEmailInput(chosen.email || "manager@gomaa.in")
                    const gList =
                      chosen.gosalas && chosen.gosalas.length > 0
                        ? chosen.gosalas
                        : chosen.gosala && chosen.gosala !== "Unassigned"
                          ? [chosen.gosala]
                          : []
                    setSelectedManagerGosala(gList[0] || "")
                  }
                }}
                className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
              >
                {managers.map((m) => {
                  const gList =
                    m.gosalas && m.gosalas.length > 0
                      ? m.gosalas
                      : m.gosala && m.gosala !== "Unassigned"
                        ? [m.gosala]
                        : []
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({gList.length} Gaushala
                      {gList.length === 1 ? "" : "s"}
                      {gList.length > 0
                        ? `: ${gList.join(", ")}`
                        : " - Unassigned"}
                      )
                    </option>
                  )
                })}
              </select>

              {currentManagerObj && (
                <div className="pt-2 border-t border-line/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-ink-faint">
                    <span>Assigned Gaushalas under {currentManagerObj.name}:</span>
                    {managerGosalaList.length > 1 && (
                      <span className="text-[10px] text-saffron-deep font-medium">
                        Select initial shelter to open
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {managerGosalaList.length > 0 ? (
                      managerGosalaList.map((gName) => {
                        const isTarget = selectedManagerGosala === gName
                        return (
                          <button
                            type="button"
                            key={gName}
                            onClick={() => setSelectedManagerGosala(gName)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-medium border transition ${
                              isTarget
                                ? "bg-forest text-white border-forest shadow-xs"
                                : "bg-paper text-ink border-line hover:border-line-strong"
                            }`}
                          >
                            <Building2
                              size={12}
                              className={
                                isTarget ? "text-saffron-light" : "text-ink-faint"
                              }
                            />
                            {gName}
                            {isTarget && (
                              <Check size={11} className="text-white" />
                            )}
                          </button>
                        )
                      })
                    ) : (
                      <div className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-2.5 py-1">
                        ⚠️ No Gaushalas currently assigned to this manager. Operations
                        Admin can assign Gaushalas in Admin &gt; Gaushala Managers.
                      </div>
                    )}
                  </div>
                  {managerGosalaList.length > 1 && (
                    <div className="text-[10.5px] text-ink-faint italic">
                      * You can seamlessly switch between your assigned Gaushalas
                      anytime from the header switcher inside your workspace.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {selected === "manager" && managers.length === 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-sm text-[12px] text-amber-800">
              <div className="font-semibold flex items-center gap-1.5">
                <Info size={14} /> No managers registered yet
              </div>
              <p className="mt-1 text-[11px] text-amber-700">
                The Operations Admin has not registered any managers yet. Log in as{" "}
                <strong>Admin</strong> to create managers and assign Gaushalas.
              </p>
            </div>
          )}

          <form
            className="mt-6 space-y-4"
            onSubmit={handleSubmit}
          >
            <label className="block">
              <span className="text-[12.5px] text-ink-soft font-medium">
                Work email
              </span>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="mt-1.5 w-full bg-paper border border-line rounded-sm px-3 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
              />
            </label>
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-ink-soft font-medium">
                  Password
                </span>
                <button
                  type="button"
                  className="text-[11.5px] text-saffron-deep hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative mt-1.5">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type={showPw ? "text" : "password"}
                  defaultValue="gomaa-demo"
                  className="w-full bg-paper border border-line rounded-sm pl-9 pr-10 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <label className="flex items-center gap-2 text-[12.5px] text-ink-soft select-none">
              <input
                type="checkbox"
                defaultChecked
                className="accent-[var(--color-saffron)] h-3.5 w-3.5"
              />
              Keep me signed in on this device
            </label>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-saffron text-white rounded-sm py-3 text-[14px] font-medium hover:bg-saffron-deep transition-colors"
            >
              Continue as{" "}
              {selected === "manager" && currentManagerObj
                ? currentManagerObj.name
                : currentProfile?.name || role.name}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Role quick-range */}
          <div className="mt-10 pt-8 border-t border-line">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-[16px] text-ink">
                What each role does
              </h3>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">
                Quick range
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {roles.map((r) => {
                const Icon = r.icon
                const open = r.id === selected
                return (
                  <div
                    key={r.id}
                    className={`rounded-sm border p-4 transition-colors ${
                      open
                        ? "border-line-strong bg-card"
                        : "border-line bg-card/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="h-7 w-7 shrink-0 grid place-items-center rounded-sm bg-saffron-soft text-saffron-deep">
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-medium text-ink">
                            {r.name}
                          </span>
                          <span className="font-mono text-[10px] text-ink-faint">
                            {r.scope}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-ink-soft mt-1 leading-relaxed">
                          {r.summary}
                        </p>
                        {open && (
                          <ul className="mt-3 space-y-1.5">
                            {r.duties.map((d) => (
                              <li
                                key={d}
                                className="flex gap-2 text-[12.5px] text-ink-soft"
                              >
                                <span className="text-saffron mt-[1px]">›</span>
                                <span className="leading-snug">{d}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {open && r.workflow && (
                          <div className="mt-3">
                            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
                              {r.workflow.label}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {r.workflow.steps.map((s) => (
                                <span
                                  key={s}
                                  className="font-mono text-[10.5px] text-ink-soft bg-paper-deep rounded-full px-2 py-0.5"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
