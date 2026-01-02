import initRDKitModule, { type RDKitModule } from "@rdkit/rdkit"
import rdkitWasmUrl from "@rdkit/rdkit/Code/MinimalLib/dist/RDKit_minimal.wasm?url"

let loadPromise: Promise<RDKitModule> | null = null

/**
 * Ensure the RDKit WebAssembly module is loaded once and reused.
 */
export const ensureRDKit = async () => {
  if (!loadPromise) {
    loadPromise = initRDKitModule({
      locateFile: () => rdkitWasmUrl,
    }).catch((err) => {
      loadPromise = null
      throw err
    })
  }

  return loadPromise
}

export type { RDKitModule }
