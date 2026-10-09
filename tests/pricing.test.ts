import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate, measureDieline } from '../engine/index.ts'
import { priceDie } from '../engine/pricing.ts'
import { fefco0427 } from '../engine/styles/fefco-0427.ts'
import { fefco0215 } from '../engine/styles/fefco-0215.ts'

test('priceDie: 2pt tariff up to 2 mm, 3pt above', () => {
  const m = { cut: 1000, crease: 500, perf: 0, glue: 200 } // mm
  // 2pt: (1500/1000)×1600 + (200/1000)×500 = 2400 + 100 = 2500
  assert.equal(priceDie(m, 1.5), 2500)
  // 3pt: (1500/1000)×1700 + 100 = 2550 + 100 = 2650
  assert.equal(priceDie(m, 3), 2650)
})

test('0427 vector: measure and price at micro-flute (2pt)', () => {
  const v = fefco0427.testVector!
  const d = generate('fefco-0427', {
    ...v.input, sizeMode: 'inner', thickness: v.thickness, materialId: 'micro-e',
  })
  const m = measureDieline(d)
  const price = priceDie(m, v.thickness)
  console.log(`  0427 vector: cut ${(m.cut / 1000).toFixed(3)} м, crease ${(m.crease / 1000).toFixed(3)} м, glue ${(m.glue / 1000).toFixed(3)} м → ${price} ₽`)
  assert.ok(price > 0)
  assert.equal(m.perf, 0)
})

test('0215 vector: measure and price at flute B (3pt)', () => {
  const v = fefco0215.testVector!
  const d = generate('fefco-0215', {
    ...v.input, sizeMode: 'inner', thickness: v.thickness, materialId: 'flute-b',
  })
  const m = measureDieline(d)
  const price = priceDie(m, v.thickness)
  console.log(`  0215 vector: cut ${(m.cut / 1000).toFixed(3)} м, crease ${(m.crease / 1000).toFixed(3)} м, glue ${(m.glue / 1000).toFixed(3)} м → ${price} ₽`)
  assert.ok(price > 0)
  assert.ok(m.glue > 0) // glue tab
})

test('price is identical whether computed from drawing or measure', () => {
  // The pricing input comes from the same graph as the drawing —
  // this test documents the single-source-of-truth property.
  const d = generate('fefco-0427', {
    l: 300, w: 200, h: 80,
    sizeMode: 'inner', thickness: 1.5, materialId: 'micro-e',
  })
  const m = measureDieline(d)
  const expected = Math.round(
    ((m.cut + m.crease) / 1000) * 1600 + ((m.perf + m.glue) / 1000) * 500,
  )
  assert.equal(priceDie(m, 1.5), expected)
})
