import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState, type FormEvent } from "react"

import { RdkitSmilesViewer } from "@/components/ChemicalViewer/RdkitSmilesViewer"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const samples = [
  { label: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { label: "Caffeine", smiles: "Cn1cnc2n(C)c(=O)n(C)c(=O)c12" },
  { label: "Benzene", smiles: "c1ccccc1" },
  { label: "Ethanol", smiles: "CCO" },
]

export const Route = createFileRoute("/_layout/smiles-viewer")({
  component: SmilesViewerPage,
  head: () => ({
    meta: [
      {
        title: "SMILES Viewer",
      },
    ],
  }),
  meta: () => [{ title: "SMILES Viewer" }],
})

function SmilesViewerPage() {
  const defaultSmiles = useMemo(() => samples[0]?.smiles ?? "", [])
  const [input, setInput] = useState(defaultSmiles)
  const [activeSmiles, setActiveSmiles] = useState(defaultSmiles)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActiveSmiles(input.trim())
  }

  const handleSampleClick = (smiles: string) => {
    setInput(smiles)
    setActiveSmiles(smiles)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>RDKit SMILES Render</CardTitle>
          <CardDescription>
            Enter a SMILES string or pick a sample to preview the SVG render.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="smiles">SMILES</Label>
              <Input
                id="smiles"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                Render
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleSampleClick(defaultSmiles)}
              >
                Reset
              </Button>
            </div>
          </form>
          <div className="grid grid-cols-2 gap-2">
            {samples.map((sample) => (
              <Button
                key={sample.smiles}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleSampleClick(sample.smiles)}
                className="justify-start"
              >
                {sample.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="min-h-[360px]">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            WebAssembly render powered by @rdkit/rdkit. Copy the SVG as needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RdkitSmilesViewer
            smiles={activeSmiles}
            width={480}
            height={360}
            className="bg-background"
            showSmiles
          />
        </CardContent>
      </Card>
    </div>
  )
}
