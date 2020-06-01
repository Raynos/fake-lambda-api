'use strict'

const http = require('http')
const util = require('util')
const fs = require('fs')

const mkdir = util.promisify(fs.mkdir)
const stripCreds = /Credential=([\w-/0-9a-zA-Z]+),/

/** @typedef {AWS.Lambda.Types.FunctionConfiguration} FunctionConfiguration */
/** @typedef {{ (err?: Error): void; }} Callback */

class FakeLambdaAPI {
  /**
   * @param {{
   *    port?: number,
   *    hostname?: string,
   *    cachePath?: string
   * }} [options]
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
    /** @type {string|null} */
    this.cachePath = options.cachePath || null

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

  /**
   * @param {import('aws-sdk')} AWS
   * @returns {Promise<string[]>}
   */
  async getAllRegions (AWS) {
    const ec2 = new AWS.EC2({ region: 'us-east-1' })

    const data = await ec2.describeRegions().promise()

    if (!data.Regions) return []
    return data.Regions.map((r) => {
      if (!r.RegionName) throw new Error('Missing RegionName')
      return r.RegionName
    })
  }

  /**
   * @param {import('aws-sdk')} AWS
   * @param {string[] | 'all'} regions
   * @returns {Promise<void>}
   */
  async fetchAndCache (AWS, regions) {
    if (regions === 'all') {
      regions = await this.getAllRegions(AWS)
    }

    /** @type {Promise<void>[]} */
    const tasks = []
    for (const region of regions) {
      tasks.push(this.fetchAndCacheForRegion(AWS, region))
    }
    await Promise.all(tasks)
  }

  /**
   * @param {import('aws-sdk')} AWS
   * @param {string} region
   * @returns {Promise<void>}
   */
  async fetchAndCacheForRegion (AWS, region) {
    const lambda = new AWS.Lambda({
      region: region
    })

    const data = await lambda.listFunctions().promise()

    if (!lambda.config.credentials) throw new Error('no credentials')
    const accessKeyId = lambda.config.credentials.accessKeyId

    if (!data.Functions || data.Functions.length === 0) {
      return
    }
    await this.cacheFunctionsToDisk(accessKeyId, region, data.Functions)
    this.populateFunctions(accessKeyId, region, data.Functions)
  }

  /**
   * @param {string} profile
   * @param {string} region
   * @param {FunctionConfiguration[]} functions
   * @returns {Promise<void>}
   */
  async cacheFunctionsToDisk (profile, region, functions) {
    if (!this.cachePath) {
      throw new Error('Missing this.cachePath')
    }

    await mkdir(this.cachePath, { recursive: true })

  }

  async populateFromCache () {}

  /**
   * @param {string} profile
   * @param {string} region
   * @param {FunctionConfiguration[]} functions
   * @returns {void}
   */
  populateFunctions (profile, region, functions) {
    const key = `${profile}::${region}`
    const funcs = this._functions.get(key) || []
    funcs.push(...functions)

    this._functions.set(key, funcs)
  }

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
