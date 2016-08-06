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

  it('should work on a webpage', function () {
    return subject({
      url: 'http://mix.com'
    })
    .then(function (response) {
      expect(response.url).to.equal('http://mix.com')
      expect(response.title).to.equal('Discover, collect, and discuss the best of the web')
      expect(response.description).to.equal('Connecting the curious & creative.')
      expect(response.image).to.exist
    })
  })

  it('should work on a webpage when given an agent', function () {
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

  it('should work when given a body', function () {
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
