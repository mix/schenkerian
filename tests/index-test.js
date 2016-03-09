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

  it('should work on a webpage', function () {
    return subject({
      url: 'http://dustindiaz.com'
    })
    .then(function (response) {
      return when.all([
        expect(response.title).to.equal('Dustin Diaz'),
        expect(response.pagerank).to.equal(0)
      ])
    })
  })

  it('should work on a webpage when given an agent', function () {
    return subject({
      url: 'http://dustindiaz.com',
      agent: {
        agentClass: http.Agent
      }
    })
    .then(function (response) {
      return when.all([
        expect(response.title).to.equal('Dustin Diaz'),
        expect(response.pagerank).to.equal(0)
      ])
    })
  })

  it('should work when given a body', function () {
    return subject({
      url: 'http://dustindiaz.com',
      body: '<html><title>something fun</title><body></body></html>'
    })
    .then(function (response) {
      return expect(response.title).to.equal('something fun')
    })
  })

  it('returns a pagerank when required', function () {
    return subject({
      url: 'http://dustindiaz.com',
      pagerank: true
    })
    .then(function (response) {
      return when.all([
        expect(response.title).to.equal('Dustin Diaz'),
        expect(response.pagerank).to.equal(5)
      ])
    })
  })

  it('returns the source content when required', function () {
    return subject({
      url: 'http://dustindiaz.com',
      returnSource: true
    })
    .then(function (response) {
      return when.all([
        expect(response.title).to.equal('Dustin Diaz'),
        expect(response.source).to.exist,
        expect(response.source).to.contain('dustin diaz')
      ])
    })
  })

  it('rejects no body element exists', function () {
    return expect(subject({
      url: 'http://dustindiaz.com',
      body: '<html><title>something fun</title></html>'
    })).to.be.rejectedWith('Timed out trying to get body element')
  })
})
