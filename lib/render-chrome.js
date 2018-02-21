const puppeteer = require('puppeteer')
const _ = require('lodash')

// Some of these are taken from previous scrapers and some from puppeteer recommendations
// https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md
const DEFAULT_CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--site-per-process',
  '--disable-gpu',
  '--ignore-certificate-errors',
  '--disable-gpu',
  '--no-experiments',
  '--no-default-browser-check',
  '--no-first-run',
  '--disable-default-apps',
  '--disable-translate',
  '--ash-force-desktop',
  '--disable-3d-apis',
  '--disable-setuid-sandbox',
  '--alsa-output-device=/dev/null',
  '--disk-cache-dir=/dev/null',
  '--disable-dev-shm-usage'
]

/**
 * Render Chrome uses puppeteer to get the html for a given url.
 * Options can include:
 *   - cookies which are objects containing name, value, & url
 *   - agentOptions which consist of socksHost & socksPort for socks proxying
 *   - userAgent for user-agent setting
 *   - timeout for request timeout to be passed to puppeteer page.goto()
 *
 * Successful promises return { url, body }
 * If the response fails or returns non 2** statusCode we return an
 * error with attached context statusCode, errBody.
 *
 * @param url
 * @param options
 * @returns {PromiseLike<T> | Promise<T>}
 */
module.exports = function (url, options = {}) {
  const { cookies, userAgent, timeout } = options
  let socksArgs = []
  if (_.get(options, 'agentOptions.sockHost') && _.get(options, 'agentOptions.sockPort')) {
    const { socksHost, socksPort } = options.agentOptions
    // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
    socksArgs = [
      `--proxy-server="socks5://${socksHost}:${socksPort}"`,
      `--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${socksHost}"`
      ]
  }
  return puppeteer.launch({
    args: DEFAULT_CHROMIUM_ARGS.concat(socksArgs)
  })
  .then(async browser => {
    const page = await browser.newPage()
    await page.setUserAgent(userAgent)
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies)
    }
    const response = await page.goto(url, _.merge({
      waitUntil: 'domcontentloaded',
      timeout
    }))

    const err = new Error(`Failed to get acceptable response`)
    if (response) {
      if (response.ok()) {
        const finalUrl = response.url()
        const body = await page.content()
        await browser.close()
        return {
          url: finalUrl,
          body
        }
      }
      _.merge(err, {
        statusCode: response.status(),
        errBody: response.text()
      })
    }
    _.merge(err, { url })
    await browser.close()
    throw err
  })
}
