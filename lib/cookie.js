const request = require('request')
const _ = require('lodash')

/**
 * jarForRequest returns a jar object usable by the request library
 *
 * @param tokens
 * @param url
 * @returns {*}
 */
exports.jarForRequest = function (tokens, url) {
  let j = request.jar()
  _.forOwn(tokens, (value, key) => {
    const cookie = request.cookie(key + '=' + value)
    j.setCookie(cookie, url);
  })
  return j
}

/**
 * chromeCookies returns cookie objects { name, value, url }
 * that is usable by the puppeteer library for making page requests
 *
 * @param tokens
 * @param url
 * @returns {*}
 */
exports.chromeCookies = function (tokens, url) {
  return _.map(tokens, (value, name) => {
    return {
      name,
      value,
      url
    }
  })
}
