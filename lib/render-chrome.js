const puppeteer = require('puppeteer')
const _ = require('lodash')

module.exports = function (url, options = {}) {
  const { cookies, userAgent, timeout } = options
  return puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--site-per-process',
      '--disable-gpu',
      '--ignore-certificate-errors'
    ]
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
    const body = await page.content()
    return {
      url: response.url(),
      body,
      browser
    }
  })
}