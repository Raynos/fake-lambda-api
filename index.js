'use strict'

const http = require('http')

class FakeLambdaAPI {
  /**
   *
   * @param {{ port?: number, hostname?: string }} [options]
   */
  constructor (options = {}) {
    this.requestPort = 'port' in options ? options.port : 0
    this.requestHost = options.hostname || 'localhost'

    this.httpServer = http.createServer()
  }

  async bootstrap () {}
  async close () {}

  async cacheFunctionsToDisk () {}
  async populateFromCache () {}
  populateFunctions () {}

  _handleServerRequest () {}
}
exports.FakeLambdaAPI = FakeLambdaAPI
