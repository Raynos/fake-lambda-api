'use strict'

const http = require('http')
const util = require('util')

const stripCreds = /Credential=([\w-/0-9a-zA-Z]+),/

/** @typedef {AWS.Lambda.Types.FunctionConfiguration} FunctionConfiguration */
/** @typedef {{ (err?: Error): void; }} Callback */

class FakeLambdaAPI {
  /**
   * @param {{ port?: number, hostname?: string }} [options]
   */
  constructor (options = {}) {
    /** @type {number} */
    this.requestPort = typeof options.port === 'number' ? options.port : 0
    /** @type {string} */
    this.requestHost = options.hostname || 'localhost'

    /** @type {http.Server} */
    this.httpServer = http.createServer()
    /** @type {string|null} */
    this.hostPort = null

    // https://github.com/typescript-eslint/typescript-eslint/issues/1943
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    /** @type {Map<string, FunctionConfiguration[]>} */
    this._functions = new Map()
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  }

  /** @returns {Promise<string>} */
  async bootstrap () {
    this.httpServer.on('request', (
      /** @type {http.IncomingMessage} */ req,
      /** @type {http.ServerResponse} */ res
    ) => {
      this._handleServerRequest(req, res)
    })

    await util.promisify((/** @type {Callback} */ cb) => {
      this.httpServer.listen(this.requestPort, this.requestHost, cb)
    })()

    const addr = this.httpServer.address()
    if (!addr || typeof addr === 'string') {
      throw new Error('Invalid httpServer.address()')
    }

    this.hostPort = `${addr.address}:${addr.port}`

    // TODO: if this.cachePath

    return this.hostPort
  }

  async close () {
    await util.promisify((/** @type {Callback} */ cb) => {
      this.httpServer.close(cb)
    })()
  }

  async cacheFunctionsToDisk () {}
  async populateFromCache () {}
  populateFunctions () {}

  /**
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @returns {void}
   */
  _handleServerRequest (req, res) {
    /** @type {Array<Buffer>} */
    const buffers = []
    req.on('data', (/** @type {Buffer} */ chunk) => {
      buffers.push(chunk)
    })
    req.on('end', () => {
      const bodyBuf = Buffer.concat(buffers)
      const url = req.url || '/'

      if (req.method === 'GET' &&
          url.startsWith('/2015-03-31/functions/')
      ) {
        const respBody = this._handleListFunctions(req, bodyBuf)

        res.writeHead(200, {
          'Content-Type': 'application/json'
        })
        res.end(JSON.stringify(respBody))
      } else {
        res.statusCode = 500
        res.end('URL not supported: ' + url)
      }
    })
  }

  /**
   * @param {http.IncomingMessage} req
   * @returns {FunctionConfiguration[]}
   */
  _getFunctionsMap (req) {
    const authHeader = req.headers.authorization
    let profile = 'default'
    let region = 'us-east-1'
    const match = authHeader ? authHeader.match(stripCreds) : null
    if (match) {
      const creds = match[0].slice(11)
      const parts = creds.split('/')
      const accessKeyId = parts[0]

      region = parts[2]
      profile = accessKeyId
    }

    const key = `${profile}::${region}`

    const functions = this._functions.get(key)
    if (functions) {
      return functions
    }

    return this._functions.get('default::us-east-1') || []
  }

  /**
   * @param {http.IncomingMessage} req
   * @param {Buffer} _bodyBuf
   * @returns {AWS.Lambda.Types.ListFunctionsResponse}
   */
  _handleListFunctions (req, _bodyBuf) {
    // console.log('hmm', req, req.headers)
    const functionsArr = this._getFunctionsMap(req).slice()

    // TODO: req.Marker, req.MaxItems
    // TODO: pagination

    return {
      NextMarker: undefined,
      Functions: functionsArr
    }
  }
}
exports.FakeLambdaAPI = FakeLambdaAPI
