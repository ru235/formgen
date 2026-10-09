# ARCHITECTURE — formgen engine

## Approach

Constructions are described **in code, not JSON**. A box style is a pure
function `(params) => Dieline`; the same model drives the SVG preview,
the PDF/DXF export and the price calculation, so they can never diverge.

Architecture reference: LOGAN1420/Box-Template-Generator (no LICENSE —
study only, we write our own code).

## Engine modules (dependency-free TypeScript)

| Module | Responsibility |
|---|---|
| `dsl.ts` | `row(panel(...), ...).attachTop/attachBottom/attachLeft/attachRight(flap(...))` — declarative construction description; builder builds the face-edge graph with reciprocal creases; **throws** on impossible geometry (double crease on a side, `2×taper ≥ hinge extent`, unknown parent, duplicate ids) |
| `types.ts` | `Face` = closed loop of `Edge { kind: cut\|crease\|perf, to, hinge?, foldAngle? }`; `holes` for CFQ slots — **real layer**, not a placeholder |
| `geometry.ts` | bbox, normalisation, edge utilities |
| `invariants.ts` | geometric invariants every dieline must satisfy (closed loops, reciprocal hinges) |
| `sizes.ts` | `SizeCoeffs` — conversion between inner / manufacture / outer sizes through material thickness |
| `validate.ts` | advisory warnings (dimension ranges, blank size, thickness-to-size ratio) — never blocks generation |
| `materials.ts` | material presets (картон 300 г/м², микрогофра E 1.5 мм, гофра B ~3 мм, custom) |
| `fold.ts` + `stages.ts` | 3D folding by ordered `foldStages` (phase 2) |
| `styles/*` | one module per FEFCO code |

## StyleDef — the uniform construction format

```ts
type StyleDef = {
  id: string            // 'fefco-0427'
  label: string
  description: string
  limits: { l: [min, max]; w: [min, max]; h: [min, max] }
  defaults: Vec3
  defaultMaterialId: string
  coeffs: SizeCoeffs    // thickness-driven size conversion
  buildFaces: (m: Vec3, thickness: number) => Face[]
  foldRoot: FaceId
  foldStages: FoldStages  // ordered assembly (phase 2)
}
```

`generate(styleId, params) → Dieline`:

`resolveSizes` (by sizeMode + thickness) → `buildFaces` → `normaliseFaces` → `bbox` → `validate` (warnings).

## Storage

- Constructions = TS modules in git; only a developer adds styles (commit).
- JSON holds **metadata only**: FEFCO reference (edition + page), material
  presets, test vectors, tariffs, verification badge.
- Admin UI: toggle visibility of styles; no style editing.

## Stack

- Frontend: static site + TS bundle; instant SVG preview in the browser
  (client-side engine).
- Export: `api/render.php` receives **ready entities** (cut/crease/perf/glue
  with coordinates and lengths) and converts to PDF (TCPDF, 1:1 mm,
  0.1 mm precision) and DXF R12 (layers CUT/CREASE/PERF/GLUE).
  **PHP never recomputes geometry** — single source of truth.
- Leads: submit.php analog — rate-limit by IP, leads.json, Telegram/email.

## Export contract

- PDF: true 1:1 mm scale, vector, dimension annotations L/B/H, layer legend,
  verification badge, disclaimer.
- DXF: R12, clean geometry (no kerf compensation), separate layers
  CUT / CREASE / PERF / GLUE, units mm.
- Price payload: Σ cut m, Σ crease m, Σ perf m, Σ glue m — computed from the
  same graph as the drawing.
