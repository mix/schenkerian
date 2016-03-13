var system = require('system')
var phantomWebpage = require('webpage')

var originalUrl = system.args[1]
var userAgent = system.args[2]
var maxRedirects = system.args[3]
var timeout = system.args[4]

function renderPage(url) {
  var page = phantomWebpage.create()
  var redirectURL = null

  page.settings.userAgent = userAgent
  page.settings.resourceTimeout = timeout

  page.onError = function (msg, trace) {
    // do nothing
  }

  page.onResourceTimeout = function (request) {
    console.error('Timed out retrieving url[' + url + '] for originalUrl[' + originalUrl + ']: ' +
      JSON.stringify(request))
    phantom.exit(1)
  }

  page.onResourceReceived = function (resource) {
    if (url === resource.url && resource.redirectURL) {
      redirectURL = resource.redirectURL
      if (maxRedirects === 0) {
        console.error('Max Redirects reached for ' + originalUrl)
        phantom.exit(1)
      }
      maxRedirects--
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
      console.error('Received non-success status[' + status + '] for url[' + url + '] from originalUrl: '+ originalUrl)
      phantom.exit(1)
    }
  })
}

renderPage(originalUrl)
