import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate } from '../engine/index.ts'
import { renderSvg, collectEdges } from '../web/src/render-svg.ts'
import { renderDxf } from '../web/src/export-dxf.ts'
import { renderPdf } from '../web/src/export-pdf.ts'
import { STYLES } from '../engine/styles/index.ts'

const EXPECT_CREASES: Record<string, number> = { 'fefco-0427': 20, 'fefco-0215': 12 }

for (const style of STYLES) {
  test(`${style.id}: SVG / DXF / PDF render without error`, () => {
    const d = generate(style.id, {
      l: style.defaults.l,
      w: style.defaults.w,
      h: style.defaults.h,
      sizeMode: 'inner',
      thickness: 1.5,
      materialId: style.defaultMaterialId,
    })

    // SVG
    const svg = renderSvg(d)
    assert.ok(svg.startsWith('<svg'), 'svg opens')
    assert.ok(svg.includes('data-unit="mm"') && svg.includes('data-scale="1:1"'), 'svg is 1:1 mm')
    assert.ok(svg.includes('data-layer="cut"') && svg.includes('data-layer="crease"'), 'has layers')

    // creases deduplicated: one physical line per joint
    const edges = collectEdges(d)
    const creaseEdges = edges.filter((e) => e.kind === 'crease')
    assert.equal(creaseEdges.length, EXPECT_CREASES[style.id], 'unique crease lines')
    assert.ok(edges.filter((e) => e.kind === 'cut').length > 0, 'has cut lines')

    // DXF R12
    const dxf = renderDxf(d)
    assert.ok(dxf.startsWith('0\nSECTION'), 'dxf header')
    assert.ok(dxf.includes('AC1009'), 'dxf R12 version')
    assert.ok(dxf.includes('$INSUNITS'), 'dxf has INSUNITS')
    for (const layer of ['CUT', 'CREASE', 'PERF', 'GLUE']) {
      assert.ok(dxf.includes(`\n2\n${layer}\n`), `dxf declares layer ${layer}`)
    }
    assert.ok(dxf.trimEnd().endsWith('EOF'), 'dxf ends with EOF')
    const lineCount = (dxf.match(/\n0\nLINE\n/g) || []).length
    assert.equal(lineCount, edges.length, 'one DXF LINE per collected edge')

    // PDF 1:1
    const pdf = renderPdf(d)
    const head = new TextDecoder('latin1').decode(pdf.slice(0, 8))
    assert.ok(head.startsWith('%PDF-1.4'), 'pdf header')
    const tail = new TextDecoder('latin1').decode(pdf.slice(-64))
    assert.ok(tail.includes('%%EOF'), 'pdf trailer')
    const txt = new TextDecoder('latin1').decode(pdf)
    const mb = txt.match(/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)
    assert.ok(mb, 'pdf has MediaBox')
    const expectedW = (d.bbox.w + 24) * (72 / 25.4)
    assert.ok(Math.abs(parseFloat(mb![1]) - expectedW) < 0.5, 'pdf width is 1:1 mm')
  })
}

test('0427 vector: exports for the published reference size', () => {
  const d = generate('fefco-0427', {
    l: 254, w: 254, h: 102, sizeMode: 'inner', thickness: 1.5, materialId: 'micro-e',
  })
  assert.ok(renderSvg(d).length > 1000)
  assert.ok(renderDxf(d).length > 1000)
  assert.ok(renderPdf(d).length > 500)
})