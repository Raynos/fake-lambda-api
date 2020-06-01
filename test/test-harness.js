'use strict'

const AWS = require('aws-sdk')
const tape = require('@pre-bundled/tape')
const tapeCluster = require('tape-cluster')

const FakeLambdaAPI = require('../index').FakeLambdaAPI

class TestHarness {
  constructor () {
    this.lambdaServer = new FakeLambdaAPI()
    /** @type {AWS.Lambda|null} */
    this.lambda = null
  }

  /** @returns {Promise<void>} */
  async bootstrap () {
    const hostPort = await this.lambdaServer.bootstrap()

    this.lambda = new AWS.Lambda({
      region: 'us-east-1',
      endpoint: `http://${hostPort}`,
      sslEnabled: false,
      accessKeyId: '123',
      secretAccessKey: 'abc'
    })
  }

  async listFunctions () {
    if (!this.lambda) {
      throw new Error('not bootstrapped')
    }

    return this.lambda.listFunctions().promise()
  }

  /** @returns {Promise<void>} */
  async close () {
    await this.lambdaServer.close()
  }
}
exports.test = tapeCluster(tape, TestHarness)
