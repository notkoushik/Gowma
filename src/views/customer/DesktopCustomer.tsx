import { useState, useMemo, useEffect } from "react"
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Flag,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Ruler,
  Scale,
  Search,
  ShieldCheck,
  Star,
  Truck,
  Crosshair,
  User,
  Fingerprint,
  Building2,
  PawPrint,
} from "lucide-react"
import { type Animal } from "../../data/animals"
import { pricing, type Gosala } from "../../data/customer"
import { inr } from "../../data/mock"
import { tripStages } from "../../data/driver"
import BookingFlow from "./BookingFlow"
import { DesktopGosalaProfile, EnRouteModal } from "./GosalaProfile"
import { statusTone, type BookingSummary, type MyBooking } from "../CustomerApp"
import LiveTripMap from "../../components/LiveTripMap"
import LocationPromptBanner from "../../components/LocationPromptBanner"
import CustomerTrackingDossier from "../../components/CustomerTrackingDossier"
import {
  useDeviceLocation,
  getIndianLocalityFromCoords,
} from "../../hooks/useDeviceLocation"
import { useStore } from "../../store/store"
import EditProfileModal from "../../components/EditProfileModal"
import CattleAndShelterGallery from "../../components/CattleAndShelterGallery"
import LocationPickerModal from "../../components/LocationPickerModal"
import {
  sortGaushalasByProximity,
  getGaushalaServiceability,
} from "../../utils/geoDistance"
import { fetchRoadRoute } from "../../services/routing"
import type { OperationalRegionHub } from "../../data/regions"

type Tab = "discover" | "bookings" | "track" | "profile"

