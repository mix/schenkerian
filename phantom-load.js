var _ = require('lodash')
var system = require('system')
var phantomWebpage = require('webpage')

var originalUrl = system.args[1]
var userAgent = system.args[2]
var maxRedirects = system.args[3]
var timeout = system.args[4]
var jar = system.args[5]

function renderPage(url) {
  var page = phantomWebpage.create()
  var redirectURL = null

  page.settings.userAgent = userAgent
  page.settings.resourceTimeout = timeout

  if (jar) setCookies(page, jar)

  page.onError = function (msg, trace) {
    // do nothing
  }

  page.onResourceTimeout = function (request) {
    console.error('[ERROR] Exceeded timeout of ' + timeout + 'ms retrieving url[' + url + '] for originalUrl[' + originalUrl + ']')
    phantom.exit(1)
  }

  page.onResourceReceived = function (resource) {
    if (url === resource.url && resource.redirectURL) {
      redirectURL = resource.redirectURL
      if (maxRedirects === 0) {
        console.error('[ERROR] Max Redirects reached for ' + originalUrl)
        phantom.exit(1)
      }
      maxRedirects--
      return
    }

    // If request to the page is not 200 status, fail.
    if (resource.url === url && resource.status !== 200) {
      console.error('[ERROR] Received non-success status[' + resource.status + ']')
      page.close()
      phantom.exit(1)
    }
  }

  page.open(url, function (status) {
    if (redirectURL) {
      renderPage(redirectURL)
    } else if (status === 'success') {
      console.log(url)
      console.log(page.content)
      phantom.exit(0)
    } else {
      console.error('[ERROR] Received non-success status[' + status + '] for url[' + url + '] from originalUrl: '+ originalUrl)
      phantom.exit(1)
    }
  })
}

function setCookies(page, jar) {
  var cookieJar = JSON.parse(jar)
  var cookies = cookieJar._jar.cookies
  _.forEach(cookies, function(cookie) {
    page.addCookie({
      'name': cookie.key,
      'value': cookie.value || '',
      'domain': cookie.domain
    })
  })
}

renderPage(originalUrl)
