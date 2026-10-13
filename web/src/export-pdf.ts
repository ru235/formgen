import { collectEdges } from './render-svg.ts'
import type { Dieline } from '../../engine/types.ts'

/**
 * Minimal vector PDF writer — no dependencies.
 *
 * The page box is the blank size plus a margin, converted from millimetres to
 * PostScript points, and content is drawn through a `cm` scale so 1 unit = 1 mm:
 * the file is true 1:1 on any plotter. No kerf compensation, no raster.
 * Labels are ASCII only (WinAnsi) — Cyrillic needs an embedded font.
 */

const MM = 72 / 25.4 // mm → pt
const P = (v: number) => (Math.round(v * 1000) / 1000).toString()

class Pdf {
  private objs: (string | { dict: string; stream: string })[] = []
  add(o: string | { dict: string; stream: string }): number {
    this.objs.push(o)
    return this.objs.length // object numbers are 1-based
  }
  build(): Uint8Array {
    const enc = new TextEncoder()
    const chunks: Uint8Array[] = []
    let len = 0
    const push = (s: string) => {
      const b = enc.encode(s)
      chunks.push(b)
      len += b.length
    }
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
    const offsets: number[] = []
    this.objs.forEach((o, i) => {
      offsets.push(len)
      const body = typeof o === 'string' ? o : `${o.dict}\nstream\n${o.stream}\nendstream`
      push(`${i + 1} 0 obj\n${body}\nendobj\n`)
    })
    const xref = len
    let t = `xref\n0 ${this.objs.length + 1}\n0000000000 65535 f \n`
    for (const off of offsets) t += `${String(off).padStart(10, '0')} 00000 n \n`
    t += `trailer\n<< /Size ${this.objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    push(t)
    const total = chunks.reduce((a, c) => a + c.length, 0)
    const out = new Uint8Array(total)
    let p = 0
    for (const c of chunks) { out.set(c, p); p += c.length }
    return out
  }
}

const GROUPS: { kind: string; rgb: [number, number, number]; w: number; dash: number[] }[] = [
  { kind: 'cut', rgb: [0.85, 0.11, 0.28], w: 0.4, dash: [] },
  { kind: 'crease', rgb: [0.15, 0.39, 0.92], w: 0.3, dash: [2, 1.5] },
  { kind: 'perf', rgb: [0.02, 0.59, 0.41], w: 0.3, dash: [0.7, 0.7] },
  { kind: 'glue', rgb: [0.85, 0.47, 0.02], w: 0.35, dash: [1.5, 1] },
]

export function renderPdf(d: Dieline): Uint8Array {
  const pdf = new Pdf()
  const m = 12 // margin, mm
  const boxW = d.bbox.w + m * 2
  const boxH = d.bbox.h + m * 2
  const ox = d.bbox.x - m
  const oy = d.bbox.y - m
  // engine y grows down, PDF y grows up
  const fy = (y: number) => boxH - (y - oy)

  let cs = `${P(MM)} 0 0 ${P(MM)} 0 0 cm\n` // user space in millimetres
  cs += '1 J 1 j\n'
  const edges = collectEdges(d)
  for (const g of GROUPS) {
    const list = edges.filter((e) => e.kind === g.kind)
    if (!list.length) continue
    cs += `${P(g.rgb[0])} ${P(g.rgb[1])} ${P(g.rgb[2])} RG\n${P(g.w)} w\n`
    cs += g.dash.length ? `[${g.dash.map(P).join(' ')}] 0 d\n` : '[] 0 d\n'
    for (const e of list) {
      cs += `${P(e.from.x - ox)} ${P(fy(e.from.y))} m ${P(e.to.x - ox)} ${P(fy(e.to.y))} l S\n`
    }
  }

  // ASCII labels: blank size and inner dimensions
  cs += '0 0 0 rg\nBT /F1 9 Tf\n'
  const label = (x: number, y: number, txt: string, size = 9) => {
    cs += `/F1 ${size} Tf ${P(x - ox)} ${P(fy(y))} Td (${txt}) Tj\n`
  }
  const bb = d.bbox
  label(bb.x + bb.w / 2 - 22, bb.y - 5, `L ${P(d.sizes.inner.l)}  B ${P(d.sizes.inner.w)}  H ${P(d.sizes.inner.h)} mm`)
  label(bb.x + bb.w / 2 - 24, bb.y + bb.h + 8, `Blank ${P(bb.w)} x ${P(bb.h)} mm  (1:1)`)
  cs += 'ET\n'

  pdf.add('<< /Type /Catalog /Pages 2 0 R >>') // 1
  pdf.add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>') // 2
  pdf.add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${P(boxW * MM)} ${P(boxH * MM)}] ` +
      `/Resources << /Font << /F1 5 0 R >> /ProcSet [/PDF] >> /Contents 4 0 R >>`,
  ) // 3
  pdf.add({ dict: `<< /Length ${cs.length} >>`, stream: cs }) // 4
  pdf.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>') // 5

  return pdf.build()
}