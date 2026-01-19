export type SmiDrawerTarget =
  | SVGElement
  | HTMLCanvasElement
  | HTMLImageElement
  | string
  | null

export type SmiDrawerOutput = SVGElement | HTMLCanvasElement | HTMLImageElement

export type SmiDrawerInstance = {
  draw: (
    smiles: string,
    target: SmiDrawerTarget,
    theme?: string,
    successCallback?: (element: SmiDrawerOutput) => void,
    errorCallback?: (error: unknown) => void,
    weights?: unknown,
  ) => void
}

export type SmiDrawerConstructor = new (
  moleculeOptions?: Record<string, unknown>,
  reactionOptions?: Record<string, unknown>,
) => SmiDrawerInstance

type SmilesDrawerExports = {
  SmiDrawer?: SmiDrawerConstructor
}

const SCRIPT_SRC = "/vendor/smiles-drawer/smiles-drawer.min.js"
const SCRIPT_ID = "smiles-drawer-script"

declare global {
  interface Window {
    SmilesDrawer?: SmilesDrawerExports
    SmiDrawer?: SmiDrawerConstructor
  }
}

let loadPromise: Promise<SmiDrawerConstructor> | null = null

function getLoadedConstructor(): SmiDrawerConstructor | null {
  if (typeof window === "undefined") return null
  return window.SmiDrawer ?? window.SmilesDrawer?.SmiDrawer ?? null
}

/**
 * Load the smiles-drawer UMD bundle from the public vendor folder.
 * Returns the library once ready.
 */
export function ensureSmilesDrawer(): Promise<SmiDrawerConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is not available"))
  }

  const existing = getLoadedConstructor()
  if (existing) return Promise.resolve(existing)

  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const constructor = getLoadedConstructor()
    if (constructor) {
      resolve(constructor)
      return
    }

    if (document.getElementById(SCRIPT_ID)) {
      // If script exists but library is still missing, wait a tick then check again
      setTimeout(() => {
        const maybeConstructor = getLoadedConstructor()
        maybeConstructor
          ? resolve(maybeConstructor)
          : reject(new Error("smiles-drawer failed to load"))
      }, 50)
      return
    }

    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => {
      const loaded = getLoadedConstructor()
      loaded
        ? resolve(loaded)
        : reject(new Error("smiles-drawer failed to initialize"))
    }
    script.onerror = () => reject(new Error("Unable to load smiles-drawer script"))
    document.body.append(script)
  })

  return loadPromise
}
