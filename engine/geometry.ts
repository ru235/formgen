import type { Face, Measure, Pt, Rect } from './types.ts'

export const EPS = 1e-6

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Directed segments of a face's closed boundary loop. */
export function segments(face: Face): { from: Pt; to: Pt; edge: Face['edges'][number] }[] {
  return face.edges.map((e, i) => ({
    from: i === 0 ? face.origin : face.edges[i - 1].to,
    to: e.to,
    edge: e,
  }))
}

export function facesBbox(faces: Face[]): Rect {
  if (faces.length === 0) throw new Error('facesBbox(): no faces')
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const f of faces) {
    for (const p of [f.origin, ...f.edges.map((e) => e.to)]) {
      if (p.x < x0) x0 = p.x
      if (p.y < y0) y0 = p.y
      if (p.x > x1) x1 = p.x
      if (p.y > y1) y1 = p.y
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Translate faces so the bounding box starts at (0, 0). */
export function normaliseFaces(faces: Face[]): Face[] {
  const bb = facesBbox(faces)
  return faces.map((f) => ({
    ...f,
    origin: { x: f.origin.x - bb.x, y: f.origin.y - bb.y },
    edges: f.edges.map((e) => ({ ...e, to: { x: e.to.x - bb.x, y: e.to.y - bb.y } })),
  }))
}

/**
 * Linear length per edge kind (mm) — the pricing input.
 * Hole perimeters count as cut (slots/notches are cut by the die).
 * A crease is a joint shared by two faces and appears in both
 * boundary loops, but it is one line in the drawing and one
 * bending rule in the die — so each joint is counted once
 * (from the lexicographically smaller face id).
 */
export function measure(faces: Face[]): Measure {
  const m: Measure = { cut: 0, crease: 0, perf: 0, glue: 0 }
  for (const f of faces) {
    for (const s of segments(f)) {
      if (s.edge.kind === 'crease') {
        if (!s.edge.hinge || f.id < s.edge.hinge) {
          m.crease += dist(s.from, s.to)
        }
      } else {
        m[s.edge.kind] += dist(s.from, s.to)
      }
    }
    for (const h of f.holes ?? []) {
      m.cut += 2 * (h.w + h.h)
    }
  }
  return m
}

/** Number of unique crease joints (bending lines in the drawing). */
export function creaseCount(faces: Face[]): number {
  let n = 0
  for (const f of faces) {
    for (const e of f.edges) {
      if (e.kind === 'crease' && (!e.hinge || f.id < e.hinge)) n++
    }
  }
  return n
}

export function faceById(faces: Face[], id: string): Face | undefined {
  return faces.find((f) => f.id === id)
}
