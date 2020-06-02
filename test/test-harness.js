'use strict'

const AWS = require('aws-sdk')
const tape = require('@pre-bundled/tape')
const tapeCluster = require('tape-cluster')

const FakeLambdaAPI = require('../index').FakeLambdaAPI

class TestHarness {
  constructor () {
    /** @type {FakeLambdaAPI} */
    this.lambdaServer = new FakeLambdaAPI()
    /** @type {AWS.Lambda|null} */
    this.lambda = null
  }

  /** @returns {Promise<void>} */
  async bootstrap () {
    await this.lambdaServer.bootstrap()
    this.lambda = this.buildLambdaClient('123', 'us-east-1')
  }

  /**
   * @param {string} accessKeyId
   * @param {string} region
   * @returns {AWS.Lambda}
   */
  buildLambdaClient (accessKeyId, region) {
    return new AWS.Lambda({
      region: region,
      endpoint: `http://${this.lambdaServer.hostPort}`,
      sslEnabled: false,
      accessKeyId: accessKeyId,
      secretAccessKey: 'abc'
    })
  }

  /** @returns {Promise<AWS.Lambda.Types.ListFunctionsResponse>} */
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
