import { collectEdges } from './render-svg.ts'
import type { Dieline } from '../../engine/types.ts'

/**
 * DXF R12 (AC1009) with four layers, one per edge kind, 1:1 in millimetres.
 * Pure geometry: no kerf compensation, no text — the bureau's CAM imports it
 * directly. DXF Y axis points up, the engine's down, so we flip.
 */

const LAYER_COLOR: Record<string, number> = {
  CUT: 1, // red
  CREASE: 5, // blue
  PERF: 3, // green
  GLUE: 2, // yellow
}

const KIND_TO_LAYER: Record<string, string> = {
  cut: 'CUT',
  crease: 'CREASE',
  perf: 'PERF',
  glue: 'GLUE',
}

type Group = { code: number; value: string | number }[]
const g = (code: number, value: string | number): Group => ({ code, value } as any)

function dxf(groups: Group[]): string {
  let out = ''
  for (const gr of groups) out += `${gr.code}\n${gr.value}\n`
  return out
}

export function renderDxf(d: Dieline): string {
  const s: Group[] = []

  // ---- HEADER ----
  s.push(
    g(0, 'SECTION'), g(2, 'HEADER'),
    g(9, '$ACADVER'), g(1, 'AC1009'),
    g(9, '$INSUNITS'), g(70, 4), // millimetres
    g(9, '$MEASUREMENT'), g(70, 1), // metric
    g(9, '$EXTMIN'), g(10, d.bbox.x), g(20, d.bbox.y), g(30, 0),
    g(9, '$EXTMAX'), g(10, d.bbox.x + d.bbox.w), g(20, d.bbox.y + d.bbox.h), g(30, 0),
    g(0, 'ENDSEC'),
  )

  // ---- TABLES: LTYPE, LAYER, STYLE ----
  s.push(
    g(0, 'SECTION'), g(2, 'TABLES'),
    // LTYPE table
    g(0, 'TABLE'), g(2, 'LTYPE'), g(70, 1),
    g(0, 'LTYPE'), g(2, 'CONTINUOUS'), g(70, 0), g(3, 'Solid line'), g(72, 65),
    g(73, 0), g(40, 0),
    g(0, 'ENDTAB'),
    // LAYER table
    g(0, 'TABLE'), g(2, 'LAYER'), g(70, Object.keys(LAYER_COLOR).length),
  )
  for (const [name, color] of Object.entries(LAYER_COLOR)) {
    s.push(g(0, 'LAYER'), g(2, name), g(70, 0), g(62, color), g(6, 'CONTINUOUS'))
  }
  s.push(
    g(0, 'ENDTAB'),
    // STYLE table (required by most importers)
    g(0, 'TABLE'), g(2, 'STYLE'), g(70, 1),
    g(0, 'STYLE'), g(2, 'STANDARD'), g(70, 0), g(40, 0), g(41, 1), g(50, 0),
    g(71, 0), g(42, 2.5), g(3, 'txt'), g(4, ''),
    g(0, 'ENDTAB'),
    g(0, 'ENDSEC'),
  )

  // ---- ENTITIES ----
  s.push(g(0, 'SECTION'), g(2, 'ENTITIES'))
  const flip = (y: number) => -(y)
  for (const e of collectEdges(d)) {
    const layer = KIND_TO_LAYER[e.kind]
    s.push(
      g(0, 'LINE'),
      g(8, layer),
      g(10, e.from.x.toFixed(4)), g(20, flip(e.from.y).toFixed(4)), g(30, '0'),
      g(11, e.to.x.toFixed(4)), g(21, flip(e.to.y).toFixed(4)), g(31, '0'),
    )
  }
  s.push(g(0, 'ENDSEC'), g(0, 'EOF'))

  return dxf(s)
}