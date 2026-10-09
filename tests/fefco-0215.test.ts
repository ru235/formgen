import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate, measureDieline } from '../engine/index.ts'
import { creaseCount } from '../engine/geometry.ts'
import { fefco0215 } from '../engine/styles/fefco-0215.ts'

const V = fefco0215.testVector!
const vectorParams = {
  ...V.input,
  sizeMode: 'inner' as const,
  thickness: V.thickness,
  materialId: 'flute-b',
}

test('0215: generates 13 faces and 12 creases', () => {
  const d = generate('fefco-0215', vectorParams)
  assert.equal(d.layers[0].faces.length, V.expectFaces)
  assert.equal(creaseCount(d.layers[0].faces), 12)
})

test('0215: four snap-bottom slots opening at the flap tips', () => {
  const d = generate('fefco-0215', vectorParams)
  const holes = d.layers[0].faces.flatMap((f) => f.holes ?? [])
  assert.equal(holes.length, 4)
  // notch depth = max(4T, 10) = 12 mm at T=3; half flap = manufacture H/2 = 76.5
  for (const h of holes) assert.ok(h.h >= 10)
})

test('0215: glue tab priced as glue knife', () => {
  const d = generate('fefco-0215', vectorParams)
  const m = measureDieline(d)
  // glue tab free edges: 2 × width (20) + manufacture H (153)
  assert.ok(Math.abs(m.glue - (20 + 20 + 153)) < 1e-6)
})

test('0215: inner → manufacture (+T) and outer (+2T)', () => {
  const d = generate('fefco-0215', vectorParams)
  assert.ok(Math.abs(d.sizes.manufacture.l - (V.input.l + 3)) < 1e-9)
  assert.ok(Math.abs(d.sizes.outer.l - (V.input.l + 6)) < 1e-9)
})

test('0215: defaults produce no warnings', () => {
  const d = generate('fefco-0215', {
    l: 300, w: 200, h: 150,
    sizeMode: 'inner', thickness: 3, materialId: 'flute-b',
  })
  assert.deepEqual(d.warnings, [])
})
