const _ = require('lodash')
const Url = require('url')
const requestPage = require('./lib/request')
const renderPagePhantom = require('./lib/render-phantom')
const renderPageChrome = require('./lib/render-chrome')
const cookie = require('./lib/cookie')
const analyze = require('./lib/analyze')

const imageExtensions = ['gif', 'png', 'svg', 'ico', 'jpg', 'jpeg']
const musicExtensions = ['mp3', 'wav', 'aiff']
const videoExtensions = ['avi', 'mpg', 'mpeg', 'mp4']

const defaultReqOptions = {
  timeout: 6000,
  maxRedirects: 30,
  userAgent: 'Schenkerianbot/1.0 (+https://github.com/mix/schenkerian)'
}

module.exports = function _export(options) {
  let url = options.url
  if (options.tokens) {
    _.merge(options, {
      jar: cookie.jar(options.tokens, url),
      cookies: cookie.chromeCookies(options.tokens, url)
    })
  }

  if (options.body) {
    return analyze(url, options.body, options.returnSource)
  }

  return requestAndSendToAnalyze(url, options)
}

function requestAndSendToAnalyze(url, options) {
  let requestOptions = _.merge({
    url
  }, _.pick(options, [
    'timeout',
    'userAgent',
    'fallbackRequest',
    'jar',
    'cookies'
  ]))
  if (options.agent) {
    requestOptions.agentClass = options.agent.agentClass
    requestOptions.agentOptions = {
      socksHost: options.agent.socksHost,
      socksPort: options.agent.socksPort
    }
  }

  if (isMedia(url)) {
    return requestPage(_.merge({
      url
    }, _.defaults(requestOptions, defaultReqOptions)))
    .then(results => {
      return {
        url: results.url,
        title: url,
        image: url
      }
    })
  }

  if (options.forceRequest) {
    return requestPage(_.merge({
      url
    }, _.defaults(requestOptions, defaultReqOptions)))
    .then(results => {
      return {
        url: results.url,
        title: url,
        image: url,
        source: results.body
      }
    })
  }

  let endUrl
  let promise
  if (options.phantom) {
    promise = renderPagePhantom(url, _.defaults(requestOptions, defaultReqOptions))
  } else {
    promise = renderPageChrome(url, _.defaults(requestOptions, defaultReqOptions))
  }
  return promise
  .catch(err => {
    if (options.fallbackRequest) {
      return requestPage(_.merge({url: url}, options))
    }
    throw err
  })
  .then(results => {
    endUrl = results.url
    if (results.browser) {
      results.browser.close()
    }
    return analyze(endUrl, results.body, options.returnSource)
  })
  .then(res =>
    _.merge({
      url: endUrl
    }, res)
  )
}

function isMedia(url) {
  let extension = Url.parse(url).pathname.split('.').pop()
  return imageExtensions.includes(extension) || musicExtensions.includes(extension)
    || videoExtensions.includes(extension)
}
