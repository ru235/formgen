import { EPS, segments } from './geometry.ts'
import type { Face, FaceId, Layer } from './types.ts'

function samePt(a: Pt, b: Pt): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
}

type Pt = { x: number; y: number }

/** Every face loop must be closed: last edge `to` equals `origin`. */
export function checkClosed(faces: Face[]): void {
  for (const f of faces) {
    const last = f.edges[f.edges.length - 1]
    if (!last || !samePt(last.to, f.origin)) {
      throw new Error(`invariant: face "${f.id}" loop is not closed`)
    }
  }
}

/** Every crease must be reciprocated by the hinge face. */
export function checkReciprocalCreases(faces: Face[]): void {
  const byId = new Map(faces.map((f) => [f.id, f]))
  for (const f of faces) {
    for (const s of segments(f)) {
      if (s.edge.kind !== 'crease') continue
      if (!s.edge.hinge) {
        throw new Error(`invariant: crease on "${f.id}" has no hinge`)
      }
      const other = byId.get(s.edge.hinge)
      if (!other) {
        throw new Error(
          `invariant: crease on "${f.id}" hinges to unknown face "${s.edge.hinge}"`,
        )
      }
      const match = segments(other).find(
        (os) =>
          os.edge.kind === 'crease' &&
          os.edge.hinge === f.id &&
          samePt(os.from, s.to) &&
          samePt(os.to, s.from),
      )
      if (!match) {
        throw new Error(
          `invariant: crease between "${f.id}" and "${other.id}" is not reciprocal`,
        )
      }
    }
  }
}

/** All faces must be reachable from the fold root via creases. */
export function checkConnectivity(faces: Face[], foldRoot: FaceId): void {
  const byId = new Map(faces.map((f) => [f.id, f]))
  if (!byId.has(foldRoot)) throw new Error(`invariant: fold root "${foldRoot}" not found`)
  const seen = new Set<FaceId>([foldRoot])
  const queue: FaceId[] = [foldRoot]
  while (queue.length) {
    const id = queue.pop()!
    const f = byId.get(id)!
    for (const s of segments(f)) {
      if (s.edge.kind === 'crease' && s.edge.hinge && !seen.has(s.edge.hinge)) {
        seen.add(s.edge.hinge)
        queue.push(s.edge.hinge)
      }
    }
  }
  const missing = faces.filter((f) => !seen.has(f.id)).map((f) => f.id)
  if (missing.length) {
    throw new Error(`invariant: faces unreachable from fold root: ${missing.join(', ')}`)
  }
}

/** Holes must lie within their face (face-local coords). */
export function checkHoles(faces: Face[]): void {
  for (const f of faces) {
    const pts = [f.origin, ...f.edges.map((e) => e.to)].map((p) => ({
      x: p.x - f.origin.x,
      y: p.y - f.origin.y,
    }))
    const x0 = Math.min(...pts.map((p) => p.x))
    const y0 = Math.min(...pts.map((p) => p.y))
    const x1 = Math.max(...pts.map((p) => p.x))
    const y1 = Math.max(...pts.map((p) => p.y))
    for (const h of f.holes ?? []) {
      if (h.x < x0 - EPS || h.y < y0 - EPS || h.x + h.w > x1 + EPS || h.y + h.h > y1 + EPS) {
        throw new Error(`invariant: hole on "${f.id}" extends outside the face`)
      }
    }
  }
}

export function checkInvariants(layer: Layer): void {
  checkClosed(layer.faces)
  checkReciprocalCreases(layer.faces)
  checkConnectivity(layer.faces, layer.foldRoot)
  checkHoles(layer.faces)
}
