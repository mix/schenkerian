const request = require('request')
const _ = require('lodash')

exports.jarForRequest = function (tokens, url) {
  let j = request.jar()
  _.forOwn(tokens, (value, key) => {
    const cookie = request.cookie(key + '=' + value)
    j.setCookie(cookie, url);
  })
  return j
}

exports.chromeCookies = function (tokens, url) {
  return _.map(tokens, (value, name) => {
    return {
      name,
      value,
      url
    }
  })
}
