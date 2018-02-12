const request = require('request')
const _ = require('lodash')
const Promise = require('bluebird')

module.exports = function (requestOptions) {
  const reqDefaultOptions = {
    followAllRedirects: true,
    pool: { maxSockets: 256 },
    'headers': {
      'user-agent': requestOptions.userAgent
    }
  }

  return new Promise((resolve, reject) =>
    request(_.merge(reqDefaultOptions, requestOptions), (err, res, body) => {
      if (err || res.statusCode !== 200 || !body) {
        return reject(new Error('Webpage could not resolve'))
      }
      const url = res.request.uri.href

      resolve({
        url,
        body
      })
    })
  )
}

