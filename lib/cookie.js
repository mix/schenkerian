const request = require('request')
const _ = require('lodash')

exports.jar = function (tokens, url) {
  let j = request.jar()
  _.forOwn(tokens, (value, key) => {
    const cookie = request.cookie(key + '=' + value)
    j.setCookie(cookie, url);
  })
  return j
}

exports.chromeCookies = function (tokens, url) {
  let cookies = []
  _.forOwn(tokens, (value, key) => {
    cookies.push({
      name: key,
      value,
      url
    })
  })
  return cookies
}