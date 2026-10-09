import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate } from '../engine/index.ts'
import { checkInvariants } from '../engine/invariants.ts'

test('invariants hold for 0427 at defaults', () => {
  const d = generate('fefco-0427', {
    l: 300, w: 200, h: 80,
    sizeMode: 'inner', thickness: 1.5, materialId: 'micro-e',
  })
  checkInvariants(d.layers[0]) // must not throw
})

test('invariants hold for 0215 at defaults', () => {
  const d = generate('fefco-0215', {
    l: 300, w: 200, h: 150,
    sizeMode: 'inner', thickness: 3, materialId: 'flute-b',
  })
  checkInvariants(d.layers[0])
})

test('invariants hold at vector sizes', () => {
  const d1 = generate('fefco-0427', {
    l: 254, w: 254, h: 102,
    sizeMode: 'inner', thickness: 1.5, materialId: 'micro-e',
  })
  checkInvariants(d1.layers[0])
  const d2 = generate('fefco-0215', {
    l: 355, w: 205, h: 120,
    sizeMode: 'inner', thickness: 3, materialId: 'flute-b',
  })
  checkInvariants(d2.layers[0])
})

test('invariants hold at small and large sizes', () => {
  const d1 = generate('fefco-0427', {
    l: 80, w: 60, h: 20,
    sizeMode: 'inner', thickness: 0.35, materialId: 'fbb-300',
  })
  checkInvariants(d1.layers[0])
  const d2 = generate('fefco-0427', {
    l: 900, w: 700, h: 400,
    sizeMode: 'inner', thickness: 3, materialId: 'flute-b',
  })
  checkInvariants(d2.layers[0])
  assert.ok(d2.warnings.some((w) => w.code === 'blank-oversize'))
})
