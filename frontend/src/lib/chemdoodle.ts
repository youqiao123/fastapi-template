const stripTrailingSlash = (value: string) => value.replace(/\/$/, "")
const base = `${stripTrailingSlash(import.meta.env.BASE_URL ?? "")}/vendor/chemdoodle`

const sniffLexicalChemDoodle = () => {
  try {
    // Indirect eval to reach global lexical bindings (top-level let/const).
    return (0, eval)("typeof ChemDoodle !== 'undefined' ? ChemDoodle : undefined")
  } catch (err) {
    console.warn("ChemDoodle sniff failed", err)
    return undefined
  }
}

const getGlobalChemDoodle = () =>
  (globalThis as any).ChemDoodle ||
  (window as any).ChemDoodle ||
  sniffLexicalChemDoodle()

const ensureStyle = (href: string, id: string) => {
  const existing =
    document.querySelector(`link[data-chemdoodle-id="${id}"]`) ??
    document.querySelector(`link[href="${href}"]`)
  if (existing) return

  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href
  link.dataset.chemdoodleId = id
  document.head.appendChild(link)
}

const loadScriptOnce = (src: string, id: string) =>
  new Promise<void>((resolve, reject) => {
    const existing =
      (document.querySelector(`script[data-chemdoodle-id="${id}"]`) as
        | HTMLScriptElement
        | null) ??
      (document.querySelector(`script[src="${src}"]`) as
        | HTMLScriptElement
        | null)

    if (existing) {
      const alreadyLoaded =
        existing.dataset.loaded === "true" ||
        (existing as any).readyState === "complete" ||
        (existing as any).readyState === "loaded"

      if (alreadyLoaded) {
        resolve()
        return
      }
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      )
      return
    }

    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.chemdoodleId = id
    script.onload = () => {
      script.dataset.loaded = "true"
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })

let loadingPromise: Promise<any> | null = null

export const ensureChemDoodle = async () => {
  const existing = getGlobalChemDoodle()
  if (existing) {
    ;(window as any).ChemDoodle = existing
    return existing
  }

  if (!loadingPromise) {
    loadingPromise = (async () => {
      ensureStyle(`${base}/ChemDoodleWeb.css`, "chemdoodle-style")
      await loadScriptOnce(`${base}/ChemDoodleWeb.js`, "chemdoodle-core")
      await loadScriptOnce(`${base}/ChemDoodleWeb-uis.js`, "chemdoodle-uis")
      const cd = getGlobalChemDoodle()
      if (cd) {
        ;(window as any).ChemDoodle = cd
        return cd
      }
      return null
    })()
  }

  return loadingPromise
}
