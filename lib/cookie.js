const request = require('request')
const _ = require('lodash')

module.exports = function (tokens, url) {
  let j = request.jar()
  _.forOwn(tokens, (value, key) => {
    const cookie = request.cookie(key + '=' + value)
    j.setCookie(cookie, url);
  })
  return j
}
