// Capture all the endpoints and then test them with the provided parameters.
const fs = require('fs');

const url = 'http://tiliaprivaterds-env.eba-jy8cfsip.us-east-2.elasticbeanstalk.com/api'

async function testAPI(url) {
  const output = await fetch(url, { 'method': 'GET' })
    .then((response) => {
      if (!response.status === 200) {
        setTimeout(() => 'Waiting', 2000)
      }
      return response.json()
    })
    .then((data) => {
      var response = { 'url': url, 'response': data }
      fs.appendFile('message.txt', JSON.stringify(response), function (err) {
        if (err) throw err
        console.log('Saved!')
      })
    })
    .catch((err) => console.log(err))
}

fetch(url)
  .then((response) => response.json())
  .then((data) => {
    const rawMethods = data.data.map(x => [x.name, x.params])
    var typeArray = []
    var testURL = []
    for (var i = 0; i < rawMethods.length; i++) {
      let method = rawMethods[i][0]
      let params = rawMethods[i][1]

      var queryString = ''
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
          queryString = queryString + '&' + params[j]['name'] + '=' + params[j]['type']
        }
      }

      var newURL = url + '?method=' + method + queryString

      testURL.push(newURL)
    }
    return testURL
  })
  .then((output) => output.map((url) => testAPI(url)))
