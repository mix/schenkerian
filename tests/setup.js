var chai = require('chai')
  , sinonChai = require('sinon-chai')
  , promised = require('chai-as-promised')

global.expect = chai.expect
global.noop = function () {
  return function () {}
}
global.sinon = require('sinon')
chai.use(promised)
chai.use(sinonChai)

process.on('uncaughtException', function (err) {
  console.error('Uncaught exception', err, err.stack)
  process.exit(3)
})
