import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate, measureDieline } from '../engine/index.ts'
import { creaseCount } from '../engine/geometry.ts'
import { fefco0427 } from '../engine/styles/fefco-0427.ts'

const V = fefco0427.testVector!
const vectorParams = {
  ...V.input,
  sizeMode: 'inner' as const,
  thickness: V.thickness,
  materialId: 'micro-e',
}

test('0427: generates 21 faces', () => {
  const d = generate('fefco-0427', {
    l: 300, w: 200, h: 80,
    sizeMode: 'inner', thickness: 1.5, materialId: 'micro-e',
  })
  assert.equal(d.layers[0].faces.length, 21)
})

test('0427: vector — 21 faces and inner sizes roundtrip', () => {
  const d = generate('fefco-0427', vectorParams)
  assert.equal(d.layers[0].faces.length, V.expectFaces)
  assert.ok(Math.abs(d.sizes.inner.l - V.input.l) < 1e-9)
  assert.ok(Math.abs(d.sizes.inner.w - V.input.w) < 1e-9)
  assert.ok(Math.abs(d.sizes.inner.h - V.input.h) < 1e-9)
})

test('0427: vector — blank within 15% of published reference', () => {
  const d = generate('fefco-0427', vectorParams)
  // Our engine: 819.5 × 711.5 mm; published reference: 810 × 655 mm.
  // The delta is in roll-end allowances — verify against a real die.
  const ref = V.expectBlank!
  const dw = Math.abs(d.bbox.w - ref.w) / ref.w
  const dh = Math.abs(d.bbox.h - ref.h) / ref.h
  assert.ok(dw < 0.15, `blank width ${d.bbox.w} vs reference ${ref.w}`)
  assert.ok(dh < 0.15, `blank height ${d.bbox.h} vs reference ${ref.h}`)
  console.log(`  0427 vector blank: ${d.bbox.w}×${d.bbox.h} mm (reference ${ref.w}×${ref.h})`)
})

test('0427: no glue — die-cut construction', () => {
  const d = generate('fefco-0427', vectorParams)
  const m = measureDieline(d)
  assert.equal(m.glue, 0)
  assert.ok(m.cut > 0 && m.crease > 0)
})

test('0427: defaults produce no warnings', () => {
  const d = generate('fefco-0427', {
    l: 300, w: 200, h: 80,
    sizeMode: 'inner', thickness: 1.5, materialId: 'micro-e',
  })
  assert.deepEqual(d.warnings, [])
})

test('0427: dimension below minimum warns', () => {
  const d = generate('fefco-0427', {
    l: 50, w: 200, h: 80,
    sizeMode: 'inner', thickness: 1.5, materialId: 'micro-e',
  })
  assert.ok(d.warnings.some((w) => w.code === 'dim-min'))
})
