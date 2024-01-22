// Capture all the endpoints and then test them with the provided parameters.
const fs = require('fs')

const url = 'http://localhost:3006/api'

async function testAPI (url, params) {
  const response = await fetch(url,
    { 'method': 'POST',
      'headers': {
        'Content-Type': 'application/json'
      },
      'body': JSON.stringify(params)
    })
    const data = await response.json()

    .then((data) => {
      let stringy = JSON.stringify(data)
      if (stringy.length > 1000) {
        data = stringy.slice(1, 100) + '...' + JSON.stringify(data).slice(-100)
      }
      var response = { 'url': url, 'params': params, 'response': stringy }
      if (stringy['response']['status'] === 'success') {
        fs.appendFile('message.jsonl', JSON.stringify(response) + '\n', function (err) {
          if (err) throw err
          console.log('Saved!')
        })
      } else {
        fs.appendFile('err_message.jsonl', JSON.stringify(response) + '\n', function (err) {
          if (err) throw err
          console.log('Saved!')
        })
      }
    })
    .catch((err) => {
      var response = { 'url': url, 'params': params, 'error': err.message }
      fs.appendFile('err_message.jsonl', JSON.stringify(response) + '\n', function (err) {
        if (err) throw err
        console.log('Saved!')
      })
    })
}

fetch(url)
  .then((response) => response.json())
  .then((data) => {
    const rawMethods = data.data.map(x => [x.name, x.params])
    var testURL = []
    for (var i = 0; i < rawMethods.length; i++) {
      let params = rawMethods[i][1]

      var queryString = { method: rawMethods[i][0] }

      for (var j = 0; j < params.length; j++) {
        if (params[j]['name']) {
          if (params[j]['type'].match('integer[]')) {
            params[j]['type'] = '123,124'
          } else if (params[j]['type'].match('int')) {
            params[j]['type'] = 123
          } else if (params[j]['type'].match('dou')) {
            params[j]['type'] = 12
          } else if (params[j]['type'].match('char')) {
            params[j]['type'] = '%'
          } else if (params[j]['type'].match('bool')) {
            params[j]['type'] = 'true'
          }
          queryString[params[j]['name']] = params[j]['type']
        }
      }
      testURL.push({ url: url, params: queryString })
    }
    return testURL
  })
  .then((output) => output.map((url) => testAPI(url['url'], url['params'])))
