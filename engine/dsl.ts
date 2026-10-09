import type { Edge, Face, FaceId, Hole, Pt } from './types.ts'

export type Side = 'top' | 'bottom' | 'left' | 'right'
export type PanelSpec = { id: FaceId; w: number; h: number }
export type FlapSpec = {
  id: FaceId
  depth: number
  taper?: number
  /** Edge kind for the free (non-hinge) edges. Joint edge is always a crease. */
  edgeKind?: 'cut' | 'glue'
  holes?: Hole[]
}

const EPS = 1e-6
const SIDE_INDEX: Record<Side, number> = { top: 0, right: 1, bottom: 2, left: 3 }
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
const DEFAULT_FOLD = 90

type Box = { x0: number; y0: number; x1: number; y1: number }
type Attachment = { parentId: FaceId; side: Side; spec: FlapSpec }

function edge(to: Pt, kind: 'cut' | 'glue'): Edge {
  return { kind, to }
}

function rectFace(id: FaceId, b: Box): Face {
  return {
    id,
    origin: { x: b.x0, y: b.y0 },
    edges: [
      edge({ x: b.x1, y: b.y0 }, 'cut'),
      edge({ x: b.x1, y: b.y1 }, 'cut'),
      edge({ x: b.x0, y: b.y1 }, 'cut'),
      edge({ x: b.x0, y: b.y0 }, 'cut'),
    ],
  }
}

function setCrease(faces: Map<FaceId, Face>, faceId: FaceId, side: Side, hinge: FaceId): void {
  const face = faces.get(faceId)
  if (!face) throw new Error(`setCrease(): unknown face "${faceId}"`)
  const idx = SIDE_INDEX[side]
  if (face.edges[idx].kind === 'crease') {
    throw new Error(`Face "${faceId}" already has a crease on its ${side} side`)
  }
  face.edges[idx] = { ...face.edges[idx], kind: 'crease', hinge, foldAngle: DEFAULT_FOLD }
}

/**
 * Build a flap hanging off one side of parent box `p`.
 * The hinge edge always spans the parent's full extent; `taper` insets
 * only the far edge. Corners (clockwise, y-down):
 *   top-attached:    F0 → F1 (far) → H1 (diag) → H0 (hinge) → F0 (diag)
 *   bottom-attached: H0 → H1 (hinge) → F1 (diag) → F0 (far) → H0 (diag)
 *   left-attached:   F0 → H0 (diag) → H1 (hinge) → F1 (diag) → F0 (far)
 *   right-attached:  H0 → F0 (diag) → F1 (far) → H1 (diag) → H0 (hinge)
 */
function makeFlap(spec: FlapSpec, side: Side, p: Box, parentId: FaceId): { face: Face; box: Box } {
  const { id, depth, taper = 0, edgeKind = 'cut' } = spec
  const hinge = (to: Pt): Edge => ({ kind: 'crease', hinge: parentId, foldAngle: DEFAULT_FOLD, to })
  const c = (to: Pt): Edge => ({ kind: edgeKind, to })
  const extent = side === 'top' || side === 'bottom' ? p.x1 - p.x0 : p.y1 - p.y0
  if (2 * taper >= extent) {
    throw new Error(
      `flap(): "${id}" taper ${taper} on hinge extent ${extent}: 2×taper must be < extent`,
    )
  }
  switch (side) {
    case 'top': {
      const y = p.y0 - depth
      const box: Box = { x0: p.x0 + taper, y0: y, x1: p.x1 - taper, y1: p.y0 }
      return {
        box,
        face: {
          id,
          origin: { x: box.x0, y },
          edges: [
            c({ x: box.x1, y }),
            c({ x: p.x1, y: p.y0 }),
            hinge({ x: p.x0, y: p.y0 }),
            c({ x: box.x0, y }),
          ],
        },
      }
    }
    case 'bottom': {
      const y = p.y1 + depth
      const box: Box = { x0: p.x0 + taper, y0: p.y1, x1: p.x1 - taper, y1: y }
      return {
        box,
        face: {
          id,
          origin: { x: p.x0, y: p.y1 },
          edges: [
            hinge({ x: p.x1, y: p.y1 }),
            c({ x: p.x1 - taper, y }),
            c({ x: p.x0 + taper, y }),
            c({ x: p.x0, y: p.y1 }),
          ],
        },
      }
    }
    case 'left': {
      const x = p.x0 - depth
      const box: Box = { x0: x, y0: p.y0 + taper, x1: p.x0, y1: p.y1 - taper }
      return {
        box,
        face: {
          id,
          origin: { x, y: box.y0 },
          edges: [
            c({ x: p.x0, y: p.y0 }),
            hinge({ x: p.x0, y: p.y1 }),
            c({ x, y: box.y1 }),
            c({ x, y: box.y0 }),
          ],
        },
      }
    }
    case 'right': {
      const x = p.x1 + depth
      const box: Box = { x0: p.x1, y0: p.y0 + taper, x1: x, y1: p.y1 - taper }
      return {
        box,
        face: {
          id,
          origin: { x: p.x1, y: p.y0 },
          edges: [
            c({ x, y: box.y0 }),
            c({ x, y: box.y1 }),
            c({ x: p.x1, y: p.y1 }),
            hinge({ x: p.x1, y: p.y0 }),
          ],
        },
      }
    }
  }
}

