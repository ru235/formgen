import { segments } from '../../engine/geometry.ts'
import type { Dieline, EdgeKind, Face, Pt } from '../../engine/types.ts'

export type LayerStyle = { color: string; dash: string; width: number }

export const LAYER_STYLE: Record<EdgeKind, LayerStyle> = {
  cut: { color: '#e11d48', dash: 'none', width: 0.5 },
  crease: { color: '#2563eb', dash: '6 3', width: 0.35 },
  perf: { color: '#059669', dash: '2 2', width: 0.35 },
  glue: { color: '#d97706', dash: '4 2', width: 0.4 },
}

export const KIND_LABEL: Record<EdgeKind, string> = {
  cut: 'Рез (нож)',
  crease: 'Биговка (сгиб)',
  perf: 'Перфорация',
  glue: 'Клеевой нож',
}

/** A crease is a joint: it appears in both adjacent faces' loops but is one
 *  physical line. Emit it once, keyed by its unordered face pair + geometry. */
function creaseKey(a: string, b: string, from: Pt, to: Pt): string {
  const [f, t] = a < b ? [from, to] : [to, from]
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return `${lo}|${hi}|${f.x.toFixed(3)},${f.y.toFixed(3)}|${t.x.toFixed(3)},${t.y.toFixed(3)}`
}

export type SvgEdge = { kind: EdgeKind; from: Pt; to: Pt }

/** Flatten a dieline to deduplicated edge list, in layer order. */
export function collectEdges(d: Dieline): SvgEdge[] {
  const out: SvgEdge[] = []
  const seenCrease = new Set<string>()
  for (const layer of d.layers) {
    for (const face of layer.faces) {
      for (const s of segments(face)) {
        if (s.edge.kind === 'crease') {
          const key = creaseKey(face.id, s.edge.hinge ?? '', s.from, s.to)
          if (seenCrease.has(key)) continue
          seenCrease.add(key)
        }
        out.push({ kind: s.edge.kind, from: s.from, to: s.to })
      }
      // Holes are cut (slots / notches)
      for (const h of face.holes ?? []) {
        const x0 = face.origin.x + h.x
        const y0 = face.origin.y + h.y
        const x1 = x0 + h.w
        const y1 = y0 + h.h
        out.push({ kind: 'cut', from: { x: x0, y: y0 }, to: { x: x1, y: y0 } })
        out.push({ kind: 'cut', from: { x: x1, y: y0 }, to: { x: x1, y: y1 } })
        out.push({ kind: 'cut', from: { x: x1, y: y1 }, to: { x: x0, y: y1 } })
        out.push({ kind: 'cut', from: { x: x0, y: y1 }, to: { x: x0, y: y0 } })
      }
    }
  }
  return out
}

/** Face polygons (for a subtle paper fill behind the lines). */
export function facePolygons(d: Dieline): Pt[][] {
  return d.layers.flatMap((l) => l.faces.map((f: Face) => [f.origin, ...f.edges.map((e) => e.to)]))
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Build an SVG string. Coordinates are in mm, y-down (same as the engine),
 * so the drawing is 1:1 when opened in a CAD tool or printed at 100%.
 * `forPrint` drops labels and adds mm sizing; otherwise it's screen preview.
 */
export function renderSvg(d: Dieline, opts: { margin?: number; forPrint?: boolean } = {}): string {
  const margin = opts.margin ?? 12
  const forPrint = opts.forPrint ?? false
  const { x, y, w, h } = d.bbox
  const totalW = w + margin * 2
  const totalH = h + margin * 2
  const edges = collectEdges(d)
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}mm" height="${totalH}mm" ` +
      `viewBox="${x - margin} ${y - margin} ${totalW} ${totalH}" ` +
      `data-unit="mm" data-scale="1:1">`,
  )
  parts.push(
    `<rect x="${x - margin}" y="${y - margin}" width="${totalW}" height="${totalH}" fill="#ffffff"/>`,
  )

  // paper fill
  for (const poly of facePolygons(d)) {
    const pts = poly.map((p) => `${p.x},${p.y}`).join(' ')
    parts.push(`<polygon points="${pts}" fill="#f8fafc" stroke="none"/>`)
  }

  // edges grouped by kind for clean CSS toggling
  const kinds: EdgeKind[] = ['cut', 'crease', 'perf', 'glue']
  for (const kind of kinds) {
    const st = LAYER_STYLE[kind]
    const lines = edges.filter((e) => e.kind === kind)
    if (!lines.length) continue
    parts.push(`<g data-layer="${kind}" stroke="${st.color}" stroke-width="${st.width}" fill="none"`)
    if (st.dash !== 'none') parts.push(` stroke-dasharray="${st.dash}"`)
    parts.push(` stroke-linecap="round">`)
    for (const e of lines) {
      parts.push(`<line x1="${e.from.x}" y1="${e.from.y}" x2="${e.to.x}" y2="${e.to.y}"/>`)
    }
    parts.push('</g>')
  }

  if (!forPrint) {
    // Inner dimension annotations for the three axes.
    parts.push(`<g data-layer="labels" fill="#0f172a" font-family="system-ui,sans-serif" font-size="11">`)
    parts.push(
      `<text x="${x + w / 2}" y="${y - 4}" text-anchor="middle">L = ${round(d.sizes.inner.l)} мм</text>`,
    )
    parts.push(
      `<text x="${x - 4}" y="${y + h / 2}" text-anchor="end" transform="rotate(-90 ${x - 4} ${y + h / 2})">B = ${round(d.sizes.inner.w)} мм</text>`,
    )
    parts.push(
      `<text x="${x - 4}" y="${y + 3}" text-anchor="end">H = ${round(d.sizes.inner.h)} мм</text>`,
    )
    parts.push(
      `<text x="${x + w / 2}" y="${y + h + 14}" text-anchor="middle" fill="#475569">Разворот ${round(w)} × ${round(h)} мм</text>`,
    )
    parts.push('</g>')
  }

  parts.push('</svg>')
  return parts.join('\n')
}

const round = (n: number) => Math.round(n * 100) / 100