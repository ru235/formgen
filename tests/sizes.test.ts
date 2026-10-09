import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSizes } from '../engine/sizes.ts'
import { f0215Coeffs } from '../engine/styles/fefco-0215.ts'
import { f0427Coeffs } from '../engine/styles/fefco-0427.ts'

test('single-walled: inner → manufacture (+T) and outer (+2T)', () => {
  const s = resolveSizes({ l: 300, w: 200, h: 150 }, 'inner', 3, f0215Coeffs)
  assert.deepEqual(s.inner, { l: 300, w: 200, h: 150 })
  assert.deepEqual(s.manufacture, { l: 303, w: 203, h: 153 })
  assert.deepEqual(s.outer, { l: 306, w: 206, h: 156 })
})

test('double-walled axis: 0427 L axis manufacture = inner + 5T', () => {
  const s = resolveSizes({ l: 254, w: 254, h: 102 }, 'inner', 1.5, f0427Coeffs)
  assert.deepEqual(s.manufacture, { l: 261.5, w: 255.5, h: 103.5 })
  assert.deepEqual(s.outer, { l: 263, w: 257, h: 105 })
})

test('manufacture mode roundtrip', () => {
  const s = resolveSizes({ l: 303, w: 203, h: 153 }, 'manufacture', 3, f0215Coeffs)
  assert.deepEqual(s.inner, { l: 300, w: 200, h: 150 })
  assert.deepEqual(s.manufacture, { l: 303, w: 203, h: 153 })
})

test('outer mode roundtrip', () => {
  const s = resolveSizes({ l: 306, w: 206, h: 156 }, 'outer', 3, f0215Coeffs)
  assert.deepEqual(s.inner, { l: 300, w: 200, h: 150 })
  assert.deepEqual(s.outer, { l: 306, w: 206, h: 156 })
})

test('0427 inner roundtrip is exact', () => {
  const s = resolveSizes({ l: 254, w: 254, h: 102 }, 'inner', 1.5, f0427Coeffs)
  assert.ok(Math.abs(s.inner.l - 254) < 1e-9)
  assert.ok(Math.abs(s.inner.w - 254) < 1e-9)
  assert.ok(Math.abs(s.inner.h - 102) < 1e-9)
})
