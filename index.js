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

module.exports = function (options) {
  const { url, tokens, body } = options
  if (tokens) {
    _.merge(options, {
      jar: cookie.jar(tokens, url),
      cookies: cookie.chromeCookies(tokens, url)
    })
  }

  if (body) {
    return analyze(options)
  }

  return retrieveContent(url, options)
}

function retrieveContent(url, options) {
  const { forceRequest, agent } = options
  let requestOptions = _.defaults(
    _.pick(options, ['url', 'timeout', 'userAgent', 'jar', 'cookies']),
    defaultReqOptions
  )

  if (agent) {
    const { agentClass, socksHost, socksPort } = agent
    _.merge(requestOptions, {
      agentClass,
      agentOptions: {
        socksHost,
        socksPort
      }
    })
  }

  if (isMedia(url) || forceRequest) {
    return requestPage(_.merge({
      url
    }, requestOptions))
    .then(results => {
      // Media content can't be analyzed
      // It does not contain html to be processed so just return the source
      // Treat forceRequest flags the same way
      return _.merge({
        title: url,
        image: url,
        source: results.body
      }, _.pick(results, ['url']))
    })
  }

  return renderAndAnalyze(url, options, requestOptions)
}

function renderAndAnalyze(url, options, requestOptions) {
  const { fallbackRequest, phantom, returnSource } = options
  const renderHandler = (phantom) ? renderPagePhantom : renderPageChrome

  return renderHandler(url, requestOptions)
  .catch(err => {
    if (fallbackRequest) {
      return requestPage(_.merge({
        url
      }, requestOptions))
    }
    throw err
  })
  .then(results => {
    return analyze(_.merge({
      returnSource
    }, results))
    .then(res =>
      _.merge({
        url: results.url
      }, res)
    )
  })
}

function isMedia(url) {
  let extension = Url.parse(url).pathname.split('.').pop()
  return imageExtensions.includes(extension) || musicExtensions.includes(extension)
    || videoExtensions.includes(extension)
}
