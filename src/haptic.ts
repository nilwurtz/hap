export type HapticPattern = number | number[]

export type HapticOptions = {
  /**
   * Vibration API pattern (Android/Chromium etc).
   * iOS "switch" trick ignores pattern and uses fixed feedback.
   */
  pattern?: HapticPattern
  /**
   * Minimum interval between triggers (ms). Helps avoid spam on rapid events.
   */
  cooldownMs?: number
  /**
   * If true, allow haptic even when pointer isn't coarse.
   * (e.g. you want it on trackpads that still support vibrate)
   */
  force?: boolean
  /**
   * If true, skip the prefers-reduced-motion check.
   */
  ignoreReducedMotion?: boolean
}

let lastFiredAt = 0
let iosLabel: HTMLLabelElement | null = null

function canUseDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

function prefersReducedMotion() {
  if (!canUseDOM()) return false
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
}

function isCoarsePointer() {
  if (!canUseDOM()) return false
  return window.matchMedia?.("(pointer: coarse)")?.matches ?? false
}

function ensureIosSwitchLabel(): HTMLLabelElement | null {
  if (!canUseDOM()) return null

  // Reuse if still attached
  if (iosLabel && document.contains(iosLabel)) return iosLabel

  const label = document.createElement("label")
  label.ariaHidden = "true"

  // Hide without display:none (some browsers may skip interaction on display:none)
  label.style.position = "fixed"
  label.style.left = "0"
  label.style.top = "0"
  label.style.width = "1px"
  label.style.height = "1px"
  label.style.opacity = "0"
  label.style.pointerEvents = "none"
  label.style.overflow = "hidden"

  const input = document.createElement("input")
  input.type = "checkbox"

  // Non-standard attribute used by iOS Safari to render a switch-style control
  // and (in some iOS versions) trigger subtle haptic on toggle.
  input.setAttribute("switch", "")

  label.appendChild(input)
  document.body.appendChild(label)

  iosLabel = label
  return label
}

/**
 * Trigger haptic feedback (best-effort).
 *
 * - Android/Chromium: uses Vibration API.
 * - iOS Safari: falls back to "switch toggle" trick when available.
 *
 * IMPORTANT: Call this directly inside a user gesture handler (onClick/onPointerUp),
 * otherwise browsers may suppress it.
 */
export function haptic(patternOrOptions: HapticPattern | HapticOptions = 50) {
  try {
    const opts: HapticOptions =
      typeof patternOrOptions === "number" || Array.isArray(patternOrOptions)
        ? { pattern: patternOrOptions }
        : patternOrOptions

    const pattern = opts.pattern ?? 50
    const cooldownMs = opts.cooldownMs ?? 60

    // SSR / non-browser
    if (!canUseDOM()) return

    // Respect reduced-motion by default
    if (!opts.ignoreReducedMotion && prefersReducedMotion()) return

    // Avoid firing on non-touch devices by default
    if (!opts.force && !isCoarsePointer()) return

    const now = Date.now()
    if (cooldownMs > 0 && now - lastFiredAt < cooldownMs) return
    lastFiredAt = now

    // 1) Vibration API path (Android / some browsers)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      // Some browsers return boolean; we don't care
      ;(navigator as Navigator & { vibrate?: (p: HapticPattern) => boolean }).vibrate?.(pattern)
      return
    }

    // 2) iOS best-effort "switch" trick
    const label = ensureIosSwitchLabel()
    label?.click()
  } catch {
    // no-op (production-safe)
  }
}

/**
 * Optional cleanup for SPAs/tests.
 * You usually don't need to call this.
 */
export function disposeHaptics() {
  try {
    if (!canUseDOM()) return
    if (iosLabel && document.contains(iosLabel)) {
      iosLabel.remove()
    }
    iosLabel = null
  } catch {
    // no-op
  }
}

/** @internal — exposed for testing only */
export function _resetLastFiredAt() {
  lastFiredAt = 0
}