export default function DesktopCustomer({
  onSignOut,
  myBookings,
  onCreate,
}: {
  onSignOut: () => void
  myBookings: MyBooking[]
  onCreate: (s: BookingSummary) => void
}) {
  const { profiles, gosalas: storeGosalas, animals: storeAnimals, refreshAnimals, authUser } = useStore()
  const customerProfile = profiles?.customer
  const devoteeName = authUser?.name || customerProfile?.name || "Devotee"

  useEffect(() => {
    refreshAnimals?.().catch(() => {})
  }, [refreshAnimals])

  const [tab, setTab] = useState<Tab>("discover")
  const [detail, setDetail] = useState<Animal | null>(null)
  const [gosalaProfileId, setGosalaProfileId] = useState<string | null>(null)
  const [routeModalGosala, setRouteModalGosala] = useState<Gosala | null>(null)
  const [routeModalMode, setRouteModalMode] = useState<"route" | "pinpoint">("route")
  const [flow, setFlow] = useState<{ animal: Animal; gosala: Gosala } | null>(
    null,
  )
  const [q, setQ] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState(
    customerProfile?.customerData?.defaultAddress || "Kothaguda, Hyderabad",
  )
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const deviceLocation = useDeviceLocation()

  const liveAnimals = storeAnimals || []

  const customerGosalas: Gosala[] = useMemo(() => {
    return storeGosalas.map((g, idx) => {
      const housedCows = liveAnimals.filter(
        (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
      )
      const dynamicRating = (g as any).rating || Number((4.7 + ((g.name.length * 3 + idx) % 4) * 0.1).toFixed(1))

      return {
        id: g.id,
        name: g.name,
        area: g.address || g.region || "Operational Vedic Sanctuary",
        distanceKm: (g as any).distanceKm ?? 6.5,
        rating: dynamicRating,
        animals: housedCows.length || g.capacity || 40,
        photo:
          g.photo ||
          "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
        lat:
          g.lat !== undefined && g.lat !== null
            ? Number(g.lat)
            : (g as any).latitude !== undefined && (g as any).latitude !== null
              ? Number((g as any).latitude)
              : undefined,
        lng:
          g.lng !== undefined && g.lng !== null
            ? Number(g.lng)
            : (g as any).longitude !== undefined && (g as any).longitude !== null
              ? Number((g as any).longitude)
              : undefined,
      }
    })
  }, [storeGosalas, liveAnimals])

  const sortedGaushalas = useMemo(() => {
    return sortGaushalasByProximity(
      customerGosalas,
      deviceLocation.lat,
      deviceLocation.lng,
    )
  }, [customerGosalas, deviceLocation.lat, deviceLocation.lng])

  // Prefetch and store real road driving distances for total accuracy across card and modal
  const [roadDistances, setRoadDistances] = useState<Record<string, number>>({})

  useEffect(() => {
    const lat = deviceLocation.lat || 17.4401
    const lng = deviceLocation.lng || 78.3489
    const userCoords: [number, number] = [lat, lng]

    customerGosalas.forEach((g) => {
      const gLat =
        g.lat !== undefined && g.lat !== null
          ? Number(g.lat)
          : (g as any).latitude !== undefined && (g as any).latitude !== null
            ? Number((g as any).latitude)
            : undefined
      const gLng =
        g.lng !== undefined && g.lng !== null
          ? Number(g.lng)
          : (g as any).longitude !== undefined && (g as any).longitude !== null
            ? Number((g as any).longitude)
            : undefined

      if (gLat && gLng) {
        fetchRoadRoute(userCoords, [gLat, gLng]).then((route) => {
          if (route?.distanceKm) {
            setRoadDistances((prev) => ({
              ...prev,
              [g.id]: route.distanceKm,
            }))
          }
        })
      }
    })
  }, [deviceLocation.lat, deviceLocation.lng, customerGosalas])

  const handleSelectHub = (hub: OperationalRegionHub) => {
    deviceLocation.setManualLocation(hub)
    setDeliveryAddress(`${hub.name}, ${hub.city}, ${hub.state}`)
    setLocationPickerOpen(false)
  }

  const handleDetectLocation = async () => {
    const res = await deviceLocation.requestLocation()
    if (res) {
      setDeliveryAddress(
        res.address || getIndianLocalityFromCoords(res.lat, res.lng),
      )
    }
  }

  const [selectedTrackBookingId, setSelectedTrackBookingId] = useState<string | null>(null)
  const activeTrip =
    (selectedTrackBookingId
      ? myBookings.find((b) => b.id === selectedTrackBookingId)
      : null) ||
    myBookings.find((b) => b.status === "In Service") ||
    myBookings.find((b) => b.status === "Confirmed" && b.driver) ||
    myBookings.find((b) => b.status === "Confirmed") ||
    myBookings.find((b) => b.status === "Under Review") ||
    myBookings[0]
  const list = liveAnimals.filter(
    (a) =>
      q === "" ||
      a.name.toLowerCase().includes(q.toLowerCase()) ||
      a.type.toLowerCase().includes(q.toLowerCase()),
  )

  const nav: { id: Tab; label: string }[] = [
    { id: "discover", label: "Discover" },
    { id: "bookings", label: "My bookings" },
    { id: "track", label: "Track" },
    { id: "profile", label: "Profile" },
  ]

  return (
    <div className="min-h-screen bg-paper">
      {/* Top nav */}
      <header className="sticky top-0 z-30 h-16 bg-paper/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center gap-6">
          <button
            onClick={() => {
              setTab("discover")
              setDetail(null)
              setGosalaProfileId(null)
            }}
            className="flex items-center gap-2.5"
          >
            <div className="h-9 w-9 rounded-sm bg-saffron grid place-items-center font-serif text-[18px] text-white">
              G
            </div>
            <div className="text-left leading-none">
              <div className="font-serif text-[18px]">GOMAA</div>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-faint mt-0.5">
                Book a Gau Seva
              </div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setTab(n.id)
                  setDetail(null)
                  setGosalaProfileId(null)
                }}
                className={`relative rounded-sm px-3 py-2 text-[13.5px] transition-colors ${
                  tab === n.id && !detail
                    ? "text-saffron-deep font-medium"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {n.label}
                {n.id === "track" && activeTrip && (
                  <span className="absolute top-1.5 right-1 h-1.5 w-1.5 rounded-full bg-saffron" />
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* Quick Location Switcher Button */}
            <button
              onClick={() => setLocationPickerOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-card border border-line hover:border-saffron/60 transition shadow-2xs cursor-pointer group text-left"
              title="Click to switch region or detect GPS"
            >
              <div className="h-6 w-6 rounded-full bg-saffron-soft text-saffron-deep grid place-items-center shrink-0">
                <MapPin size={13} />
              </div>
              <div className="leading-tight max-w-[170px]">
                <div className="text-[9.5px] uppercase font-mono tracking-wider text-ink-faint">
                  Region
                </div>
                <div className="text-[12.5px] text-ink font-semibold group-hover:text-saffron-deep flex items-center gap-1">
                  <span className="truncate">
                    {deviceLocation.city || (deviceLocation.isLoading ? "Locating..." : "Select Region")}
                  </span>
                  <ChevronDown size={12} className="text-ink-faint group-hover:text-saffron-deep shrink-0" />
                </div>
              </div>
            </button>

            {/* Editable Street / Venue Address */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-sm bg-card border border-line">
              {isEditingAddress ? (
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  onBlur={() => setIsEditingAddress(false)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && setIsEditingAddress(false)
                  }
                  autoFocus
                  className="text-[12.5px] text-ink font-medium bg-paper px-2 py-0.5 rounded outline-none border border-saffron max-w-[240px]"
                />
              ) : (
                <span
                  onClick={() => setIsEditingAddress(true)}
                  title="Click to edit delivery venue address"
                  className="text-[12.5px] text-ink font-medium hover:text-saffron-deep cursor-pointer max-w-[240px] truncate"
                >
                  {deliveryAddress}
                </span>
              )}
              <button
                onClick={handleDetectLocation}
                disabled={deviceLocation.isLoading}
                title="Detect live GPS location"
                className="text-[11px] text-saffron-deep font-medium hover:underline inline-flex items-center gap-1 cursor-pointer ml-1 shrink-0"
              >
                <Crosshair
                  size={12}
                  className={deviceLocation.isLoading ? "animate-spin" : ""}
                />
                {deviceLocation.isLoading ? "Locating..." : "Use GPS"}
              </button>
            </div>
            <button className="relative h-9 w-9 grid place-items-center rounded-sm border border-line bg-card text-ink-soft hover:text-ink transition-colors">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-saffron" />
            </button>
            <button
              onClick={() => setTab("profile")}
              className="h-9 w-9 rounded-full bg-forest text-white grid place-items-center text-[12px] font-medium hover:ring-2 hover:ring-forest/40 transition-all cursor-pointer"
              title="View Devotee Profile"
            >
              {devoteeName.slice(0, 1)}
            </button>
            <button
              onClick={onSignOut}
              className="text-ink-faint hover:text-ink p-1.5 rounded-sm hover:bg-paper-deep transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Proactive GPS Permission & Fallback Banner */}
        {!detail && !gosalaProfileId && tab === "discover" && !deviceLocation.hasPermission && (
          <div className="mb-6">
            <LocationPromptBanner
              role="CUSTOMER"
              hasPermission={deviceLocation.hasPermission}
              permissionStatus={deviceLocation.permissionStatus}
              isLoading={deviceLocation.isLoading}
              error={deviceLocation.error}
              accuracy={deviceLocation.accuracy}
              address={deviceLocation.address}
              onRequestLocation={handleDetectLocation}
              onOpenLocationPicker={() => setLocationPickerOpen(true)}
            />
          </div>
        )}

        {detail ? (
          <DetailView
            animal={detail}
            onBack={() => setDetail(null)}
            onBook={(g) => setFlow({ animal: detail, gosala: g })}
          />
        ) : gosalaProfileId ? (
          <DesktopGosalaProfile
            gosalaId={gosalaProfileId}
            distanceKm={roadDistances[gosalaProfileId]}
            onBack={() => setGosalaProfileId(null)}
            onSelectAnimal={(a) => {
              setGosalaProfileId(null)
              setDetail(a)
            }}
          />
        ) : tab === "discover" ? (
          <div className="space-y-10">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-sm bg-forest">
              <img
                src="https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=1400&h=500&fit=crop&auto=format"
                alt="Gau seva"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#201c16]/90 via-[#201c16]/55 to-transparent" />
              <div className="relative px-8 py-12 lg:py-16 max-w-xl text-paper">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-paper/70 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
                  Verified Gosalas · {deviceLocation.city || "Pan-India"}
                </div>
                <h1 className="font-serif text-[36px] leading-[1.1] text-white mt-3">
                  Book a sacred Gau Seva, at your doorstep.
                </h1>
                <p className="text-[14px] text-paper/85 mt-3 leading-relaxed">
                  Choose an individual animal, a time that suits you, and
                  transparent pricing — transport included within{" "}
                  {pricing.freeKm} km.
                </p>
                <div className="mt-6 relative max-w-md">
                  <Search
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search cow, calf, bull…"
                    className="w-full bg-paper border border-transparent rounded-sm pl-10 pr-4 py-3 text-[14px] text-ink outline-none focus:ring-2 focus:ring-saffron/40"
                  />
                </div>
              </div>
            </section>

            {/* Gosalas */}
            <section>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="font-serif text-[22px] text-ink">
                    Nearest Gosalas
                  </h2>
                  <p className="text-[12px] text-ink-faint mt-0.5">
                    {deviceLocation.city
                      ? `Sanctuaries sorted by proximity to ${deviceLocation.city}`
                      : "Sanctuaries sorted by closest geodesic distance"}
                  </p>
                </div>
                <button
                  onClick={() => setLocationPickerOpen(true)}
                  className="font-mono text-[11.5px] text-saffron-deep hover:underline cursor-pointer flex items-center gap-1.5 font-medium"
                >
                  <MapPin size={13} />
                  Change Location ({sortedGaushalas.length} Across India)
                </button>
              </div>
              {sortedGaushalas.length === 0 ? (
                <div className="p-8 text-center rounded-sm border border-dashed border-line bg-card/60">
                  <Building2 size={32} className="mx-auto text-saffron-deep/70 mb-2.5" />
                  <p className="font-serif text-[18px] text-ink font-semibold">
                    No Gaushalas registered yet
                  </p>
                  <p className="text-[12.5px] text-ink-soft max-w-md mx-auto mt-1 leading-relaxed">
                    As Gaushalas register their sanctuaries on GOMAA, they will appear here with verified Vedic standards, physical address, and doorstep service.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {sortedGaushalas.map(({ gosala: g, serviceability }) => {
                    const housedCount = liveAnimals.filter(
                      (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
                    ).length
                    const cattleLabel =
                      housedCount > 0
                        ? `${housedCount} cattle`
                        : g.animals && g.animals > 0
                          ? `Cap: ${g.animals} cattle`
                          : "Intake Open"

                    return (
                      <div
                        key={g.id}
                        className="rounded-lg border border-line bg-card overflow-hidden group hover:border-line-strong hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div
                          onClick={() => setGosalaProfileId(g.id)}
                          className="cursor-pointer"
                        >
                          <div className="h-44 bg-paper-deep overflow-hidden relative">
                            <img
                              src={g.photo}
                              alt={g.name}
                              className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                            />
                            <span
                              className={`absolute top-2.5 right-2.5 text-[10px] px-2 py-0.5 rounded-full font-medium shadow-2xs border ${serviceability.badgeClass}`}
                            >
                              {serviceability.badgeText}
                            </span>
                          </div>
                          <div className="p-4">
                            <div className="font-serif text-[17px] text-ink font-semibold group-hover:text-forest transition">
                              {g.name}
                            </div>
                            <div className="text-[12px] text-ink-faint mt-0.5 flex items-center gap-1">
                              <MapPin size={11} className="shrink-0 text-saffron" />
                              <span className="truncate">{g.area}</span>
                            </div>
                            <div className="flex items-center gap-3.5 mt-3 text-[12px]">
                              <span className="inline-flex items-center gap-1 text-ink-soft">
                                <Star
                                  size={12}
                                  className="text-saffron fill-saffron"
                                />{" "}
                                {g.rating}
                              </span>
                              <span className="inline-flex items-center gap-1 text-ink-soft font-mono tabular font-medium">
                                <Navigation size={12} className="text-forest" /> {roadDistances[g.id] ?? serviceability.distanceKm} km
                              </span>
                              <span className="text-ink-faint font-medium">
                                · {cattleLabel}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Navigation Action Bar */}
                        <div className="px-4 py-3 bg-paper/50 border-t border-line/60 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRouteModalGosala(g)
                                setRouteModalMode("route")
                              }}
                              className="px-2.5 py-1.5 rounded-md bg-forest/10 hover:bg-forest text-forest hover:text-white border border-forest/20 text-[11px] font-medium transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Check road navigation route and travel ETA"
                            >
                              <Navigation size={11} />
                              <span>En Route</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRouteModalGosala(g)
                                setRouteModalMode("pinpoint")
                              }}
                              className="px-2.5 py-1.5 rounded-md bg-card hover:bg-paper-deep text-ink-soft hover:text-ink border border-line text-[11px] font-medium transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Inspect exact sanctuary pinpoint on map"
                            >
                              <MapPin size={11} className="text-saffron" />
                              <span>Location</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setGosalaProfileId(g.id)}
                            className="text-[12px] text-saffron-deep hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span>Profile →</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Animals */}
            <section>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-serif text-[22px] text-ink">
                  Available animals
                </h2>
                <span className="font-mono text-[11px] text-ink-faint">
                  {list.length} available now
                </span>
              </div>
              {list.length === 0 ? (
                <div className="p-8 text-center rounded-sm border border-dashed border-line bg-card/60">
                  <PawPrint size={32} className="mx-auto text-saffron-deep/70 mb-2.5" />
                  <p className="font-serif text-[18px] text-ink font-semibold">
                    No sacred cattle onboarded yet
                  </p>
                  <p className="text-[12.5px] text-ink-soft max-w-md mx-auto mt-1 leading-relaxed">
                    Once sanctuaries onboard their sacred cows, calves, and bulls with veterinary health records, you can book doorstep Gau Seva here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                  {list.map((a) => (
                    <button
                      key={a.name}
                      onClick={() => setDetail(a)}
                      className="text-left rounded-sm border border-line bg-card overflow-hidden group hover:border-line-strong transition-colors"
                    >
                      <div className="h-40 bg-paper-deep overflow-hidden relative">
                        <img
                          src={a.photo}
                          alt={a.name}
                          className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        />
                        <span
                          className={`absolute top-2.5 left-2.5 text-[10.5px] rounded-full px-2 py-0.5 ${
                            a.status === "Available"
                              ? "bg-ok-soft text-ok"
                              : a.status === "Resting Buffer"
                                ? "bg-warn-soft text-warn"
                                : "bg-saffron-soft text-saffron-deep"
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-baseline justify-between">
                          <span className="font-serif text-[17px] text-ink">
                            {a.name}
                          </span>
                          <span className="font-mono text-[13px] text-ink tabular">
                            {inr(a.price)}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-ink-faint">
                          {a.type} · {a.category}
                        </div>
                        <div className="text-[11px] text-ink-faint mt-1.5 truncate">
                          {a.gosala}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : tab === "bookings" ? (
          <BookingsView
            list={myBookings}
            onTrack={(id) => {
              if (id) setSelectedTrackBookingId(id)
              setTab("track")
            }}
          />
        ) : tab === "track" ? (
          <TrackView
            booking={activeTrip}
            bookingsList={myBookings}
            onSelectBooking={setSelectedTrackBookingId}
          />
        ) : (
          <ProfileView onOpenEditProfile={() => setEditProfileOpen(true)} />
        )}
      </main>

      {flow && (
        <BookingFlow
          animal={flow.animal}
          gosala={flow.gosala}
          onClose={() => setFlow(null)}
          onComplete={(s) => {
            onCreate(s)
            setFlow(null)
            setDetail(null)
            setTab("bookings")
          }}
        />
      )}

      {editProfileOpen && (
        <EditProfileModal
          role="customer"
          onClose={() => setEditProfileOpen(false)}
        />
      )}

      <LocationPickerModal
        isOpen={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        currentCity={deviceLocation.city}
        currentAddress={deliveryAddress}
        onSelectHub={handleSelectHub}
        onDetectGPS={handleDetectLocation}
        isDetectingGPS={deviceLocation.isLoading}
      />

      {routeModalGosala && (
        <EnRouteModal
          isOpen={!!routeModalGosala}
          onClose={() => setRouteModalGosala(null)}
          gosalaName={routeModalGosala.name}
          gosalaAddress={routeModalGosala.area || routeModalGosala.name}
          gosalaLat={routeModalGosala.lat ?? (routeModalGosala as any).latitude}
          gosalaLng={routeModalGosala.lng ?? (routeModalGosala as any).longitude}
          customerLat={deviceLocation.lat || undefined}
          customerLng={deviceLocation.lng || undefined}
          customerAddress={deliveryAddress || deviceLocation.address || undefined}
          mode={routeModalMode}
        />
      )}
    </div>
  )
}

/* ---------------- Detail (two-column) ---------------- */
function DetailView({
  animal,
  onBack,
  onBook,
}: {
  animal: Animal
  onBack: () => void
  onBook: (g: Gosala) => void
}) {
  const { gosalas: storeGosalas } = useStore()
  const matchedStore = storeGosalas.find(
    (g) =>
      g.name.toLowerCase() === animal.gosala.toLowerCase() ||
      g.name.toLowerCase().includes(animal.gosala.toLowerCase()) ||
      animal.gosala.toLowerCase().includes(g.name.toLowerCase()),
  )

  const effectiveGosala: Gosala = {
    id: matchedStore?.id ?? "GOS-101",
    name: matchedStore?.name ?? animal.gosala,
    area: matchedStore?.address ?? matchedStore?.region ?? "Operational Vedic Sanctuary",
    distanceKm: (matchedStore as any)?.distanceKm ?? 6.2,
    rating: (matchedStore as any)?.rating ?? 4.8,
    animals: matchedStore?.capacity ?? 40,
    photo:
      matchedStore?.photo ??
      "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
    lat: matchedStore?.lat,
    lng: matchedStore?.lng,
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink mb-5 font-medium transition cursor-pointer"
      >
        <ChevronLeft size={16} /> Back to discover
      </button>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8">
        {/* Dynamic Sacred Cow & Shelter Multi-Photo Showcase */}
        <div>
          <CattleAndShelterGallery
            animal={animal}
            gosalaName={animal.gosala}
          />
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-serif text-[32px] text-ink leading-tight">
                {animal.name}
              </h1>
              <div className="text-[13px] text-ink-faint mt-1">
                {animal.breed || animal.type} · {animal.category}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[24px] text-ink tabular">
                {inr(animal.price)}
              </div>
              <div className="text-[11.5px] text-ink-faint">base · 60 min</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              [Clock, "Age", animal.age],
              [Scale, "Weight", animal.weight],
              [Ruler, "Height", animal.height],
            ].map(([Icon, l, v]: any) => (
              <div
                key={l}
                className="rounded-sm border border-line bg-card p-4 text-center"
              >
                <Icon size={16} className="text-saffron mx-auto" />
                <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint mt-2">
                  {l}
                </div>
                <div className="text-[14px] text-ink mt-0.5 tabular">{v}</div>
              </div>
            ))}
          </div>

          <div className="rounded-sm border border-line bg-card p-4 mt-5 flex items-center gap-3">
            <div className="h-12 w-12 rounded-sm bg-paper-deep overflow-hidden shrink-0 border border-line">
              <img
                src={effectiveGosala.photo}
                alt={effectiveGosala.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-ink truncate">{effectiveGosala.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-mono border border-emerald-200 shrink-0">AWBI Verified</span>
              </div>
              <div className="text-[12px] text-ink-faint">{effectiveGosala.area}</div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-[13px] text-ink-soft">
                <Star size={13} className="text-saffron fill-saffron" />{" "}
                {effectiveGosala.rating}
              </div>
              <div className="font-mono text-[12px] text-ink-faint tabular">
                {effectiveGosala.distanceKm} km
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-serif text-[16px] text-ink mb-2.5">
              Booking rules
            </h3>
            <ul className="space-y-2 text-[13px] text-ink-soft">
              <li className="flex gap-2">
                <span className="text-saffron">›</span> Standard 60-minute
                booking; extra time at {inr(pricing.extraUnitRate)}/
                {pricing.extraUnitMin} min
              </li>
              <li className="flex gap-2">
                <span className="text-saffron">›</span> Transport free within{" "}
                {pricing.freeKm} km, then {inr(pricing.perKm)}/km on chargeable
                distance
              </li>
              <li className="flex gap-2">
                <span className="text-saffron">›</span> Availability is reserved
                per individual animal & time range
              </li>
              <li className="flex gap-2">
                <span className="text-saffron">›</span> Slot held during
                checkout · payment verified server-side
              </li>
            </ul>
          </div>

          <button
            onClick={() => onBook(effectiveGosala)}
            disabled={animal.status !== "Available"}
            className="w-full mt-7 bg-saffron text-white rounded-sm py-3.5 text-[15px] font-medium hover:bg-saffron-deep disabled:opacity-40 transition-colors"
          >
            {animal.status !== "Available" ? "Currently unavailable" : "Book now"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Bookings ---------------- */
function BookingsView({
  list,
  onTrack,
}: {
  list: MyBooking[]
  onTrack: (bookingId?: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-[26px] text-ink">My bookings</h1>
        <span className="text-[13px] font-mono text-ink-faint">
          {list.length} {list.length === 1 ? "booking" : "bookings"}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-sm border border-dashed border-line bg-card p-12 text-center text-ink-faint text-[14px]">
          No bookings placed yet.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5 items-start">
          {list.map((b) => {
            const isExpanded = expandedId === b.id
            return (
              <div
                key={b.id}
                className={`rounded-sm border transition-all duration-200 bg-card overflow-hidden ${
                  isExpanded
                    ? "border-saffron/50 shadow-md ring-1 ring-saffron/20"
                    : "border-line hover:border-line-strong shadow-2xs"
                }`}
              >
                {/* Header / Clickable Minimized Summary */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                  className="p-5 cursor-pointer select-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-ink-faint">
                      {b.id}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] rounded-full px-2.5 py-0.5 ${statusTone(b.status)}`}
                      >
                        {b.status}
                      </span>
                      <div
                        className={`p-1 rounded-full text-ink-faint transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-saffron-deep" : ""
                        }`}
                      >
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mt-2">
                    <div className="font-serif text-[19px] text-ink">
                      {b.animal}
                    </div>
                    <div className="font-mono text-[16px] text-ink tabular font-medium">
                      {inr(b.total)}
                    </div>
                  </div>

                  <div className="text-[12.5px] text-ink-faint truncate">
                    {b.gosala}
                  </div>

                  <div className="flex items-center gap-3 text-[12.5px] text-ink-soft mt-2.5 font-mono tabular">
                    <span>{b.date}</span>
                    <span className="text-ink-faint">·</span>
                    <span>{b.time}</span>
                  </div>
                </div>

                {/* Expandable Details Drawer */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-line/60 bg-paper/40 space-y-3.5 text-[13px] animate-fade-in">
                    {b.address && (
                      <div className="flex items-start gap-2.5 text-ink-soft">
                        <MapPin
                          size={15}
                          className="text-saffron shrink-0 mt-0.5"
                        />
                        <div>
                          <div className="text-[11px] uppercase font-mono text-ink-faint">
                            Ceremony Venue
                          </div>
                          <div className="text-ink font-medium">{b.address}</div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-line/40">
                      <div>
                        <div className="text-[11px] uppercase font-mono text-ink-faint">
                          Route Distance
                        </div>
                        <div className="text-ink font-medium">
                          {b.distanceKm ? `${b.distanceKm} km transit` : "Safe Zone"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase font-mono text-ink-faint">
                          Assigned Transport
                        </div>
                        <div className="text-ink font-medium">
                          {b.driver || "Assigned by Gaushala"}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded bg-saffron-soft/30 border border-saffron/20 text-[12px] text-ink-soft">
                      <span className="font-medium text-saffron-deep">
                        Ritual Protocol:
                      </span>{" "}
                      Ground-floor portico ready, clean water bucket and sacred
                      green grass feeding protocol.
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-line/60">
                      <span className="text-[12px] text-forest font-medium inline-flex items-center gap-1.5">
                        <ShieldCheck size={14} /> Verified Devotee Booking
                      </span>
                      {b.status !== "Rejected" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onTrack(b.id)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-saffron text-white text-[12.5px] font-medium shadow-xs hover:bg-saffron-deep transition cursor-pointer"
                        >
                          <Truck size={14} /> Track live
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------------- Track (two-column) ---------------- */
function TrackView({
  booking,
  bookingsList = [],
  onSelectBooking,
}: {
  booking?: MyBooking
  bookingsList?: MyBooking[]
  onSelectBooking?: (id: string) => void
}) {
  const deviceLocation = useDeviceLocation()
  if (!booking)
    return (
      <div className="rounded-sm border border-line bg-card p-16 text-center">
        <Truck size={34} className="text-ink-faint mx-auto" />
        <p className="text-[14px] text-ink-faint mt-4">
          No active trip to track right now.
        </p>
      </div>
    )

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-[26px] text-ink">Live tracking</h1>
        {bookingsList.length > 1 && (
          <select
            value={booking.id}
            onChange={(e) => onSelectBooking?.(e.target.value)}
            className="text-[12px] font-mono bg-card border border-line rounded px-3 py-1.5 text-ink-soft cursor-pointer shadow-2xs"
          >
            {bookingsList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.animal} ({b.status})
              </option>
            ))}
          </select>
        )}
      </div>

      <LocationPromptBanner
        role="CUSTOMER"
        hasPermission={deviceLocation.hasPermission}
        permissionStatus={deviceLocation.permissionStatus}
        isLoading={deviceLocation.isLoading}
        error={deviceLocation.error}
        accuracy={deviceLocation.accuracy}
        address={deviceLocation.address}
        onRequestLocation={deviceLocation.requestLocation}
        className="mb-5"
      />

      <CustomerTrackingDossier
        booking={booking}
        customerCoords={
          deviceLocation.lat && deviceLocation.lng
            ? [deviceLocation.lat, deviceLocation.lng]
            : null
        }
        layoutMode="wide"
        heightClass="h-[380px]"
      />
    </div>
  )
}

/* ---------------- Profile ---------------- */
function ProfileView({ onOpenEditProfile }: { onOpenEditProfile: () => void }) {
  const { profiles } = useStore()
  const customerProfile = profiles?.customer
  const devoteeName = customerProfile?.name || "Devotee"
  const [openSection, setOpenSection] = useState<string | null>(null)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-forest text-white grid place-items-center font-serif text-[24px]">
            {devoteeName.slice(0, 1)}
          </div>
          <div>
            <div className="font-serif text-[24px] text-ink">{devoteeName}</div>
            <div className="text-[13px] text-ink-faint">
              {customerProfile?.phone || "+91 98204 11827"} ·{" "}
              {customerProfile?.email || "ananya@gomaa.in"}
            </div>
          </div>
        </div>
        <button
          onClick={onOpenEditProfile}
          className="px-4 py-2 text-[13px] font-medium text-forest bg-forest-soft border border-forest/30 rounded-sm hover:bg-forest hover:text-white transition-all shadow-2xs cursor-pointer"
        >
          Edit Devotee Profile
        </button>
      </div>

      {/* Devotee verification record - Collapsible Accordion */}
      <div className="rounded border border-line bg-card overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() =>
            setOpenSection(openSection === "verification" ? null : "verification")
          }
          className="w-full flex items-center justify-between p-5 text-left bg-card hover:bg-paper-deep/60 transition cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={16} className="text-forest" />
            <div>
              <div className="font-mono text-[11.5px] uppercase tracking-wider text-forest font-semibold">
                Devotee Verification & Altar Setup Dossier
              </div>
              <div className="text-[12px] text-ink-faint mt-0.5">
                Gotra: {customerProfile?.customerData?.gotra || "Kashyapa"} · Aadhaar: {customerProfile?.customerData?.aadhaarNumber || "•••• 4912"}
              </div>
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`text-ink-faint transition-transform duration-200 shrink-0 ${
              openSection === "verification" ? "rotate-180 text-forest" : ""
            }`}
          />
        </button>

        {openSection === "verification" && (
          <div className="p-5 border-t border-line/60 bg-paper/40 space-y-3 text-[13px] animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-ink-faint">Devotee Gotra</div>
                <div className="font-medium text-ink mt-0.5">
                  {customerProfile?.customerData?.gotra || "Kashyapa"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-ink-faint">
                  Aadhaar (Masked / Verified)
                </div>
                <div className="font-mono font-medium text-ink mt-0.5">
                  {customerProfile?.customerData?.aadhaarNumber || "•••• •••• 4912"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-ink-faint">
                  Family Members for Puja
                </div>
                <div className="text-ink mt-0.5">
                  {customerProfile?.customerData?.familyMembers ||
                    "Ananya (Self), Rajesh (Husband)"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-ink-faint">
                  Default Delivery Address
                </div>
                <div className="text-ink mt-0.5">
                  {customerProfile?.customerData?.defaultAddress ||
                    "Flat 402, Aditya Heights, Kondapur, Hyderabad"}
                </div>
              </div>
            </div>
            {customerProfile?.customerData?.specialNotes && (
              <div className="pt-2 border-t border-line text-[12px] text-ink-soft">
                <span className="font-medium text-ink">Venue Notes:</span>{" "}
                {customerProfile.customerData.specialNotes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Settings Drawers */}
      <div className="space-y-3">
        {[
          {
            id: "addresses",
            label: "Saved addresses",
            subtitle: "2 registered puja venues",
            content: (
              <div className="space-y-2 text-[13px]">
                <div className="p-3 rounded bg-card border border-line flex items-start justify-between">
                  <div>
                    <div className="font-medium text-ink flex items-center gap-1.5">
                      <MapPin size={13} className="text-saffron" /> Home (Default Altar)
                    </div>
                    <div className="text-ink-soft text-[12px] mt-0.5">
                      {customerProfile?.customerData?.defaultAddress || "Flat 402, Aditya Heights, Kondapur, Hyderabad"}
                    </div>
                  </div>
                  <span className="text-[10.5px] font-mono bg-forest/10 text-forest border border-forest/20 px-2 py-0.5 rounded">Active</span>
                </div>
              </div>
            ),
          },
          {
            id: "payments",
            label: "Payment methods",
            subtitle: "UPI Auto-Pay · Rupay Escrow",
            content: (
              <div className="space-y-2 text-[13px]">
                <div className="p-3 rounded bg-card border border-line">
                  <div className="font-medium text-ink">UPI ID (Google Pay / PhonePe)</div>
                  <div className="font-mono text-ink-soft text-[12px]">ananya.deshmukh@okhdfcbank</div>
                  <div className="text-[11px] text-forest mt-1">✓ Escrow Protection active for cow welfare assurance</div>
                </div>
              </div>
            ),
          },
          {
            id: "notifications",
            label: "Notifications",
            subtitle: "WhatsApp, email, and live SMS updates",
            content: (
              <div className="space-y-2 text-[13px] text-ink-soft">
                <div className="flex items-center justify-between py-1.5 border-b border-line/40">
                  <span>WhatsApp Trip Tracking</span>
                  <span className="text-forest font-semibold text-[11.5px]">Enabled</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-line/40">
                  <span>SMS Muhurat Updates</span>
                  <span className="text-forest font-semibold text-[11.5px]">Enabled</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>Gaushala Welfare News</span>
                  <span className="text-ink-faint text-[11.5px]">Monthly</span>
                </div>
              </div>
            ),
          },
          {
            id: "help",
            label: "Help & support",
            subtitle: "Chat with Gaushala Coordinator · 24/7",
            content: (
              <div className="space-y-2 text-[13px]">
                <div className="text-ink-soft">
                  Have questions regarding animal welfare, muhurat rescheduling, or cow transport?
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href="tel:+919820411827"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-forest text-white text-[12px] font-medium"
                  >
                    <Phone size={13} /> Call Care Desk
                  </a>
                </div>
              </div>
            ),
          },
        ].map((item) => {
          const isOpen = openSection === item.id
          return (
            <div
              key={item.id}
              className="rounded-sm border border-line bg-card overflow-hidden transition-all shadow-2xs"
            >
              <button
                type="button"
                onClick={() => setOpenSection(isOpen ? null : item.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-paper-deep/60 transition cursor-pointer select-none"
              >
                <div>
                  <div className="text-[14px] font-medium text-ink">{item.label}</div>
                  <div className="text-[12px] text-ink-faint mt-0.5">{item.subtitle}</div>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-ink-faint transition-transform duration-200 shrink-0 ${
                    isOpen ? "rotate-180 text-forest" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-line/60 bg-paper/40 animate-fade-in">
                  {item.content}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
