var proxy = require('proxyquire')
var http = require('http')

describe('The analyzer', function () {
  var subject
  beforeEach(function () {
    subject = require('../')
  })

  it('be rejected when parsing with cheerio fails on a webpage', function () {
    var loadStub = sinon.stub()
    subject = proxy('../', {
      'cheerio': loadStub
    })

    loadStub.throws(new Error('Some Error'))
    return expect(subject({
      url: 'http://mix.com'
    })).to.be.rejectedWith('Some Error')
  })

  it('be rejected when cornet fails on a webpage', function () {
    var loadStub = sinon.stub()
    subject = proxy('../', {
      'cornet': function Cornet() {
        return {
          remove: loadStub
        }
      }
    })

    loadStub.throws(new Error('Some Error'))
    return expect(subject({
      url: 'http://mix.com'
    })).to.be.rejectedWith('Some Error')
  })

  it('retrieves analyzed content for a webpage', function () {
    return subject({
      url: 'http://mix.com'
    })
    .then(function (response) {
      expect(response.url).to.equal('http://mix.com')
      expect(response.title).to.equal('Discover, collect, and discuss the best of the web')
      expect(response.description).to.equal('Connecting the curious & creative.')
      expect(response.image).to.exist
      expect(response.amphtml).to.not.exist
      expect(response.canonical).to.not.exist
    })
  })

  it('retrieves amphtml and canonical url from url', function () {
    return subject({
      url: 'https://techcrunch.com/2016/09/27/uber-otto-freight-services-2017/?utm_source=buffer',
      timeout: 15000
    })
    .then(function (response) {
      expect(response.amphtml).to.equal('https://techcrunch.com/2016/09/27/uber-otto-freight-services-2017/amp/')
      expect(response.canonical).to.equal('https://techcrunch.com/2016/09/27/uber-otto-freight-services-2017/')
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
      return expect(response.title).to.equal('Discover, collect, and discuss the best of the web')
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
      // returnSource: true,
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
      body: '<html><head><title>something fun</title></head>head><body></body></html>'
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
      expect(response.title).to.equal('Discover, collect, and discuss the best of the web')
      expect(response.source).to.exist
      expect(response.source).to.contain('Mix')
    })
  })

  it('returns data for a valid image url', function () {
    var url = 'https://blogs.scientificamerican.com/blogs/cache/file/D37C6F64-E11B-413B-B4B9D36CF0D7C877.jpg?' +
      'w=590&h=393&77AB39F8-5374-4AE4-93396577281B788A'
    return subject({
      url: url
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

  it('404 error causes a rejection', function () {
    return expect(subject({
      url: 'https://google.com/404'
    })).to.be.rejectedWith('[ERROR] Received non-success status[404]')
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
    })).to.be.rejectedWith('1ms retrieving url')
  })

  it('loads the webpage via request if phantom fails', function () {
    return subject({
      url: 'http://mix.com',
      timeout: 1000,
      fallbackRequest: true
    })
    .then(function (response) {
      expect(response.title).to.equal('Discover, collect, and discuss the best of the web')
    })
  })
})
