var system = require('system')
var phantomWebpage = require('webpage')

function renderPage(url, userAgent) {
  var page = phantomWebpage.create()
  var redirectURL = null

  page.settings.userAgent = userAgent
  page.onError = function (msg, trace) {
    console.error('Failed to retrieve url[' + url + '] :' + msg)
    phantom.exit(1)
  }

  page.onResourceReceived = function (resource) {
    if (url === resource.url && resource.redirectURL) {
      redirectURL = resource.redirectURL
    }
  }

  page.open(url, function (status) {
    if (redirectURL) {
      renderPage(redirectURL, userAgent)
    } else if (status === 'success') {
      console.log(url)
      console.log(page.content)
      phantom.exit(0)
    } else {
      console.error('Received non-success status: ' + status)
      phantom.exit(1)
    }
  })
}

renderPage(system.args[1], system.args[2])
