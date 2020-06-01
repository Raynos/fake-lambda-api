# fake-lambda-api

Setup a fake Lambda API server for testing purposes

## Example

```js
const AWS = require('aws-sdk')
const FakeLambdaAPI = require('fake-lambda-api').FakeLambdaAPI

async function test() {
  const server = new FakeLambdaAPI({ port: 0 })
  await server.bootstrap()


  const lambda = new AWS.Lambda({
    endpoint: `http://${server.hostPort}`,
    sslEnabled: false
  })

  const data = await lambda.listFunctions().promise()
  console.log('list of functions', data)

  await server.close()
}

process.on('unhandledRejection', (err) => { throw err })
test()
```

## Support

The following `aws-sdk` methods are supported

 - `lambda.listFunctions()`

## install

```
% npm install fake-lambda-api
```

## MIT Licensed

