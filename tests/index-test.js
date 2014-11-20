var proxy = require('proxyquire')

describe('The analyzer', function () {
  var subject
  beforeEach(function () {
    subject = require('../')
  })

  it('be rejected when parsing with jsdom throws an error on a webpage', function (done) {
    var loadStub = sinon.stub()
    subject = proxy('../', {
      'jsdom': {
        jsdom: loadStub
      }
    })

    loadStub.throws(new Error('Some Error'))
    return subject({
      url: 'http://dustindiaz.com'
    })
    .then(function (response) {
      expect(response.title).to.equal('Dustin Diaz')
      expect(response.pagerank).to.equal(0)
      done()
    })
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

  it('resolves if no body element exists', function (done) {
    return subject({
      url: 'http://dustindiaz.com',
      body: '<html><title>something fun</title></html>'
    })
    .then(function (response) {
      expect(response.title).to.equal('something fun')
      done()
    })
  })

  it('resolves if no inner html element exists', function (done) {
    return subject({
      url: 'http://dustindiaz.com',
      body: '<html></html>'
    })
    .then(function (response) {
      expect(response.title).to.equal('Untitled')
      done()
    })
  })
})
