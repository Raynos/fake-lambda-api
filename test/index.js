'use strict'

process.on('unhandledRejection', (err) => {
  process.nextTick(() => { throw err })
})

const test = require('./test-harness').test

test('listing functions', async (harness, t) => {
  t.ok(harness.lambdaServer.hostPort)

  const lambda = harness.lambda
  t.ok(lambda)

  const data = await harness.listFunctions()
  t.ok(data)
  t.deepEqual(Object.keys(data), ['Functions'])
  t.deepEqual(data.Functions, [])

  t.end()
})