function assertUniqueIds(ids: FaceId[]): void {
  const seen = new Set<FaceId>()
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate face id: "${id}"`)
    seen.add(id)
  }
}

function validateHoles(faceId: FaceId, box: Box, holes: Hole[]): void {
  const bw = box.x1 - box.x0
  const bh = box.y1 - box.y0
  for (const h of holes) {
    if (h.w <= 0 || h.h <= 0) throw new Error(`holes(): "${faceId}" non-positive hole size`)
    if (h.x < -EPS || h.y < -EPS || h.x + h.w > bw + EPS || h.y + h.h > bh + EPS) {
      throw new Error(
        `holes(): "${faceId}" hole (${h.x},${h.y}) ${h.w}×${h.h} outside face ${bw}×${bh}`,
      )
    }
    for (const o of holes) {
      if (o === h) continue
      const overlap = !(
        h.x + h.w <= o.x + EPS || o.x + o.w <= h.x + EPS ||
        h.y + h.h <= o.y + EPS || o.y + o.h <= h.y + EPS
      )
      if (overlap) throw new Error(`holes(): "${faceId}" overlapping holes`)
    }
  }
}

export class StripBuilder {
  private readonly panels: PanelSpec[]
  private readonly attachments: Attachment[] = []

  constructor(panels: PanelSpec[]) {
    if (panels.length === 0) throw new Error('row(): needs at least one panel')
    const h = panels[0].h
    if (panels.some((p) => Math.abs(p.h - h) > 1e-9)) {
      throw new Error('row(): all panels must have the same height')
    }
    this.panels = panels
  }

  attach(parentId: FaceId, side: Side, spec: FlapSpec): this {
    this.attachments.push({ parentId, side, spec })
    return this
  }
  attachTop(parentId: FaceId, spec: FlapSpec): this {
    return this.attach(parentId, 'top', spec)
  }
  attachBottom(parentId: FaceId, spec: FlapSpec): this {
    return this.attach(parentId, 'bottom', spec)
  }
  attachLeft(parentId: FaceId, spec: FlapSpec): this {
    return this.attach(parentId, 'left', spec)
  }
  attachRight(parentId: FaceId, spec: FlapSpec): this {
    return this.attach(parentId, 'right', spec)
  }

  build(): Face[] {
    assertUniqueIds([...this.panels.map((p) => p.id), ...this.attachments.map((a) => a.spec.id)])

    const faces = new Map<FaceId, Face>()
    const boxes = new Map<FaceId, Box>()
    const flapInfo = new Map<FaceId, { farSide: Side; taper: number }>()

    // 1. Lay the row left to right, top-aligned at y = 0.
    let x = 0
    for (const p of this.panels) {
      const box: Box = { x0: x, y0: 0, x1: x + p.w, y1: p.h }
      faces.set(p.id, rectFace(p.id, box))
      boxes.set(p.id, box)
      x += p.w
    }

    // 2. Reciprocal creases between neighbours.
    for (let i = 0; i < this.panels.length - 1; i++) {
      const a = this.panels[i].id
      const b = this.panels[i + 1].id
      setCrease(faces, a, 'right', b)
      setCrease(faces, b, 'left', a)
    }

    // 3. Attach flaps in declaration order (enables flap-on-flap).
    for (const att of this.attachments) {
      const parentBox = boxes.get(att.parentId)
      if (!parentBox) throw new Error(`attach(): unknown parent face "${att.parentId}"`)

      const parentFlap = flapInfo.get(att.parentId)
      if (parentFlap && parentFlap.taper > 0 && att.side !== parentFlap.farSide) {
        throw new Error(
          `attach(): cannot attach to the "${att.side}" side of tapered flap "${att.parentId}" — attach to its far side`,
        )
      }

      const { face, box } = makeFlap(att.spec, att.side, parentBox, att.parentId)
      faces.set(att.spec.id, face)
      boxes.set(att.spec.id, box)
      flapInfo.set(att.spec.id, { farSide: att.side, taper: att.spec.taper ?? 0 })
      setCrease(faces, att.parentId, att.side, att.spec.id)

      if (att.spec.holes?.length) {
        validateHoles(att.spec.id, box, att.spec.holes)
        face.holes = att.spec.holes.map((h) => ({
          x: box.x0 + h.x - face.origin.x,
          y: box.y0 + h.y - face.origin.y,
          w: h.w,
          h: h.h,
        }))
      }
    }

    return [...faces.values()]
  }
}

export function row(panels: PanelSpec[]): StripBuilder {
  return new StripBuilder(panels)
}

export function panel(id: FaceId, w: number, h: number): PanelSpec {
  return { id, w, h }
}

export function flap(
  id: FaceId,
  depth: number,
  opts: { taper?: number; edgeKind?: 'cut' | 'glue'; holes?: Hole[] } = {},
): FlapSpec {
  return { id, depth, taper: opts.taper, edgeKind: opts.edgeKind, holes: opts.holes }
}
