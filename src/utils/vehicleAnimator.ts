import L from "leaflet"
import { LatLng, shortestAngleDelta } from "./mapMatching"

export interface AnimationOptions {
  durationMs?: number
  onStep?: (currentPos: LatLng, currentBearing: number) => void
  onComplete?: () => void
}

export class VehicleMarkerAnimator {
  private marker: L.Marker | null = null
  private arrowElementId: string | null = null
  private currentPos: LatLng | null = null
  private currentBearing: number = 0
  private animationFrameId: number | null = null

  constructor(marker?: L.Marker, arrowElementId?: string) {
    if (marker) this.marker = marker
    if (arrowElementId) this.arrowElementId = arrowElementId
  }

  setMarker(marker: L.Marker, arrowElementId?: string) {
    this.marker = marker
    if (arrowElementId) this.arrowElementId = arrowElementId
  }

  /**
   * Smoothly interpolate marker from current position to target position
   * along with vehicle heading rotation.
   */
  animateTo(
    targetPos: LatLng,
    targetBearing: number,
    options: AnimationOptions = {},
  ) {
    if (!this.marker) return

    // If first placement, set directly
    if (!this.currentPos) {
      this.currentPos = targetPos
      this.currentBearing = targetBearing
      this.marker.setLatLng(targetPos)
      this.updateArrowDom(targetBearing)
      options.onComplete?.()
      return
    }

    // Cancel any ongoing animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    const startPos: LatLng = [this.currentPos[0], this.currentPos[1]]
    const startBearing = this.currentBearing
    const angleDelta = shortestAngleDelta(startBearing, targetBearing)
    const duration = options.durationMs || 1200
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)

      // Cubic ease-out: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3)

      const lat = startPos[0] + (targetPos[0] - startPos[0]) * ease
      const lng = startPos[1] + (targetPos[1] - startPos[1]) * ease
      const bearing = (startBearing + angleDelta * ease + 360) % 360

      this.currentPos = [lat, lng]
      this.currentBearing = bearing

      if (this.marker) {
        this.marker.setLatLng(this.currentPos)
      }
      this.updateArrowDom(bearing)
      options.onStep?.(this.currentPos, bearing)

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step)
      } else {
        this.animationFrameId = null
        options.onComplete?.()
      }
    }

    this.animationFrameId = requestAnimationFrame(step)
  }

  private updateArrowDom(bearing: number) {
    if (!this.arrowElementId) return
    const el = document.getElementById(this.arrowElementId)
    if (el) {
      el.style.transform = `rotate(${Math.round(bearing)}deg)`
    }
  }

  destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.marker = null
  }
}
