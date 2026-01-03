import initRDKitModule, {
  type RDKitLoader,
  type RDKitModule,
} from "@rdkit/rdkit"
import rdkitWasmUrl from "@rdkit/rdkit/Code/MinimalLib/dist/RDKit_minimal.wasm?url"

const loadRDKitModule = initRDKitModule as unknown as RDKitLoader
let loadPromise: Promise<RDKitModule> | undefined

/**
 * Ensure the RDKit WebAssembly module is loaded once and reused.
 */
export const ensureRDKit = async (): Promise<RDKitModule> => {
  if (!loadPromise) {
    loadPromise = loadRDKitModule({
      locateFile: () => rdkitWasmUrl,
    }).catch((err: unknown) => {
      loadPromise = undefined
      throw err
    })
  }

  return loadPromise
}

export type { RDKitModule }
