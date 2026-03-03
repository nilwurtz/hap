import { haptic } from "../src/index"

// Device detection badge
const badge = document.getElementById("device-badge")!
const label = document.getElementById("device-label")!

const isCoarse = window.matchMedia("(pointer: coarse)").matches
if (isCoarse) {
  badge.classList.add("mobile")
  label.textContent = "Mobile detected — tap to feel haptics"
} else {
  label.textContent = "Desktop — use Force button or open on mobile"
}

// Button bindings
document.getElementById("btn-light")!.addEventListener("click", () => {
  haptic(50)
})

document.getElementById("btn-medium")!.addEventListener("click", () => {
  haptic(100)
})

document.getElementById("btn-heavy")!.addEventListener("click", () => {
  haptic(200)
})

document.getElementById("btn-double")!.addEventListener("click", () => {
  haptic({ pattern: [50, 80, 50] })
})

document.getElementById("btn-pattern")!.addEventListener("click", () => {
  haptic({ pattern: [50, 100, 50, 100, 50, 200, 100, 100, 100] })
})

document.getElementById("btn-cooldown")!.addEventListener("click", () => {
  haptic({ pattern: 50, cooldownMs: 0 })
})

document.getElementById("btn-force")!.addEventListener("click", () => {
  haptic({ pattern: 50, force: true })
})
