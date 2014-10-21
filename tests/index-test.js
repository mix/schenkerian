var subject = require('../')

describe('The analyzer', function () {
  it('should work on a webpage', function (done) {
    return subject({
      url: 'http://dustindiaz.com'
    })
    .then(function (response) {
      expect(response.title).to.equal('Dustin Diaz')
      done()
    })
  })
  it('should work when given a body', function (done) {
    return subject({
      url: 'http://dustindiaz.com',
      body: '<title>something fun</title>'
    })
    .then(function (response) {
      console.log(response)
      expect(response.title).to.equal('something fun')
      done()
    })
  })
})
