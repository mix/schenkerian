var subject = require('../')

describe('The analyzer', function () {
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
      console.log(response)
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
      console.log(response)
      expect(response.title).to.equal('Dustin Diaz')
      expect(response.pagerank).to.equal(5)
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
