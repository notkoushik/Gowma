import { useState } from "react"
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react"
import { roles, type Role, type RoleId } from "../data/roles"
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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-sm border p-3 sm:p-3.5 transition-all ${className} ${
        active
          ? "border-saffron bg-saffron-soft/50 ring-2 ring-saffron/20"
          : "border-line bg-card hover:border-line-strong"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`h-8 w-8 grid place-items-center rounded-sm shrink-0 ${
            active ? "bg-saffron text-white" : "bg-paper-deep text-ink-soft"
          }`}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-ink leading-tight truncate">
            {profileName || role.name}
          </div>
          <div className="text-[10.5px] text-ink-faint leading-tight truncate mt-0.5">
            {role.name} · {role.scope}
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
  const { profiles } = useStore()
  const [selected, setSelected] = useState<RoleId>("customer")
  const [showPw, setShowPw] = useState(false)
  const role = roles.find((r) => r.id === selected)!
  const currentProfile = profiles[selected]

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

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              onSignIn(selected)
            }}
          >
            <label className="block">
              <span className="text-[12.5px] text-ink-soft font-medium">
                Work email
              </span>
              <input
                type="email"
                defaultValue={currentProfile?.email || role.demoEmail}
                key={currentProfile?.email || role.demoEmail}
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
              Continue as {currentProfile?.name || role.name}
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
