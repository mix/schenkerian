var proxy = require('proxyquire')
var http = require('http')
var when = require('when')

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
      return when.all([
        expect(response.title).to.equal('Discover, collect, and discuss the best of the web'),
        expect(response.description).to.equal('Connecting the curious & creative.'),
        expect(response.image).to.exist,
        expect(response.pagerank).to.equal(0)
      ])
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
      return when.all([
        expect(response.title).to.equal('Discover, collect, and discuss the best of the web'),
        expect(response.pagerank).to.equal(0)
      ])
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

  it('returns a pagerank when required', function () {
    return subject({
      url: 'http://mix.com',
      pagerank: true
    })
    .then(function (response) {
      return when.all([
        expect(response.title).to.equal('Discover, collect, and discuss the best of the web'),
        expect(response.pagerank).to.equal(1)
      ])
    })
  })

  it('returns the source content when required', function () {
    return subject({
      url: 'http://mix.com',
      returnSource: true
    })
    .then(function (response) {
      return when.all([
        expect(response.title).to.equal('Discover, collect, and discuss the best of the web'),
        expect(response.source).to.exist,
        expect(response.source).to.contain('Mix')
      ])
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
})
