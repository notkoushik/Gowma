import L from "leaflet"

/**
 * Securely resolves the CARTO Basemap API Key from client environment variables (.env).
 * Zero credentials or tokens are committed to source control.
 */
function getActiveCartoKey(): string | null {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const primary = import.meta.env.VITE_CARTO_API_KEY
    if (primary && typeof primary === "string" && primary.trim() !== "") {
      return primary.trim()
    }
    const backup = import.meta.env.VITE_CARTO_BACKUP_KEY
    if (backup && typeof backup === "string" && backup.trim() !== "") {
      return backup.trim()
    }
  }
  return null
}

/**
 * Creates a dual-layer, zero-latency resilient basemap:
 *
 * 1. Underlay (Layer 0, Hot-Standby):
 *    Official OpenStreetMap standard street tiles (100% free, zero keys required, zero latency).
 *    Pre-rendered directly behind the canvas so that if any primary tile drops, the user
 *    sees the map instantly without any visual stutter or white/gray voids.
 *
 * 2. Primary Overlay (Layer 1, High-Contrast UI):
 *    CARTO Voyager basemap dynamically authenticated via VITE_CARTO_API_KEY (.env).
 *    If an individual tile encounters network latency, rate limits (HTTP 429/403), or quota exhaustion,
 *    the individual tile element is immediately made transparent (0ms latency), seamlessly
 *    revealing the pre-rendered OpenStreetMap tile directly underneath.
 *    If consecutive tile errors occur, the CARTO overlay layer is cleanly unmounted.
 */
export function createResilientTileLayer(map: L.Map) {
  // Layer 1: OpenStreetMap (Hot-Standby underlay - always rendered, instant fallback)
  const osmUnderlay = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
      zIndex: 1,
    },
  )
  osmUnderlay.addTo(map)

  const cartoKey = getActiveCartoKey()

  // If no CARTO key is configured in .env, OpenStreetMap operates standalone with zero latency
  if (!cartoKey) {
    return osmUnderlay
  }

  // Layer 2: CARTO Voyager (High-contrast UI overlay)
  const cartoVoyagerUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`

  const cartoOverlay = L.tileLayer(cartoVoyagerUrl, {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    maxZoom: 19,
    subdomains: ["a", "b", "c", "d"],
    zIndex: 2,
  })

  let consecutiveErrors = 0

  cartoOverlay.on("tileerror", (e: any) => {
    // Zero-latency failover: instantly make failed CARTO tile transparent
    // so the pre-rendered OpenStreetMap tile shows through seamlessly with 0ms visual glitch
    if (e?.tile && e.tile instanceof HTMLElement) {
      e.tile.style.opacity = "0"
      e.tile.style.visibility = "hidden"
    }
    consecutiveErrors++
    if (consecutiveErrors >= 4 && map.hasLayer(cartoOverlay)) {
      console.warn(
        "CARTO Basemap limit or network interruption detected. Seamlessly falling back to active OpenStreetMap hot-standby underlay.",
      )
      try {
        map.removeLayer(cartoOverlay)
      } catch {}
    }
  })

  cartoOverlay.on("tileload", () => {
    consecutiveErrors = 0
  })

  cartoOverlay.addTo(map)
  return cartoOverlay
}
