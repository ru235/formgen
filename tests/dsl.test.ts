import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flap, panel, row } from '../engine/dsl.ts'
import { measure, segments } from '../engine/geometry.ts'

test('row lays panels left-to-right with reciprocal creases', () => {
  const faces = row([panel('a', 100, 50), panel('b', 60, 50)]).build()
  assert.equal(faces.length, 2)
  const a = faces.find((f) => f.id === 'a')!
  const b = faces.find((f) => f.id === 'b')!
  assert.equal(a.edges[1].kind, 'crease') // a right → b
  assert.equal(a.edges[1].hinge, 'b')
  assert.equal(b.edges[3].kind, 'crease') // b left → a
  assert.equal(b.edges[3].hinge, 'a')
  const aRight = segments(a)[1]
  const bLeft = segments(b)[3]
  assert.deepEqual(aRight.from, bLeft.to)
  assert.deepEqual(aRight.to, bLeft.from)
})

test('flap attaches with crease on parent side and hinge on flap', () => {
  const faces = row([panel('base', 200, 100)])
    .attachTop('base', flap('baseTop', 40))
    .build()
  assert.equal(faces.length, 2)
  const base = faces.find((f) => f.id === 'base')!
  const top = faces.find((f) => f.id === 'baseTop')!
  assert.equal(base.edges[0].kind, 'crease')
  assert.equal(base.edges[0].hinge, 'baseTop')
  assert.equal(top.edges[2].kind, 'crease')
  assert.equal(top.edges[2].hinge, 'base')
})

test('tapered flap insets the far edge', () => {
  const faces = row([panel('base', 200, 100)])
    .attachTop('base', flap('top', 40, { taper: 5 }))
    .build()
  const top = faces.find((f) => f.id === 'top')!
  const farEdge = segments(top)[0]
  assert.equal(Math.round(farEdge.to.x - farEdge.from.x), 190) // 200 - 2×5
})

test('glueTab free edges are glue kind, joint is crease', () => {
  const faces = row([panel('back', 300, 150)])
    .attachLeft('back', flap('glueTab', 20, { edgeKind: 'glue' }))
    .build()
  const tab = faces.find((f) => f.id === 'glueTab')!
  // joint edge: crease on both faces, reciprocal
  assert.equal(tab.edges[1].kind, 'crease')
  assert.equal(tab.edges[1].hinge, 'back')
  // measure the whole construction: joint counted once
  const m = measure(faces)
  assert.equal(m.glue, 20 + 20 + 150) // tab free edges
  assert.equal(m.crease, 150) // joint edge, one line
})

test('throws on double crease on one side', () => {
  assert.throws(
    () => {
      row([panel('a', 100, 50)])
        .attachTop('a', flap('t1', 20))
        .attachTop('a', flap('t2', 20))
        .build()
    },
    /already has a crease/,
  )
})

test('throws on unknown parent', () => {
  assert.throws(
    () => {
      row([panel('a', 100, 50)]).attachTop('nope', flap('t', 20)).build()
    },
    /unknown parent/,
  )
})

test('throws when taper collapses the far edge', () => {
  assert.throws(
    () => {
      row([panel('a', 100, 50)]).attachTop('a', flap('t', 20, { taper: 60 })).build()
    },
    /taper/,
  )
})

test('throws on duplicate ids', () => {
  assert.throws(
    () => {
      row([panel('a', 100, 50), panel('a', 60, 50)]).build()
    },
    /Duplicate/,
  )
})

test('throws on mixed panel heights', () => {
  assert.throws(
    () => {
      row([panel('a', 100, 50), panel('b', 60, 40)]).build()
    },
    /same height/,
  )
})

test('holes are placed in face-local coords', () => {
  const faces = row([panel('base', 200, 100)])
    .attachBottom('base', flap('bot', 30, {
      holes: [{ x: 90, y: 10, w: 20, h: 10 }],
    }))
    .build()
  const bot = faces.find((f) => f.id === 'bot')!
  assert.equal(bot.holes?.length, 1)
  // bottom-attached: box.y0 = p.y1 = origin.y → hole y stays 10
  assert.equal(bot.holes![0].y, 10)
})

test('throws when hole is outside the face', () => {
  assert.throws(
    () => {
      row([panel('base', 200, 100)])
        .attachBottom('base', flap('bot', 30, {
          holes: [{ x: 190, y: 10, w: 20, h: 10 }],
        }))
        .build()
    },
    /outside face/,
  )
})
