var subject = require('../')

describe('The analyzer', function () {
  it('should work', function (done) {
    return subject({
      url: 'http://dustindiaz.com'
    })
    .then(function (response) {
      expect(response.title).to.equal('Dustin Diaz')
      done()
    })
  })
})
