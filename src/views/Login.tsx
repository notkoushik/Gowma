import { useState, useRef, useEffect } from "react"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Building2,
  AlertCircle,
  KeyRound,
  Check,
  Phone,
  Smartphone,
  X,
  UserCheck,
  Sparkles,
} from "lucide-react"
import { type RoleId } from "../data/roles"
import { initialProfiles } from "../data/profiles"
import { useStore } from "../store/store"
import { api } from "../services/api"

const flow = [
  "Slot held",
  "Payment verified",
  "Manager review",
  "Admin confirmed",
  "Driver assigned",
  "Settled",
]

const POPULAR_REGIONS = [
  "Telangana - Cyberabad / Gachibowli (HITEC City)",
  "Hyderabad Central (Banjara Hills / Jubilee Hills)",
  "Andhra Pradesh - Vijayawada & Amaravati Hub",
  "Maharashtra - Pune & Pimpri-Chinchwad",
  "Karnataka - Bengaluru Urban & Whitefield",
  "Gujarat - Ahmedabad & Gandhinagar",
  "North India - Delhi NCR & Mathura-Vrindavan",
]

export default function Login({
  onSignIn,
}: {
  onSignIn: (role: RoleId) => void
}) {
  const {
    profiles,
    managers,
    gosalas,
    users,
    updateProfile,
    setActiveManagerGosala,
    setActiveGosalaFilter,
    setAuthSession,
    notify,
  } = useStore()

  // Primary Auth Mode: "signIn" vs "register"
  const [authMode, setAuthMode] = useState<"signIn" | "register">("signIn")

  // Sign In Form States
  const [emailInput, setEmailInput] = useState<string>("")
  const [passwordInput, setPasswordInput] = useState<string>("")
  const [showPw, setShowPw] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Devotee Registration Form States
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regRegion, setRegRegion] = useState(POPULAR_REGIONS[0])
  const [regPassword, setRegPassword] = useState("")
  const [regConfirmPassword, setRegConfirmPassword] = useState("")
  const [showRegPw, setShowRegPw] = useState(false)
  const [regTermsAccepted, setRegTermsAccepted] = useState(true)

  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotStep, setForgotStep] =
    useState<"request" | "verify" | "success">("request")
  const [forgotChannel, setForgotChannel] = useState<"EMAIL" | "PHONE">("EMAIL")
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotPhone, setForgotPhone] = useState("")
  const [forgotIdentifier, setForgotIdentifier] = useState("")
  const [forgotOtp, setForgotOtp] = useState("")
  const [forgotNewPassword, setForgotNewPassword] = useState("")
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("")
  const [showForgotPw, setShowForgotPw] = useState(false)
  const [forgotResetToken, setForgotResetToken] = useState("")
  const [forgotMaskedTarget, setForgotMaskedTarget] = useState("")
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState<number>(0)

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Helper to resolve all assigned Gaushalas for a manager strictly and accurately
  const resolveManagerGosalas = (m: any): string[] => {
    if (!m) return []

    const mId = (m.id || "").trim()
    const mCleanId = mId.startsWith("MGR-") ? mId.replace(/^MGR-/, "") : mId
    const mRawId = ((m as any).rawUserId || "").trim()
    const mName = (m.name || "").trim().toLowerCase()
    const mEmail = (m.email || "").trim().toLowerCase()

    const isManagerForGosala = (g: any): boolean => {
      if (!g) return false
      if (g.isActingManager || g.actAsManagerMyself) return false
      if (
        g.managerName &&
        (g.managerName.includes("None") ||
          g.managerName.includes("Acting Custodian") ||
          g.managerName.includes("Admin Custody") ||
          g.managerName.includes("Admin Acting"))
      ) {
        return false
      }

      const gMgrId = (g.managerId || "").trim()
      const gMgrCleanId = gMgrId.startsWith("MGR-")
        ? gMgrId.replace(/^MGR-/, "")
        : gMgrId
      const gMgrName = (g.managerName || "").trim().toLowerCase()

      if (gMgrId || (gMgrName && !gMgrName.includes("none"))) {
        const idMatch = Boolean(
          gMgrId &&
            (gMgrId === mId ||
              gMgrId === mCleanId ||
              (mRawId && gMgrId === mRawId) ||
              mId.includes(gMgrId) ||
              gMgrId.includes(mId)),
        )
        const nameMatch = Boolean(
          gMgrName &&
            mName &&
            (gMgrName === mName ||
              gMgrName.includes(mName) ||
              mName.includes(gMgrName)),
        )

        if (idMatch || nameMatch) {
          return true
        }
        // Strict exclusion: this Gaushala is staffed by someone else!
        return false
      }

      if (Array.isArray(g.assignedManagers) && g.assignedManagers.length > 0) {
        return g.assignedManagers.some((am: any) => {
          const amId = (am.id || "").trim()
          const amCleanId = amId.startsWith("MGR-")
            ? amId.replace(/^MGR-/, "")
            : amId
          const amName = (am.name || "").trim().toLowerCase()
          const amEmail = (am.email || "").trim().toLowerCase()
          return (
            (amId &&
              (amId === mId ||
                amId === mCleanId ||
                (mRawId && amId === mRawId))) ||
            (amName && mName && amName === mName) ||
            (amEmail && mEmail && amEmail === mEmail)
          )
        })
      }

      return false
    }

    const mappedFromGosalas = gosalas
      .filter((g) => isManagerForGosala(g))
      .map((g) => g.name)

    const directList =
      m.gosalas && m.gosalas.length > 0
        ? m.gosalas
        : m.gosala && m.gosala !== "Unassigned"
          ? [m.gosala]
          : []

    const verifiedDirect = directList.filter((gName: string) => {
      const match = gosalas.find(
        (g) => g.name.toLowerCase() === gName.toLowerCase(),
      )
      if (!match) return false
      return isManagerForGosala(match)
    })

    return Array.from(
      new Set([...mappedFromGosalas, ...verifiedDirect]),
    ).filter(Boolean)
  }

  // --------------------------------------------------------------------------
  // Sign In Submission
  // --------------------------------------------------------------------------
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setAuthError(null)

    const cleanEmailOrPhone = emailInput.trim()
    if (!cleanEmailOrPhone) {
      setAuthError(
        "Please enter your registered email, phone number, or Unique ID.",
      )
      setIsSubmitting(false)
      return
    }

    try {
      const authRes = await api.login(
        cleanEmailOrPhone,
        undefined,
        passwordInput,
      )

      if (authRes.ok && authRes.token && authRes.user) {
        setAuthSession(authRes.token, authRes.user)
        const targetRole = authRes.user.role as RoleId || "customer"

        if (targetRole === "manager") {
          const directManager = managers.find(
            (m) =>
              m.id === authRes.user.id ||
              m.id === authRes.user.uniqueId ||
              (m.email &&
                m.email.toLowerCase() === authRes.user.email?.toLowerCase()) ||
              (m.name &&
                m.name.toLowerCase() === authRes.user.name?.toLowerCase()),
          ) || {
            id: authRes.user.id,
            name: authRes.user.name,
            email: authRes.user.email,
            phone: authRes.user.phone,
            gosala:
              authRes.user.assignedGosalaNames?.[0] ||
              gosalas[0]?.name ||
              "Surya",
            gosalas: authRes.user.assignedGosalaNames || [
              gosalas[0]?.name || "Surya",
            ],
            status: "Active",
          }

          const serverGosalaNames: string[] =
            authRes.user.assignedGosalaNames ||
            authRes.user.gosalaNames ||
            (Array.isArray(authRes.user.gosalas)
              ? authRes.user.gosalas.map((g: any) =>
                  typeof g === "string" ? g : g.name,
                )
              : []) ||
            []

          const gList = resolveManagerGosalas(directManager)
          const combinedList = Array.from(
            new Set([...serverGosalaNames, ...gList]),
          ).filter(Boolean)
          const targetGosala =
            combinedList[0] ||
            directManager.gosala ||
            gosalas[0]?.name ||
            "Gaushala_01"

          const baseManagerData =
            profiles.manager?.managerData ||
            initialProfiles.manager.managerData!

          await updateProfile("manager", {
            name: authRes.user.name || directManager.name,
            email:
              authRes.user.email || directManager.email || cleanEmailOrPhone,
            phone: authRes.user.phone || directManager.phone,
            managerData: {
              ...baseManagerData,
              managerId: directManager.id || authRes.user.id,
              gosala: targetGosala,
              assignedGosalas:
                combinedList.length > 0 ? combinedList : [targetGosala],
            },
          })

          if (targetGosala) {
            setActiveManagerGosala(targetGosala)
            setActiveGosalaFilter(targetGosala)
          }
        }

        if (targetRole === "customer" && authRes.user.customerData) {
          await updateProfile("customer", {
            name: authRes.user.name,
            email: authRes.user.email,
            phone: authRes.user.phone,
            customerData: authRes.user.customerData,
          })
        }

        if (targetRole === "admin") {
          await updateProfile("admin", {
            name: authRes.user.name,
            email: authRes.user.email,
            phone: authRes.user.phone,
          })
        }

        const roleDisplay =
          targetRole === "super_admin"
            ? "SUPER ADMIN (CAPTAIN)"
            : targetRole.toUpperCase()

        notify(
          `Signed in as ${authRes.user.name || cleanEmailOrPhone} [${roleDisplay}]`,
          "ok",
        )
        onSignIn(targetRole)
      } else {
        setAuthError(
          "Failed to authenticate session. Please check your credentials.",
        )
      }
    } catch (err: any) {
      setAuthError(
        err.message ||
          "Invalid email or password. Please verify your credentials.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // --------------------------------------------------------------------------
  // Devotee Registration Submission
  // --------------------------------------------------------------------------
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setAuthError(null)

    if (!regName.trim() || !regEmail.trim() || !regPhone.trim()) {
      setAuthError("Please fill out your full name, email, and phone number.")
      setIsSubmitting(false)
      return
    }

    if (regPassword.length < 8) {
      setAuthError("Password must be at least 8 characters long.")
      setIsSubmitting(false)
      return
    }

    if (regPassword !== regConfirmPassword) {
      setAuthError("Passwords do not match. Please verify both fields.")
      setIsSubmitting(false)
      return
    }

    try {
      const regRes = await api.register({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        role: "customer",
        password: regPassword,
        customerData: {
          city: regRegion,
          preferredLanguage: "English / Telugu",
        },
      })

      if (regRes.ok && regRes.token && regRes.user) {
        setAuthSession(regRes.token, regRes.user)

        await updateProfile("customer", {
          name: regRes.user.name,
          email: regRes.user.email,
          phone: regRes.user.phone,
          customerData: regRes.user.customerData,
        })

        notify(
          `Devotee registration complete! Welcome to GOMAA, ${regRes.user.name}.`,
          "ok",
        )
        onSignIn("customer")
      } else {
        setAuthError("Registration failed. Please try again.")
      }
    } catch (err: any) {
      setAuthError(err.message || "Could not complete registration.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // --------------------------------------------------------------------------
  // Forgot Password: Step 1 (Request OTP)
  // --------------------------------------------------------------------------
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsForgotSubmitting(true)
    setForgotError(null)

    let cleanId = ""
    if (forgotChannel === "EMAIL") {
      const email = forgotEmail.trim().toLowerCase()
      if (!email) {
        setForgotError("Please enter your registered email address.")
        setIsForgotSubmitting(false)
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setForgotError(
          "Please enter a valid email address (e.g. name@domain.com).",
        )
        setIsForgotSubmitting(false)
        return
      }
      cleanId = email
    } else {
      const digits = forgotPhone.replace(/\D/g, "")
      if (!digits) {
        setForgotError("Please enter your registered 10-digit mobile number.")
        setIsForgotSubmitting(false)
        return
      }
      if (digits.length !== 10) {
        setForgotError(
          "Mobile number must be exactly 10 digits (e.g. 98490 12345).",
        )
        setIsForgotSubmitting(false)
        return
      }
      cleanId = `+91 ${digits}`
    }

    setForgotIdentifier(cleanId)

    try {
      const res = await api.forgotPassword({
        emailOrPhone: cleanId,
        channel: forgotChannel,
      })

      if (res?.ok) {
        setForgotMaskedTarget(res.maskedTarget || cleanId)
        setForgotStep("verify")
        setResendCooldown(45)
        notify(res.message || "Verification code dispatched.", "ok")
      } else {
        setForgotError(
          "Could not dispatch verification code. Please try again.",
        )
      }
    } catch (err: any) {
      setForgotError(err.message || "Failed to send verification code.")
    } finally {
      setIsForgotSubmitting(false)
    }
  }

  // --------------------------------------------------------------------------
  // Forgot Password: Resend Code
  // --------------------------------------------------------------------------
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isForgotSubmitting) return
    setIsForgotSubmitting(true)
    setForgotError(null)

    const cleanId =
      forgotIdentifier.trim() ||
      (forgotChannel === "EMAIL"
        ? forgotEmail.trim().toLowerCase()
        : `+91 ${forgotPhone.replace(/\D/g, "")}`)

    try {
      const res = await api.forgotPassword({
        emailOrPhone: cleanId,
        channel: forgotChannel,
      })

      if (res?.ok) {
        setResendCooldown(45)
        notify("A fresh 6-digit verification code has been dispatched.", "ok")
      } else {
        setForgotError(
          "Could not resend code. Please wait a moment and try again.",
        )
      }
    } catch (err: any) {
      setForgotError(err.message || "Failed to resend verification code.")
    } finally {
      setIsForgotSubmitting(false)
    }
  }

  // --------------------------------------------------------------------------
  // Forgot Password: Step 2 (Verify OTP & Reset Password)
  // --------------------------------------------------------------------------
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsForgotSubmitting(true)
    setForgotError(null)

    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotError("Please enter the 6-digit verification code.")
      setIsForgotSubmitting(false)
      return
    }

    if (forgotNewPassword.length < 8) {
      setForgotError("New password must be at least 8 characters long.")
      setIsForgotSubmitting(false)
      return
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.")
      setIsForgotSubmitting(false)
      return
    }

    const targetId =
      forgotIdentifier.trim() ||
      (forgotChannel === "EMAIL"
        ? forgotEmail.trim().toLowerCase()
        : `+91 ${forgotPhone.replace(/\D/g, "")}`)

    try {
      // 1. Verify OTP and get scoped reset token
      const verifyRes = await api.verifyOtp({
        emailOrPhone: targetId,
        otp: forgotOtp.trim(),
      })

      if (!verifyRes?.ok || !verifyRes?.resetToken) {
        throw new Error(verifyRes?.message || "Invalid verification code.")
      }

      // 2. Reset password using cryptographic token
      const resetRes = await api.resetPassword({
        emailOrPhone: targetId,
        resetToken: verifyRes.resetToken,
        newPassword: forgotNewPassword,
      })

      if (resetRes?.ok) {
        setForgotStep("success")
        notify(
          "Password updated successfully! Please sign in with your new password.",
          "ok",
        )
      } else {
        setForgotError(resetRes?.message || "Failed to update password.")
      }
    } catch (err: any) {
      setForgotError(
        err.message || "Verification failed. Please check the code.",
      )
    } finally {
      setIsForgotSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden lg:block overflow-hidden bg-forest">
        <img
          src="https://images.unsplash.com/photo-1673229266917-89abfa3ebc58?w=1200&h=1600&fit=crop&auto=format"
          alt="A sacred cow with flowers at a Gosala"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#201c16]/95 via-[#201c16]/50 to-[#201c16]/65" />
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-paper">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-sm bg-saffron grid place-items-center font-serif text-[20px] text-white shadow-xs">
              G
            </div>
            <div>
              <div className="font-serif text-[22px] leading-none">GOMAA</div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-paper/70 mt-1">
                Sacred Operations &amp; Welfare Platform
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur text-[11.5px] font-mono text-saffron mb-4 border border-white/15">
              <ShieldCheck size={13} />
              <span>Multi-Tenant Role-Governed Access</span>
            </div>
            <h2 className="font-serif text-[34px] leading-[1.15] text-white">
              Sacred cattle welfare, altar seva, and trust logistics.
            </h2>
            <p className="text-[14px] text-paper/80 mt-4 leading-relaxed">
              Every devotee, transit pilot, gaushala custodian, and operations
              officer accesses their dedicated workspace authenticated by secure
              credentials.
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

          <div className="font-mono text-[11px] text-paper/60">
            Protected with RFC 7519 JWT Cryptographic Tokens · Vercel +
            PostgreSQL Backend
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-10 overflow-y-auto bg-paper">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-sm bg-saffron grid place-items-center font-serif text-[18px] text-white">
              G
            </div>
            <span className="font-serif text-[20px] text-ink font-semibold">
              GOMAA
            </span>
          </div>

          {/* Form Header */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-forest-soft text-forest text-[11px] font-mono font-medium border border-forest/20">
              <KeyRound size={12} />
              <span>Secure Authentication Portal</span>
            </div>
            <h1 className="font-serif text-[28px] text-ink mt-2.5 leading-tight font-semibold">
              {authMode === "signIn" ? "Sign In to GOMAA" : "Join as a Devotee"}
            </h1>
            <p className="text-[13px] text-ink-faint mt-1.5 leading-relaxed">
              {authMode === "signIn"
                ? "Enter your registered email or phone and password to enter your verified workspace."
                : "Create your personal devotee account to book sacred seva, track cattle welfare, and receive altar darshan."}
            </p>
          </div>

          {/* Segmented Auth Navigation: Sign In vs Register as Devotee */}
          <div className="mt-5 p-1 bg-stone-100 dark:bg-stone-800 rounded-sm grid grid-cols-2 gap-1 text-[12.5px] font-medium border border-stone-200">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signIn")
                setAuthError(null)
              }}
              className={`py-2 rounded-xs text-center transition cursor-pointer ${
                authMode === "signIn"
                  ? "bg-white text-ink shadow-xs font-semibold"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register")
                setAuthError(null)
              }}
              className={`py-2 rounded-xs text-center transition cursor-pointer ${
                authMode === "register"
                  ? "bg-white text-ink shadow-xs font-semibold"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Register as Devotee
            </button>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mt-5 p-3.5 bg-red-50 border border-red-200 rounded-sm text-[12.5px] text-red-800 flex items-start gap-2.5 animate-[fadein_.2s_ease]">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="leading-snug flex-1">
                <div>{authError}</div>
                {authError.includes("/admin") && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/admin"
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-amber-400 font-semibold text-xs rounded hover:bg-slate-800 transition cursor-pointer shadow-xs"
                  >
                    Go to Secure /admin Portal →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 1: SIGN IN FORM */}
          {/* ---------------------------------------------------------------- */}
          {authMode === "signIn" && (
            <form className="mt-6 space-y-4" onSubmit={handleSignInSubmit}>
              <div>
                <label className="block text-[12.5px] text-ink-soft font-medium mb-1">
                  Email, Phone Number, or Unique ID
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. devotee@gmail.com, +91..., or GMA-DEV-0223"
                    className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12.5px] text-ink-soft font-medium">
                    Account Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = emailInput.trim()
                      if (trimmed.includes("@")) {
                        setForgotEmail(trimmed)
                        setForgotChannel("EMAIL")
                        setForgotIdentifier(trimmed)
                      } else if (trimmed) {
                        const digits = trimmed.replace(/\D/g, "").slice(0, 10)
                        setForgotPhone(digits)
                        setForgotChannel("PHONE")
                        setForgotIdentifier(`+91 ${digits}`)
                      } else {
                        setForgotEmail("")
                        setForgotPhone("")
                        setForgotIdentifier("")
                      }
                      setForgotError(null)
                      setForgotStep("request")
                      setShowForgotModal(true)
                    }}
                    className="text-[11.5px] text-saffron hover:text-saffron-deep font-semibold cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    ref={passwordInputRef}
                    type={showPw ? "text" : "password"}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your account password"
                    className="w-full bg-paper border border-line rounded-sm pl-9 pr-10 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer p-1"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-saffron text-white rounded-sm py-2.5 text-[13.5px] font-semibold hover:bg-saffron-deep transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Authenticating Session...</span>
                  </div>
                ) : (
                  <>
                    <span>Sign In to GOMAA Portal</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 2: DEVOTEE REGISTRATION FORM */}
          {/* ---------------------------------------------------------------- */}
          {authMode === "register" && (
            <form className="mt-6 space-y-3.5" onSubmit={handleRegisterSubmit}>
              <div>
                <label className="block text-[12px] text-ink-soft font-medium mb-1">
                  Full Legal / Devotee Name
                </label>
                <div className="relative">
                  <UserCheck
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Radhakrishna Murthy"
                    className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-ink-soft font-medium mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="devotee@gmail.com"
                      className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] text-ink-soft font-medium mb-1">
                    Mobile Phone (+91)
                  </label>
                  <div className="relative">
                    <Phone
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-ink-soft font-medium mb-1">
                  Primary Region / Gaushala Hub
                </label>
                <select
                  value={regRegion}
                  onChange={(e) => setRegRegion(e.target.value)}
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition cursor-pointer"
                >
                  {POPULAR_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-ink-soft font-medium mb-1">
                    Create Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                      type={showRegPw ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full bg-paper border border-line rounded-sm pl-9 pr-8 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPw((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer p-1"
                    >
                      {showRegPw ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] text-ink-soft font-medium mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                      type={showRegPw ? "text" : "password"}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={regTermsAccepted}
                  onChange={(e) => setRegTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-line text-saffron focus:ring-saffron"
                />
                <span className="text-[11.5px] text-ink-faint leading-snug">
                  I agree to the sacred cow welfare guidelines, ethical altar
                  seva principles, and privacy policy.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-saffron text-white rounded-sm py-2.5 text-[13.5px] font-semibold hover:bg-saffron-deep transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Creating Devotee Account...</span>
                  </div>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Create Devotee Account</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-[11.5px] text-ink-soft leading-relaxed flex items-start gap-2">
                <Building2
                  size={14}
                  className="text-amber-700 shrink-0 mt-0.5"
                />
                <div>
                  <strong>Are you a Gaushala Trust or Caretaker?</strong>{" "}
                  Gaushala Managers and Transit Pilots are verified and
                  onboarded by platform operations officers. Contact{" "}
                  <span className="font-semibold text-ink">trust@gomaa.in</span>{" "}
                  to register a sanctuary.
                </div>
              </div>
            </form>
          )}
          {/* Governance & Administrative Portal Link */}
          <div className="mt-6 pt-4 border-t border-line/60 text-center text-[12px] text-ink-faint">
            Platform governance or operations officer?{" "}
            <a
              href="/admin"
              className="font-semibold text-slate-800 hover:text-amber-700 transition inline-flex items-center gap-1"
            >
              Access Secure /admin Portal →
            </a>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* FORGOT PASSWORD & DUAL-CHANNEL OTP RECOVERY MODAL                     */}
      {/* -------------------------------------------------------------------- */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-[fadein_.15s_ease]">
          <div className="relative w-full max-w-md bg-paper border border-line rounded-lg shadow-xl overflow-hidden p-6 sm:p-7">
            {/* Modal Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false)
                setForgotError(null)
              }}
              className="absolute right-4 top-4 text-ink-faint hover:text-ink p-1 rounded-sm cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-sm bg-saffron/15 text-saffron grid place-items-center">
                <KeyRound size={16} />
              </div>
              <h2 className="font-serif text-[20px] font-semibold text-ink">
                Account Recovery &amp; Reset
              </h2>
            </div>
            <p className="text-[12.5px] text-ink-faint leading-relaxed mb-4">
              Recover access using out-of-band verification delivered to your
              registered contact.
            </p>

            {/* Error Banner in Modal */}
            {forgotError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm text-[12px] text-red-800 flex items-start gap-2">
                <AlertCircle
                  size={15}
                  className="text-red-600 shrink-0 mt-0.5"
                />
                <span className="flex-1">{forgotError}</span>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* STEP 1: REQUEST VERIFICATION CODE                              */}
            {/* -------------------------------------------------------------- */}
            {forgotStep === "request" && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                {/* Channel Selector: Email vs Phone */}
                <div>
                  <label className="block text-[11.5px] text-ink-faint font-semibold uppercase tracking-wider mb-1.5">
                    Select Verification Channel
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                    <button
                      type="button"
                      onClick={() => setForgotChannel("EMAIL")}
                      className={`p-2.5 rounded-sm border flex items-center justify-center gap-2 transition cursor-pointer font-medium ${
                        forgotChannel === "EMAIL"
                          ? "border-saffron bg-saffron/10 text-saffron-deep font-semibold"
                          : "border-line bg-paper-soft text-ink-soft hover:bg-white"
                      }`}
                    >
                      <Mail size={14} />
                      <span>Email Verification</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForgotChannel("PHONE")}
                      className={`p-2.5 rounded-sm border flex items-center justify-center gap-2 transition cursor-pointer font-medium ${
                        forgotChannel === "PHONE"
                          ? "border-saffron bg-saffron/10 text-saffron-deep font-semibold"
                          : "border-line bg-paper-soft text-ink-soft hover:bg-white"
                      }`}
                    >
                      <Smartphone size={14} />
                      <span>Mobile SMS OTP</span>
                    </button>
                  </div>
                </div>

                {forgotChannel === "EMAIL" ? (
                  <div>
                    <label className="block text-[12px] text-ink-soft font-medium mb-1">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                      />
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        autoFocus
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value.trim())
                          setForgotError(null)
                        }}
                        placeholder="e.g. admin@gomaa.in"
                        className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                      />
                    </div>
                    <p className="text-[11px] text-ink-faint mt-1">
                      We will deliver a 6-digit verification code to this inbox.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[12px] text-ink-soft font-medium mb-1">
                      Registered Mobile Phone Number
                    </label>
                    <div className="flex rounded-sm border border-line focus-within:border-saffron focus-within:ring-2 focus-within:ring-saffron/20 transition overflow-hidden bg-paper">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 border-r border-line text-[12.5px] font-semibold text-ink-soft select-none shrink-0">
                        <span>🇮🇳 +91</span>
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={10}
                        required
                        autoFocus
                        value={forgotPhone}
                        onChange={(e) => {
                          const digits = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10)
                          setForgotPhone(digits)
                          setForgotError(null)
                        }}
                        placeholder="98765 43210"
                        className="w-full bg-transparent px-3 py-2 text-[13px] text-ink outline-none tracking-wider font-medium"
                      />
                    </div>
                    <p className="text-[11px] text-ink-faint mt-1">
                      Enter your 10-digit Indian mobile number without +91 or
                      leading 0.
                    </p>
                  </div>
                )}

                <div className="p-3 bg-stone-100 rounded text-[11.5px] text-ink-faint leading-relaxed">
                  <strong>Zero-Leakage Security:</strong> The single-use
                  verification code is delivered out-of-band to your private
                  inbox or phone SMS. It is never exposed in browser logs.
                </div>

                <button
                  type="submit"
                  disabled={isForgotSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-saffron text-white rounded-sm py-2.5 text-[13px] font-semibold hover:bg-saffron-deep transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isForgotSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Dispatching Code...</span>
                    </div>
                  ) : (
                    <>
                      <span>Send 6-Digit Verification Code</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* -------------------------------------------------------------- */}
            {/* STEP 2: VERIFY OTP & ENTER NEW PASSWORD                        */}
            {/* -------------------------------------------------------------- */}
            {forgotStep === "verify" && (
              <form onSubmit={handleVerifyAndReset} className="space-y-3.5">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-[12px] text-ink-soft">
                  Verification code dispatched to:{" "}
                  <strong className="text-ink font-semibold">
                    {forgotMaskedTarget}
                  </strong>
                  . Code expires in 10 minutes.
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] text-ink-soft font-medium">
                      Enter 6-Digit Verification Code (OTP)
                    </label>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isForgotSubmitting}
                      onClick={handleResendOtp}
                      className="text-[11.5px] text-saffron hover:text-saffron-deep font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : "Resend Code"}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    required
                    autoFocus
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) =>
                      setForgotOtp(
                        e.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    placeholder="123456"
                    className="w-full text-center font-mono text-[22px] tracking-[0.3em] font-bold bg-paper border border-line rounded-sm py-2 text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                  <div className="flex items-center justify-between text-[11px] text-ink-faint mt-1 px-0.5">
                    <span>Didn't receive the verification code?</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isForgotSubmitting}
                      onClick={handleResendOtp}
                      className="text-saffron hover:text-saffron-deep font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendCooldown > 0
                        ? `Wait ${resendCooldown}s`
                        : "Resend OTP"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] text-ink-soft font-medium mb-1">
                    New Account Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                      type={showForgotPw ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 8 characters)"
                      className="w-full bg-paper border border-line rounded-sm pl-9 pr-8 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotPw((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer p-1"
                    >
                      {showForgotPw ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] text-ink-soft font-medium mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                      type={showForgotPw ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("request")
                      setForgotOtp("")
                      setForgotError(null)
                    }}
                    className="flex-1 py-2 text-[12px] border border-line rounded-sm text-ink-soft hover:bg-stone-50 cursor-pointer font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotSubmitting}
                    className="flex-[2] inline-flex items-center justify-center gap-2 bg-saffron text-white rounded-sm py-2 text-[13px] font-semibold hover:bg-saffron-deep transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isForgotSubmitting ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Verifying &amp; Updating...</span>
                      </div>
                    ) : (
                      <>
                        <ShieldCheck size={14} />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* -------------------------------------------------------------- */}
            {/* STEP 3: SUCCESS CONFIRMATION                                   */}
            {/* -------------------------------------------------------------- */}
            {forgotStep === "success" && (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full grid place-items-center mx-auto">
                  <Check size={24} />
                </div>
                <h3 className="font-serif text-[18px] font-semibold text-ink">
                  Password Reset Successful
                </h3>
                <p className="text-[12.5px] text-ink-faint leading-relaxed max-w-xs mx-auto">
                  Your credentials have been securely updated in the PostgreSQL
                  database. You can now sign in to your workspace.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false)
                    setEmailInput(forgotIdentifier.trim())
                    setAuthMode("signIn")
                    setTimeout(() => passwordInputRef.current?.focus(), 50)
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-saffron text-white rounded-sm py-2.5 text-[13px] font-semibold hover:bg-saffron-deep transition cursor-pointer shadow-xs"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
