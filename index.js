const _ = require('lodash')
const Url = require('url')
const pdfParse = require('pdf-parse');
const requestPage = require('./lib/request')
const renderPageChrome = require('./lib/render-chrome')
const cookie = require('./lib/cookie')
const analyze = require('./lib/analyze')

const imageExtensions = ['gif', 'png', 'svg', 'ico', 'jpg', 'jpeg']
const musicExtensions = ['mp3', 'wav', 'aiff']
const videoExtensions = ['avi', 'mpg', 'mpeg', 'mp4']
const pdfExtensions = ['pdf']

const defaultReqOptions = {
  timeout: 6000,
  maxRedirects: 30,
  userAgent: 'Schenkerianbot/1.0 (+https://github.com/mix/schenkerian)'
}

/**
 * schenkerian scrapes and analyzes urls
 * Acceptable options:
 *   - url: a string with full protocol and domain
 *   - body (optional): html text
 *   - tokens (optional): map of name, values for use in cookies
 *   - returnSource (optional): includes boilerplate free html in result
 *   - agent (optional):
 *     - agentClass: for use by the request library
 *     - socksHost: socks proxy host
 *     - socksPort: socks proxy port
 *
 * @param options
 * @returns {*}
 */
module.exports = function (options) {
  const { url, tokens, body, returnSource } = options
  if (tokens) {
    _.merge(options, {
      jar: cookie.jarForRequest(tokens, url),
      cookies: cookie.chromeCookies(tokens, url)
    })
  }

  if (body) {
    return analyze(url, body, returnSource)
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
      return {
        title: url,
        image: url,
        source: results.body,
        url: results.url
      }
    })
  }
  if (isPDF(url)) {
    return requestPage(_.merge({
      url,
      encoding: null
    }, requestOptions))
    .then(results => {
      return pdfParse(Buffer.from(results.body, 'utf8'))
      .then(pdfData => {
        return {
          title: _.get(pdfData, 'info.Title', url),
          description: _.get(pdfData, 'info.Subject', url),
          image: url,
          source: pdfData.text,
          url: results.url
        }
      })
    })
  }

  return renderAndAnalyze(url, options, requestOptions)
}

function renderAndAnalyze(url, options, requestOptions) {
  const { fallbackRequest, returnSource } = options
  return renderPageChrome(url, requestOptions)
  .catch(err => {
    if (fallbackRequest) {
      return requestPage(_.merge({
        url
      }, requestOptions))
    }
    throw err
  })
  .then(results => {
    return analyze(results.url, results.body, returnSource)
    .then(res =>
      _.merge({
        url: results.url
      }, res)
    )
  })
}

function isMedia(url) {
  const extension = Url.parse(url).pathname.split('.').pop()
  return imageExtensions.includes(extension) || musicExtensions.includes(extension)
    || videoExtensions.includes(extension)
}

function isPDF(url) {
  const extension = Url.parse(url).pathname.split('.').pop()
  return pdfExtensions.includes(extension)
}