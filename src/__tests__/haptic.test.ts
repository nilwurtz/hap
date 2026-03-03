import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _resetLastFiredAt, disposeHaptics, haptic } from "../haptic"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockMatchMedia(matches: Record<string, boolean>) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function setupCoarsePointer(coarse = true) {
  mockMatchMedia({
    "(pointer: coarse)": coarse,
    "(prefers-reduced-motion: reduce)": false,
  })
}

function setupReducedMotion() {
  mockMatchMedia({
    "(pointer: coarse)": true,
    "(prefers-reduced-motion: reduce)": true,
  })
}

function addVibrateMock() {
  const mock = vi.fn()
  Object.defineProperty(navigator, "vibrate", {
    value: mock,
    writable: true,
    configurable: true,
  })
  return mock
}

function removeVibrateMock() {
  if ("vibrate" in navigator) {
    // Property was added as configurable:true, so deletion is safe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).vibrate
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("haptic", () => {
  beforeEach(() => {
    _resetLastFiredAt()
    disposeHaptics()
    vi.useFakeTimers()
  })

  afterEach(() => {
    removeVibrateMock()
    disposeHaptics()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // Vibration API path
  // -------------------------------------------------------------------------

  describe("Vibration API path", () => {
    let vibrate: ReturnType<typeof vi.fn>

    beforeEach(() => {
      setupCoarsePointer()
      vibrate = addVibrateMock()
    })

    it("calls navigator.vibrate with the default pattern (50 ms)", () => {
      haptic()
      expect(vibrate).toHaveBeenCalledWith(50)
    })

    it("calls navigator.vibrate with a numeric pattern", () => {
      haptic(100)
      expect(vibrate).toHaveBeenCalledWith(100)
    })

    it("calls navigator.vibrate with an array pattern", () => {
      haptic([200, 100, 200])
      expect(vibrate).toHaveBeenCalledWith([200, 100, 200])
    })

    it("calls navigator.vibrate with a pattern from options object", () => {
      haptic({ pattern: 75 })
      expect(vibrate).toHaveBeenCalledWith(75)
    })

    it("uses default pattern when options object omits pattern", () => {
      haptic({ force: true })
      expect(vibrate).toHaveBeenCalledWith(50)
    })
  })

  // -------------------------------------------------------------------------
  // iOS "switch" fallback path
  // -------------------------------------------------------------------------

  describe("iOS switch fallback path", () => {
    beforeEach(() => {
      // No vibrate API present — falls through to iOS switch trick
      setupCoarsePointer()
    })

    it("appends a hidden label+checkbox to document.body", () => {
      haptic()
      const labels = document.querySelectorAll("label[aria-hidden='true']")
      expect(labels.length).toBe(1)
    })

    it("the checkbox has the switch attribute", () => {
      haptic()
      const input = document.querySelector("label[aria-hidden='true'] input") as HTMLInputElement
      expect(input).not.toBeNull()
      expect(input.getAttribute("switch")).toBe("")
    })

    it("reuses the same label on subsequent calls", () => {
      haptic()
      _resetLastFiredAt()
      vi.advanceTimersByTime(200)
      haptic()
      const labels = document.querySelectorAll("label[aria-hidden='true']")
      expect(labels.length).toBe(1)
    })

    it("clicks the label to trigger iOS haptic on subsequent call", () => {
      haptic()
      const label = document.querySelector("label[aria-hidden='true']") as HTMLLabelElement
      const clickSpy = vi.spyOn(label, "click")
      _resetLastFiredAt()
      vi.advanceTimersByTime(200)
      haptic()
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // disposeHaptics
  // -------------------------------------------------------------------------

  describe("disposeHaptics", () => {
    beforeEach(() => {
      setupCoarsePointer()
    })

    it("removes the label from the DOM", () => {
      haptic()
      expect(document.querySelector("label[aria-hidden='true']")).not.toBeNull()
      disposeHaptics()
      expect(document.querySelector("label[aria-hidden='true']")).toBeNull()
    })

    it("re-creates the label on the next haptic call after dispose", () => {
      haptic()
      disposeHaptics()
      _resetLastFiredAt()
      haptic()
      expect(document.querySelector("label[aria-hidden='true']")).not.toBeNull()
    })

    it("is safe to call multiple times", () => {
      expect(() => {
        disposeHaptics()
        disposeHaptics()
      }).not.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  describe("guards", () => {
    it("does nothing when prefers-reduced-motion is set", () => {
      setupReducedMotion()
      const vibrate = addVibrateMock()
      haptic()
      expect(vibrate).not.toHaveBeenCalled()
    })

    it("fires when ignoreReducedMotion is true even if reduced-motion is set", () => {
      setupReducedMotion()
      const vibrate = addVibrateMock()
      haptic({ ignoreReducedMotion: true })
      expect(vibrate).toHaveBeenCalled()
    })

    it("does nothing on non-coarse (desktop) pointer", () => {
      setupCoarsePointer(false)
      const vibrate = addVibrateMock()
      haptic()
      expect(vibrate).not.toHaveBeenCalled()
    })

    it("fires on non-coarse pointer when force is true", () => {
      setupCoarsePointer(false)
      const vibrate = addVibrateMock()
      haptic({ force: true })
      expect(vibrate).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Cooldown
  // -------------------------------------------------------------------------

  describe("cooldown", () => {
    let vibrate: ReturnType<typeof vi.fn>

    beforeEach(() => {
      setupCoarsePointer()
      vibrate = addVibrateMock()
    })

    it("suppresses a second call within the default cooldown window (60 ms)", () => {
      haptic()
      vi.advanceTimersByTime(30)
      haptic()
      expect(vibrate).toHaveBeenCalledTimes(1)
    })

    it("allows a second call after the cooldown window", () => {
      haptic()
      vi.advanceTimersByTime(61)
      haptic()
      expect(vibrate).toHaveBeenCalledTimes(2)
    })

    it("respects a custom cooldownMs", () => {
      haptic({ cooldownMs: 200 })
      vi.advanceTimersByTime(100)
      haptic({ cooldownMs: 200 })
      expect(vibrate).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(101)
      haptic({ cooldownMs: 200 })
      expect(vibrate).toHaveBeenCalledTimes(2)
    })

    it("fires every time when cooldownMs is 0", () => {
      haptic({ cooldownMs: 0 })
      haptic({ cooldownMs: 0 })
      haptic({ cooldownMs: 0 })
      expect(vibrate).toHaveBeenCalledTimes(3)
    })
  })
})
