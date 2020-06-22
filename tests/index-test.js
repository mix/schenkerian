const proxy = require('proxyquire')
const http = require('http')
const Promise = require('bluebird')
const MIXCOM_TITLE = 'Rediscover the Internet'
const MIXCOM_DESCRIPTION = 'Mix is a new personalized discovery platform that unlocks more of the internet you care about.'

describe('schenkerian', function () {
  let subject
  beforeEach(function () {
    subject = require('../')
  })

  it('retrieves analyzed content for a webpage', function () {
    return subject({
      url: 'http://mix.com'
    })
    .then(function (response) {
      expect(response.url).to.equal('https://mix.com/')
      expect(response.title).to.equal(MIXCOM_TITLE)
      expect(response.description).to.equal(MIXCOM_DESCRIPTION)
      expect(response.image).to.exist
      expect(response.amphtml).to.not.exist
      expect(response.canonical).to.equal('https://mix.com/')
    })
  })

  it('retrieves analyzed from youtu.be where the title fluctuates', function () {
    return subject({
      url: 'https://youtu.be/NjAqVWUaGE0',
      timeout: 60 * 1000
    })
    .then(function (response) {
      const expectedUrl = 'https://www.youtube.com/watch?v=NjAqVWUaGE0'
      expect(response.url).to.contain(expectedUrl)
      expect(response.title).to.contain('Anchorman--Outtakes')
      expect(response.description).to.equal('')
      expect(response.image).to.exist
      expect(response.amphtmlUrl).not.to.exist
    })
  })

  it('resolves webpage with hash fragments', function () {
    return subject({
      url: 'https://big.dk/#projects-maze',
      timeout: 30 * 1000
    })
    .then(function (response) {
      expect(response.url).to.equal('https://big.dk/#projects-maze')
      expect(response.title).to.equal('BIG | Bjarke Ingels Group')
    })
  })

  it('retrieves analyzed content with utf8 encoding', function () {
    return subject({
      url: 'https://architizer.com/projects/universite-de-technologie-de-compiegne-utc/',
      body: `
<html>
  <head>
    <meta property="og:title" content="Université de Technologie de Compiègne (UTC)">
  </head>
  <body></body>
</html>
`
    })
    .then(function (response) {
      expect(response.title).to.equal('Université de Technologie de Compiègne (UTC)')
    })
  })

  it('retrieves amphtml and canonical url from url', function () {
    return subject({
      url: 'http://space.com/36165-therapy-helps-astronauts-sleep.html',
      timeout: 30 * 1000 // 30 seconds
    })
    .then(function (response) {
      expect(response.amphtml).to.equal('https://www.space.com/amp/36165-therapy-helps-astronauts-sleep.html')
      expect(response.canonical).to.equal('https://www.space.com/36165-therapy-helps-astronauts-sleep.html')
    })
  })

  it('works on a webpage when given an agent', function () {
    return subject({
      url: 'http://mix.com',
      agent: {
        agentClass: http.Agent
      }
    })
    .then(function (response) {
      return expect(response.title).to.equal(MIXCOM_TITLE)
    })
  })

  it('works on a webpage when given tokens', function () {
    return subject({
      url: 'https://httpbin.org/cookies',
      tokens: { uid: 'd62d7afa3547f873d4bed44b1eaaa22aa1490732414' },
      returnSource: true
    })
    .then(function (response) {
      expect(response.source).to.contain('d62d7afa3547f873d4bed44b1eaaa22aa1490732414')
    })
  })

  it('works on a webpage via request when given tokens', function () {
    return subject({
      url: 'https://httpbin.org/cookies',
      timeout: 1000,
      forceRequest: true,
      tokens: { uid: 'd62d7afa3547f873d4bed44b1eaaa22aa1490732414' }
    })
    .then(function (response) {
      expect(response.source).to.contain('d62d7afa3547f873d4bed44b1eaaa22aa1490732414')
    })
  })

  it('analyzes given a body', function () {
    return subject({
      url: 'http://mix.com',
      body: `
<html>
  <head>
    <title>something fun</title>
  </head>
  <body></body>
</html>
`
    })
    .then(function (response) {
      return expect(response.title).to.equal('something fun')
    })
  })

  it('returns the source content when required', function () {
    return subject({
      url: 'http://mix.com',
      returnSource: true
    })
    .then(function (response) {
      expect(response.title).to.equal(MIXCOM_TITLE)
      expect(response.source).to.exist
      expect(response.source).to.contain('Mix')
    })
  })

  it('returns data for a valid image url', function () {
    const url = 'https://static.scientificamerican.com/blogs/cache/file/D37C6F64-E11B-413B-B4B9D36CF0D7C877.jpg?' +
      'w=590&h=393&77AB39F8-5374-4AE4-93396577281B788A'
    return subject({
      url
    })
    .then(function (response) {
      expect(response.url).to.equal(url)
      expect(response.title).to.equal(url)
      expect(response.image).to.equal(url)
      expect(response.description).to.not.exist
      expect(response.amphtml).to.not.exist
      expect(response.canonical).to.not.exist
    })
  })

  it('returns data for a valid pdf url', function () {
    const url = 'http://www.fundacionsgae.org/Lists/FSGAE_SalaPrensa_Recursos/Attachments/1/dummy.pdf'
    return subject({
      url
    })
    .then(function (response) {
      expect(response.url).to.equal(url)
      expect(response.source).to.contain('mailing list from')
    })
  })

  context('failure scenarios', function () {
    it('loads the webpage via request if chrome fails', function () {
      subject = proxy('../', {
        './lib/render-chrome': function () {
          return Promise.reject('Failed to render-chrome for test')
        }
      })

      return subject({
        url: 'http://mix.com',
        timeout: 1000,
        fallbackRequest: true
      })
      .then(function (response) {
        expect(response.title).to.equal(MIXCOM_TITLE)
      })
    })

    it('rejects when parsing with cheerio fails on a webpage', function () {
      let loadStub = sinon.stub()
      loadStub['@global'] = true
      subject = proxy('../', {
        'cheerio': loadStub
      })

      loadStub.throws(new Error('Some Error'))
      return expect(subject({
        url: 'http://mix.com'
      })).to.be.rejectedWith('Some Error')
    })

    it('rejects when cornet fails on a webpage', function () {
      let loadStub = sinon.stub()
      let cornetStub = function Cornet() {
        return {
          remove: loadStub
        }
      }
      cornetStub['@global'] = true
      subject = proxy('../', {
        'cornet': cornetStub
      })

      loadStub.throws(new Error('Some Error'))
      return expect(subject({
        url: 'http://mix.com'
      })).to.be.rejectedWith('Some Error')
    })

    it('rejects when an 404 error occurs', function () {
      return expect(subject({
        url: 'https://google.com/404'
      })).to.be.rejectedWith('Failed to get acceptable response')
    })

    it('rejects no head element exists', function () {
      return expect(subject({
        url: 'http://mix.com',
        body: '<html><title>something fun</title></html>'
      })).to.be.rejectedWith('Timed out trying to get head element')
    })

    it('rejects no body element exists', function () {
      return expect(subject({
        url: 'http://mix.com',
        body: '<html><head></head><title>something fun</title></head></html>'
      })).to.be.rejectedWith('Timed out trying to get body element')
    })

    it('rejects when the page times out', function () {
      return expect(subject({
        url: 'http://mix.com',
        timeout: 1
      })).to.be.rejectedWith('Navigation timeout of 1 ms exceeded')
    })
  })

  it('deals with bad ssl when using ignoreHTTPSErrors', function () {
    return subject({
      url: 'https://expired.badssl.com',
      ignoreHTTPSErrors: true
    })
    .then(function (response) {
      expect(response.url).to.equal('https://expired.badssl.com/')
    })
  })
})
