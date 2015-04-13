var proxy = require('proxyquire')

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
      url: 'http://dustindiaz.com'
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
      url: 'http://dustindiaz.com'
    })).to.be.rejectedWith('Some Error')
  })

  it('be rejected when request returns an empty string', function () {
    var loadStub = sinon.stub()
    subject = proxy('../', {
      'request': {
        defaults: function () {
          return {get: loadStub}
        }
      }
    })

    loadStub.callsArgWith(1, null, {statusCode: 200}, '')
    return expect(subject({
      url: 'http://dustindiaz.com'
    })).to.be.rejectedWith('Webpage could not resolve')
  })

  it('should work on a webpage', function (done) {
    return subject({
      url: 'http://dustindiaz.com'
    })
    .then(function (response) {
      expect(response.title).to.equal('Dustin Diaz')
      expect(response.pagerank).to.equal(0)
      done()
    })
  })
  it('should work when given a body', function (done) {
    return subject({
      url: 'http://dustindiaz.com',
      body: '<html><title>something fun</title><body></body></html>'
    })
    .then(function (response) {
      expect(response.title).to.equal('something fun')
      done()
    })
  })

  it('returns a pagerank when required', function (done) {
    return subject({
      url: 'http://dustindiaz.com',
      pagerank: true
    })
    .then(function (response) {
      expect(response.title).to.equal('Dustin Diaz')
      expect(response.pagerank).to.equal(5)
      done()
    })
  })

  it('returns the source content when required', function (done) {
    return subject({
      url: 'http://dustindiaz.com',
      returnSource: true
    })
    .then(function (response) {
      expect(response.title).to.equal('Dustin Diaz')
      expect(response.source).to.exist
      expect(response.source).to.contain('dustin diaz')
      done()
    })
  })

  it('rejects no body element exists', function () {
    return expect(subject({
      url: 'http://dustindiaz.com',
      body: '<html><title>something fun</title></html>'
    })).to.be.rejectedWith('Timed out trying to get body element')
  })
})
