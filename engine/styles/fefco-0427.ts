import { flap, panel, row } from '../dsl.ts'
import type { Face, FaceId, FoldStages, SizeCoeffs, StyleDef, Vec3 } from '../types.ts'

/** Locking tab depth (mm) at the roll ends. */
const TAB_D = 15
const TAB_TAPER = 3
/** Roll-over gap: exactly two material thicknesses. */
const ROLL_GAP_T = 2
/** Ear clearance: two ears must not meet nose-to-nose. */
const EAR_CLEARANCE = 3

export const f0427Coeffs: SizeCoeffs = {
  // The L axis is double-walled: each roll end folds
  // outer wall → roll-over → inner wall, so the inner-wall
  // planes bounding the cavity sit 4T inboard of the
  // manufacture-size edges on that axis. Hence:
  //   manufacture.l = inner.l + 5T   (crease-to-crease)
  //   outer.l       = inner.l + 6T   (cut contour)
  // W and H are single-walled (+T / +2T).
  manufacture: { l: 5, w: 1, h: 1 },
  outer: { l: 6, w: 2, h: 2 },
}

export function buildFefco0427Faces(m: Vec3, thickness: number): Face[] {
  const { l: L, w: W, h: H } = m
  const rollGap = ROLL_GAP_T * thickness
  const earDepth = Math.max(W / 2 - EAR_CLEARANCE, 5)
  const lidTuck = Math.max(H - 2, 5)
  const wingDepth = Math.max(H - 4, 5)
  const tuckEarDepth = Math.max(H / 2 - 2, 5)

  const b = row([
    panel('backWall', H, L),
    panel('base', W, L),
    panel('frontWall', H, L),
    panel('lid', W, L),
    panel('lidTuck', lidTuck, L),
  ])

  // Roll ends on both tube ends (base top/bottom edges):
  // outer wall → roll-over → inner wall → locking tab.
  for (const end of ['L', 'R'] as const) {
    const attach = end === 'L' ? 'attachBottom' : 'attachTop'
    b[attach]('base', flap(`side${end}Outer`, H))
    b[attach](`side${end}Outer`, flap(`side${end}Roll`, rollGap))
    b[attach](`side${end}Roll`, flap(`side${end}Inner`, H))
    b[attach](`side${end}Inner`, flap(`side${end}Tab`, TAB_D, { taper: TAB_TAPER }))
  }

  // Ears on the front and back walls, captured by the roll ends.
  b.attachTop('backWall', flap('earBackL', earDepth, { taper: 3 }))
  b.attachBottom('backWall', flap('earBackR', earDepth, { taper: 3 }))
  b.attachTop('frontWall', flap('earFrontL', earDepth, { taper: 3 }))
  b.attachBottom('frontWall', flap('earFrontR', earDepth, { taper: 3 }))

  // Lid wings tuck into the roll-end gap.
  b.attachTop('lid', flap('wingBack', wingDepth))
  b.attachBottom('lid', flap('wingFront', wingDepth))

  // Front tuck ears fold alongside the front wall.
  b.attachTop('lidTuck', flap('lidTuckTop', tuckEarDepth))
  b.attachBottom('lidTuck', flap('lidTuckBot', tuckEarDepth))

  return b.build()
}

export const f0427FoldRoot: FaceId = 'base'
export const f0427FoldStages: FoldStages = [
  ['backWall', 'frontWall'],
  ['earBackL', 'earBackR', 'earFrontL', 'earFrontR'],
  ['sideLOuter', 'sideROuter'], // capturing the ears
  ['sideLRoll', 'sideRRoll'],
  ['sideLInner', 'sideRInner'],
  ['sideLTab', 'sideRTab'],
  ['lid', 'wingBack', 'wingFront'],
  ['lidTuck', 'lidTuckTop', 'lidTuckBot'],
]

export const fefco0427: StyleDef = {
  id: 'fefco-0427',
  label: 'FEFCO 0427 · самоблокирующаяся вырубная коробка (mailer)',
  description:
    'Folder-type box. Die-cut from a single sheet, self-locking, no adhesive. Roll ends with locking tabs, hinged lid with front tuck.',
  fefcoRef: 'FEFCO Code, 12th ed. (2022), p.52',
  verified: false,
  limits: { l: [80, 900], w: [60, 700], h: [20, 400] },
  defaults: { l: 300, w: 200, h: 80 },
  defaultMaterialId: 'micro-e',
  coeffs: f0427Coeffs,
  buildFaces: buildFefco0427Faces,
  foldRoot: f0427FoldRoot,
  foldStages: f0427FoldStages,
  testVector: {
    input: { l: 254, w: 254, h: 102 },
    thickness: 1.5,
    expectFaces: 21,
    expectBlank: { x: 0, y: 0, w: 810, h: 655 },
    note: 'Reference blank 810×655 mm from a published source; our engine produces 819.5×711.5 mm — the delta is in roll-end allowances. Verify against a real die before setting the verification badge.',
  },
}
