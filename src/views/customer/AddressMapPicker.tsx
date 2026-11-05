import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Loader2, MapPin, Search, X } from "lucide-react"

// Free services only: Photon (OpenStreetMap data) for search, OpenStreetMap tiles for the map.
const PHOTON = "https://photon.komoot.io"
const INDIA_BBOX = "68,6,98,36" // minLon,minLat,maxLon,maxLat
const DEFAULT_CENTER: [number, number] = [17.385, 78.4867]

export type PickedPlace = {
  lat: number
  lng: number
  /** Building / society / place name, when the result has one */
  building: string
  street: string
  /** "City, State - 500084" */
  cityPincode: string
}

type Suggestion = PickedPlace & { id: string; title: string; subtitle: string }

function toPlace(f: any): Suggestion | null {
  const [lng, lat] = f?.geometry?.coordinates || []
  if (typeof lat !== "number" || typeof lng !== "number") return null
  const p = f.properties || {}
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ")
  const area = p.locality || p.district || ""
  const city = p.city || p.county || p.district || ""
  const isStreetOnly = !p.housenumber && p.street && p.name === p.street
  const building = p.name && !isStreetOnly && p.name !== streetLine ? p.name : ""
  const street = [streetLine, area && area !== city ? area : ""].filter(Boolean).join(", ")
  const cityPart = [city, p.state].filter(Boolean).join(", ")
  const cityPincode = p.postcode ? `${cityPart} - ${p.postcode}` : cityPart
  const title = p.name || streetLine || area || city || "Selected place"
  const subtitle = [streetLine && streetLine !== title ? streetLine : "", area, city, p.state, p.postcode]
    .filter((v, i, a) => v && v !== title && a.indexOf(v) === i)
    .join(", ")
  return { id: `${f.properties?.osm_type}${f.properties?.osm_id}-${lat}-${lng}`, lat, lng, building, street, cityPincode, title, subtitle }
}

async function searchPlaces(q: string, near: [number, number], signal: AbortSignal): Promise<Suggestion[]> {
  const url = `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&bbox=${INDIA_BBOX}&lat=${near[0]}&lon=${near[1]}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error("search failed")
  const data = await res.json()
  return (data.features || []).map(toPlace).filter(Boolean) as Suggestion[]
}

async function reversePlace(lat: number, lng: number): Promise<Suggestion | null> {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en`)
    if (!res.ok) return null
    const data = await res.json()
    const place = toPlace(data.features?.[0])
    return place ? { ...place, lat, lng } : null
  } catch {
    return null
  }
}

/** Pulls coordinates out of pasted text: a Google/OpenStreetMap link or a plain "lat, lng" pair. */
export function parseCoordinates(text: string): [number, number] | null {
  const t = decodeURIComponent(text.trim())
  const m =
    t.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
    t.match(/[?&](?:q|query|ll|mlat)=(-?\d{1,2}\.\d+)[,&](?:mlon=)?(-?\d{1,3}\.\d+)/) ||
    t.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/) ||
    t.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return lat >= 6 && lat <= 36 && lng >= 68 && lng <= 98 ? [lat, lng] : null
}

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#c2631a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg);margin:-26px 0 0 -13px"></div>',
  iconSize: [0, 0],
})

export default function AddressMapPicker({
  near,
  onPick,
}: {
  /** [lat, lng] to bias the search and to centre the map before anything is picked */
  near?: [number, number]
  onPick: (place: PickedPlace) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const center = near || DEFAULT_CENTER

  // Create the map once
  useEffect(() => {
    if (!mapEl.current || map.current) return
    const m = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView(center, 12)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    // Tapping the map drops (or moves) the pin
    m.on("click", (e: L.LeafletMouseEvent) => void place(e.latlng.lat, e.latlng.lng, true))
    map.current = m
    return () => {
      m.remove()
      map.current = null
      marker.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function place(lat: number, lng: number, lookup: boolean, known?: Suggestion) {
    const m = map.current
    if (!m) return
    setPicked({ lat, lng })
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(m)
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng()
        void place(p.lat, p.lng, true)
      })
    } else {
      marker.current.setLatLng([lat, lng])
    }
    m.setView([lat, lng], Math.max(m.getZoom(), 16))
    let found = known || null
    if (!found && lookup) found = await reversePlace(lat, lng)
    onPickRef.current(found || { lat, lng, building: "", street: "", cityPincode: "" })
    if (lookup && !found) setMessage("Pin placed. We could not read an address here, please fill the fields below.")
    else setMessage(null)
  }

  // Search as the user types (waits for a short pause, cancels the previous request)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3 || parseCoordinates(q)) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const found = await searchPlaces(q, center, ctrl.signal)
        setResults(found)
        setMessage(found.length ? null : "No match. Try fewer words, or tap the map to drop a pin.")
      } catch (e: any) {
        if (e?.name !== "AbortError") setMessage("Search is not available right now. Tap the map to drop a pin instead.")
      } finally {
        setLoading(false)
      }
    }, 450)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const choose = (s: Suggestion) => {
    setQuery(s.title)
    setResults([])
    void place(s.lat, s.lng, false, s)
  }

  const handlePaste = (value: string) => {
    setQuery(value)
    const c = parseCoordinates(value)
    if (c) {
      setResults([])
      void place(c[0], c[1], true)
    } else if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)/i.test(value.trim())) {
      setMessage("Short Google links cannot be read. Open the link, copy the long address from the browser, or search by name here.")
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => handlePaste(e.target.value)}
          placeholder="Search a place, area or address, or paste a map link"
          className="w-full bg-paper border border-line rounded px-8 py-2 text-[12.5px] text-ink placeholder:text-ink-faint/70 outline-none focus:border-saffron focus:ring-1 focus:ring-saffron"
        />
        {loading ? (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-faint" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("")
              setResults([])
              setMessage(null)
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
        {results.length > 0 && (
          <ul className="absolute z-[1000] left-0 right-0 mt-1 max-h-56 overflow-auto rounded border border-line bg-card shadow-lg">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => choose(s)}
                  className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-saffron-soft cursor-pointer"
                >
                  <MapPin size={13} className="mt-0.5 shrink-0 text-saffron" />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-ink truncate">{s.title}</span>
                    {s.subtitle && <span className="block text-[11px] text-ink-faint truncate">{s.subtitle}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {message && <p className="text-[11.5px] text-ink-soft">{message}</p>}
      <div className="relative z-0 overflow-hidden rounded border border-line">
        <div ref={mapEl} className="h-[190px] w-full bg-paper-soft" />
        {!picked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <span className="rounded bg-card/90 px-2 py-1 text-[11px] text-ink-soft shadow">
              Search above, or tap the map to place the pin
            </span>
          </div>
        )}
      </div>
      {picked ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded bg-forest/10 border border-forest/20 text-[11.5px] text-forest font-medium animate-fade-in">
          <span className="flex items-center gap-1.5 font-mono">
            <MapPin size={13} className="text-forest shrink-0" />
            📍 Pointed Location Saved: {picked.lat.toFixed(5)}° N, {picked.lng.toFixed(5)}° E
          </span>
          <span className="text-[10.5px] text-ink-faint">Drag the pin to adjust the exact spot</span>
        </div>
      ) : null}
    </div>
  )
}
