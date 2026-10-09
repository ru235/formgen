import { flap, panel, row } from '../dsl.ts'
import type { Face, FaceId, FoldStages, SizeCoeffs, StyleDef, Vec3 } from '../types.ts'

/** Manufacturer's joint (glue tab) width. */
const GLUE_TAB = 20
/** Snap-bottom slot: depth/width as functions of material thickness. */
const NOTCH_D_T = 4
const NOTCH_W_T = 2.5
const NOTCH_D_MIN = 10
const NOTCH_W_MIN = 6

export const f0215Coeffs: SizeCoeffs = {
  // Single-walled: crease-to-crease = inner + T, cut contour = inner + 2T.
  manufacture: { l: 1, w: 1, h: 1 },
  outer: { l: 2, w: 2, h: 2 },
}

export function buildFefco0215Faces(m: Vec3, thickness: number): Face[] {
  const { l: L, w: W, h: H } = m
  const half = H / 2
  const notchD = Math.max(NOTCH_D_T * thickness, NOTCH_D_MIN)
  const notchW = Math.max(NOTCH_W_T * thickness, NOTCH_W_MIN)

  const b = row([
    panel('back', L, H),
    panel('side1', W, H),
    panel('front', L, H),
    panel('side2', W, H),
  ]).attachLeft('back', flap('glueTab', GLUE_TAB, { edgeKind: 'glue' }))

  // Top: four half flaps meeting in the centre (full lid).
  for (const id of ['back', 'side1', 'front', 'side2']) {
    b.attachTop(id, flap(`${id}Top`, half))
  }

  // Bottom: hand-locked 1-2-3 snap — each flap carries a central
  // slot opening at the tip; the tongues interlock in assembly.
  for (const id of ['side1', 'side2', 'back', 'front']) {
    const width = id === 'side1' || id === 'side2' ? W : L
    b.attachBottom(id, flap(`${id}Bot`, half, {
      holes: [{ x: width / 2 - notchW / 2, y: half - notchD, w: notchW, h: notchD }],
    }))
  }

  return b.build()
}

export const f0215FoldRoot: FaceId = 'back'
export const f0215FoldStages: FoldStages = [
  ['side1', 'front', 'side2', 'glueTab'], // close the tube
  ['side1Bot', 'side2Bot'], // minor flaps first
  ['backBot', 'frontBot'], // major flaps lock over them (1-2-3)
  ['side1Top', 'side2Top'],
  ['backTop', 'frontTop'], // top flaps meet in the centre
]

export const fefco0215: StyleDef = {
  id: 'fefco-0215',
  label: 'FEFCO 0215 · слотковая коробка с snap-bottom 1-2-3 и крышкой',
  description:
    'Slotted container. Hand-locked 1-2-3 snap bottom, full lid of four half flaps meeting in the centre. Glued/stitched manufacturer\'s joint.',
  fefcoRef: 'FEFCO Code, 12th ed. (2022)',
  verified: false,
  limits: { l: [50, 1200], w: [50, 1200], h: [50, 1200] },
  defaults: { l: 300, w: 200, h: 150 },
  defaultMaterialId: 'flute-b',
  coeffs: f0215Coeffs,
  buildFaces: buildFefco0215Faces,
  foldRoot: f0215FoldRoot,
  foldStages: f0215FoldStages,
  testVector: {
    input: { l: 300, w: 200, h: 150 },
    thickness: 3,
    expectFaces: 13,
    note: 'Structural vector: 13 faces, 12 creases, 4 snap slots. Blank gabarites to be verified against a real die.',
  },
}
