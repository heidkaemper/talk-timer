const PRESETS = [5, 10, 15, 20, 30, 45, 60, 90]

const STORE = "talk-timer:"
const MAX_MINUTES = 240
const HOLD_MS = 800
const TICK_MS = 250

const PAPER = "var(--paper)"
const WARN = "var(--warn)"
const OVER = "var(--over)"

const $ = (id) => document.getElementById(id)
const body = document.body

const read = (key, fallback) => {
    try {
        const raw = localStorage.getItem(STORE + key)

        if (raw === null) return fallback

        return JSON.parse(raw)
    } catch {
        return fallback
    }
}

const write = (key, value) => {
    try {
        localStorage.setItem(STORE + key, JSON.stringify(value))
    } catch {
        return
    }
}

const clampMinutes = (value) => Math.min(MAX_MINUTES, Math.max(1, Math.round(Number(value) || 30)))
const pad = (value) => String(value).padStart(2, "0")
const minuteLabel = (count) => `${count} ${count === 1 ? "minute" : "minutes"}`

let duration = clampMinutes(read("duration", 30))
let showSeconds = read("seconds", false) === true
let keepAwake = read("wake", true) !== false

let startedAt = null
let accumulated = 0
let running = false
let wakeLock = null
let ticker = null
let perTick = 1
let alerted = false
let lastFace = ""
let lastMinute = -1

const lengths = $("lengths")

PRESETS.forEach((preset) => {
    const button = document.createElement("button")

    button.type = "button"
    button.className = "length"
    button.dataset.min = preset
    button.innerHTML = `${preset}<small>min</small>`

    lengths.append(button)
})

const paintChoice = () => {
    $("chosen").textContent = minuteLabel(duration)

    lengths.querySelectorAll(".length").forEach((button) => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.min) === duration))
    })
}

const paintSwitches = () => {
    $("opt-seconds").setAttribute("aria-checked", String(showSeconds))
    $("opt-wake").setAttribute("aria-checked", String(keepAwake))

    body.classList.toggle("seconds", showSeconds)
}

const setDuration = (value) => {
    duration = clampMinutes(value)

    write("duration", duration)
    paintChoice()
}

const buildTicks = () => {
    perTick = duration > 60 ? 5 : 1

    const box = $("ticks")
    const count = Math.ceil(duration / perTick)

    box.replaceChildren()

    for (let i = 0; i < count; i += 1) {
        const tick = document.createElement("div")

        tick.className = (i + 1) % 5 === 0 ? "tick fifth" : "tick"
        box.append(tick)
    }
}

const setWake = (state, text) => {
    const el = $("wake")

    el.className = state
    el.textContent = text
}

const requestWakeLock = async () => {
    if (!keepAwake) return setWake("", "Screen may sleep")
    if (!("wakeLock" in navigator)) return setWake("off", "Screen not kept awake")

    try {
        wakeLock = await navigator.wakeLock.request("screen")

        setWake("on", "Screen stays awake")

        wakeLock.addEventListener("release", () => {
            wakeLock = null

            if (!running) return

            setWake("off", "Lock lost — tap timer")
        })
    } catch {
        setWake("off", "Screen not kept awake")
    }
}

const releaseWakeLock = () => {
    wakeLock?.release()
    wakeLock = null
}

const elapsedMs = () => accumulated + (startedAt ? Date.now() - startedAt : 0)

const formatElapsed = (ms) => {
    const total = Math.floor(ms / 1000)
    const hours = Math.floor(total / 3600)
    const mins = Math.floor(total / 60) % 60

    if (!showSeconds) return `${hours}:${pad(mins)}`

    return `${hours}:${pad(mins)}:${pad(total % 60)}`
}

const remainingLabel = (left) => {
    if (left > 0) return `${minuteLabel(left)} left`
    if (left === 0) return "final minute"

    return `${minuteLabel(-left)} over`
}

const accentFor = (mins) => {
    if (mins > duration) return OVER
    if (mins / duration >= 0.8) return WARN

    return PAPER
}

const paintTicks = (mins) => {
    const current = Math.floor(mins / perTick)

    document.querySelectorAll(".tick").forEach((tick, index) => {
        tick.classList.toggle("done", index < current)
        tick.classList.toggle("now", index === current)
    })
}

const render = () => {
    const ms = elapsedMs()
    const face = formatElapsed(ms)

    if (face !== lastFace) {
        lastFace = face
        $("elapsed").textContent = face
    }

    const mins = Math.floor(ms / 60000)

    if (mins === lastMinute) return

    lastMinute = mins

    $("remaining").textContent = remainingLabel(duration - mins)
    document.documentElement.style.setProperty("--accent", accentFor(mins))

    paintTicks(mins)

    if (mins < duration || alerted) return

    alerted = true
    navigator.vibrate?.(200)
}

const start = () => {
    startedAt = Date.now()
    running = true

    body.classList.remove("paused")
    requestWakeLock()
    render()

    ticker = setInterval(render, TICK_MS)
}

const pause = () => {
    accumulated = elapsedMs()
    startedAt = null
    running = false

    clearInterval(ticker)
    body.classList.add("paused")
    releaseWakeLock()
    setWake("", "Paused")
}

const stop = () => {
    clearInterval(ticker)
    releaseWakeLock()

    running = false
    startedAt = null
    accumulated = 0
    alerted = false

    body.classList.remove("running", "paused")
    document.documentElement.style.setProperty("--accent", PAPER)
}

lengths.addEventListener("click", (event) => {
    const button = event.target.closest(".length")

    if (!button) return

    setDuration(button.dataset.min)
})

$("minus").addEventListener("click", () => setDuration(duration - 1))
$("plus").addEventListener("click", () => setDuration(duration + 1))

$("opt-seconds").addEventListener("click", () => {
    showSeconds = !showSeconds

    write("seconds", showSeconds)
    paintSwitches()

    lastFace = ""
    render()
})

$("opt-wake").addEventListener("click", () => {
    keepAwake = !keepAwake

    write("wake", keepAwake)
    paintSwitches()
})

$("go").addEventListener("click", () => {
    accumulated = 0
    alerted = false
    lastFace = ""
    lastMinute = -1

    buildTicks()
    body.classList.add("running")
    start()
})

$("face").addEventListener("click", () => {
    if (running) return pause()

    start()
})

const resetButton = $("reset")
let holdTimer = null

const cancelHold = () => {
    clearTimeout(holdTimer)
    resetButton.classList.remove("holding")
}

resetButton.addEventListener("pointerdown", (event) => {
    event.preventDefault()
    resetButton.classList.add("holding")

    holdTimer = setTimeout(() => {
        resetButton.classList.remove("holding")
        stop()
    }, HOLD_MS)
})

resetButton.addEventListener("pointerup", cancelHold)
resetButton.addEventListener("pointercancel", cancelHold)
resetButton.addEventListener("pointerleave", cancelHold)

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return
    if (!running || wakeLock) return

    requestWakeLock()
})

paintChoice()
paintSwitches()

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn)
}
