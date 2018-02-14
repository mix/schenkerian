const Promise = require('bluebird')
const spawn = require('child_process').spawn
const phantomjs = require('phantomjs-prebuilt')
const path = require('path')
const phantomFile = path.join(__dirname, 'phantom-load.js')

module.exports = function (url, options) {
  var child, output = []

  return new Promise((resolve, reject) => {
    let childArgs = [
      '--ignore-ssl-errors=true',
      '--load-images=false'
    ]
    if (options.agentOptions) {
      childArgs.push('--proxy=' + options.agentOptions.socksHost + ':' + options.agentOptions.socksPort)
    }
    childArgs = childArgs.concat([
      phantomFile,
      url,
      options.userAgent,
      options.maxRedirects,
      options.timeout
    ])

    if (options.jar) childArgs.push(JSON.stringify(options.jar))
    child = spawn(phantomjs.path, childArgs)

    child.stdout.on('data', stdout => {
      output.push(stdout.toString().trim())
    })

    child.on('close', exitCode => {
      if (exitCode === 0) {
        resolve({
          url: output[0],
          body: output.slice(1).join('')
        })
      } else {
        if ((/\[error\]/i).test(output)) {
          reject(new Error(output.join('')))
        } else {
          reject(new Error('Error occurred scraping ' + url))
        }
      }
      child = null
    })

    child.on('error', err => {
      reject(err)
    })

    process.on('exit', () => {
      if (child) {
        child.kill()
        reject(new Error('Process terminated. Canceling child process retrieving url[' + url + ']'))
      }
    })

    setTimeout(() => {
      if (child) {
        child.kill()
        reject(new Error('Process exceeded timeout of ' + (options.timeout + 1000) + 'ms retrieving url[' + url + ']'))
      }
    }, options.timeout + 1000)
  })
}

