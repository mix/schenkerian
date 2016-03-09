var _ = require('lodash')
var pagerank = require('./pr')
var Url = require('url')
var commonWords = {}
var gramophone = require('gramophone')
var Parser = require('htmlparser2').WritableStream
var Cornet = require('cornet')
var Readable = require('stream').Readable
var cheerio = require('cheerio')
var when = require('when')
var pipeline = require('when/pipeline')
var RE_SPACES = /\s+/g
var RE_ALPHA_NUM = /[^\w]/g
var RE_BAD_TITLES = /&lt;\/?\w+?&gt;/g
var RE_AMPS = /&amp;/g
var TfIdf = require('natural').TfIdf
var path = require('path')
var childProcess = require('child_process')
var phantomjs = require('phantomjs-prebuilt')

var defaultReqOptions = {
  maxRedirects: 30,
  'headers': {
    'user-agent': 'Schenkerianbot/1.0 (+https://github.com/mix/schenkerian)'
  }
}

var commonWordsArray = require('yamljs').load(__dirname + '/common-words.yaml').words

commonWordsArray.forEach(function commonWordAdd(w) {
  commonWords[w] = 1
})

module.exports = function _export(options) {
  var url = options.url
  var pagerank = options.pagerank || false
  if (options.body) {
    return sendToAnalyze(url, options.body, pagerank)
  } else {
    return requestAndSendToAnalyze(url, pagerank, options.returnSource, options.agent)
  }
}

function requestAndSendToAnalyze(url, prOption, returnSource, agentOptions) {
  var requestOptions = {url: url}
  if (agentOptions) {
    requestOptions.agentClass = agentOptions.agentClass
    requestOptions.agentOptions = {
      socksHost: agentOptions.socksHost,
      socksPort: agentOptions.socksPort
    }
  }

  var endUrl
  return renderPage(url, _.merge(requestOptions, defaultReqOptions))
  .then(function (results) {
    endUrl = results.url
    return sendToAnalyze(endUrl, results.body, prOption, returnSource)
  })
  .then(function (res) {
    return _.merge({url: endUrl}, res)
  })
}
function renderPage(url, options) {
  return when.promise(function promise(resolve, reject) {
    var childArgs = ['--ignore-ssl-errors=true']
    if (options.agentOptions) {
      childArgs.push('--proxy=' + options.agentOptions.socksHost + ':' + options.agentOptions.socksPort)
    }
    childArgs = childArgs.concat([
      path.join(__dirname, 'phantom-load.js'),
      url,
      options.headers['user-agent'],
      options.maxRedirects
    ])

    childProcess.execFile(phantomjs.path, childArgs, function(err, stdout, stderr) {
      var output = stdout ? stdout.split('\n') : []
      if (err && err.code === 1) reject(new Error(stderr))
      else resolve({url: output[0], body: output.slice(1).join('')})
    })
  })
}

function sendToAnalyze (url, bodyOption, callPR, returnSource) {
  return getPageRank(url, callPR)
  .then(function (pr) {
    return analyze(url, bodyOption, pr, returnSource)
    .then(function (res) {
      return _.merge({pagerank: pr}, res)
    })
  })
}

function getPageRank(url, prOption) {
  return when.promise(function promise(resolve, reject) {
    if (prOption === false) return resolve(0)
    var host = Url.parse(url).host
    pagerank.get(host, resolve)
  })
}

function analyze(url, body, pr, returnSource) {
  pr = pr || 5
  var promises = [cleanBody.bind(null, body)]
  if (!returnSource) promises.push(removeCommonWords)
  return when.all([
    gatherMetaData(url, body),
    pipeline(promises)
  ])
  .then(function (data) {
    var things = data[0]
    var content = data[1]
    var results = {}
    if (returnSource) {
      results = { source: content }
    } else {
      var graph = gramophone.extract([things.title, content].join(' '), {
        score: true,
        stopWords: commonWordsArray,
        stem: true,
        limit: 20
      })
      var tfidf = new TfIdf()
      tfidf.addDocument([things.title, content].join(' '))
      var tfGraph = graph.map(function (item) {
        item.score = tfidf.tfidf(item.term, 0)
        return item
      })
      tfGraph = _.filter(tfGraph, function (item) {
        return item.term !== ''
      })

      results = {
        totalWords: content.split(' ').length,
        relevance: tfGraph
      }
    }

    return _.merge(results, {
      title: things.title.replace(RE_BAD_TITLES, '').replace(RE_AMPS, '&'),
      description: things.description ? things.description.replace(RE_BAD_TITLES, '').replace(RE_AMPS, '&') : '',
      image: things.image
    })
  })
}

function gatherMetaData(url, body) {
  var removeSelectors = [
    'script'
  , 'noscript'
  , 'style'
  , 'iframe'
  , 'nav'
  , 'footer'
  , 'label'
  , 'audio'
  , 'video'
  , 'aside'
  ]

  return parseDom(body, 'head', removeSelectors.join(','))
  .then(function (parsedBody) {
    var cheerioBody = cheerio(parsedBody)
    var title
    cheerioBody.find('meta[property="og:title"], meta[property="twitter:title"]').each(function (i, elem) {
      if (!title) title = cheerio(elem).attr('content').trim()
    })
    if (!title) {
      cheerioBody.find('title').each(function (i, elem) {
        title = cheerio(elem).text().trim()
      })
    }

    var image
    cheerioBody.find('meta[property="og:image"], meta[property="twitter:image:src"]').each(function (i, elem) {
      if (!image) image = cheerio(elem).attr('content').trim()
    })
    if (image) {
      var host = Url.parse(url).host
      if (!(/^(http(s)?\:)?\/\//i).test(image) && !(new RegExp(host, 'i')).test(image)) {
        image = 'http://' + host + '/' + image
      }
      if ((/^\/\//).test(image)) image = 'http:' + image
    }

    var description
    cheerioBody.find('meta[property="og:description"]').each(function (i, elem) {
      description = cheerio(elem).attr('content').trim()
    })

    return {
      title: title || 'Untitled',
      image: image,
      description: description
    }
  })
}

function cleanBody(body) {
  var removeSelectors = [
    'head'
  , 'script'
  , 'noscript'
  , 'style'
  , 'iframe'
  , 'nav'
  , 'footer'
  , 'label'
  , 'audio'
  , 'video'
  , 'aside'
  , '[class*=google]'
  , '[id*=google]'
  , '[class*=facebook]'
  , '[id*=facebook]'
  , '[class*=twitter]'
  , '[id*=twitter]'
  , '[class*=email]'
  , '[id*=email]'
  , '[class*=footer]'
  , '[id*=footer]'
  , '[class*=header]'
  , '[id*=header]'
  , '[class^=side]'
  , '[id^=side]'
  , '[class*=comments]'
  , '[id*=comments]'
  , '[class*=share]'
  , '[id*=share]'
  , '[class*=social]'
  , '[id*=social]'
  , '[class*=nav]'
  , '[id*=nav]'
  , '[class*=sponsored]'
  , '[id*=sponsored]'
  , '[class*=widget]'
  , '[id*=widget]'
  , '[class*=ad]'
  , '[id*=ad]'
  , '[class*=promo]'
  , '[id*=promo]'
  , '[class*=banner]'
  , '[id*=banner]'
  , '[class*=abridged]'
  , '[id*=abridged]'
  , '[class*=news]'
  , '[id*=news]'
  , '[class*=highlight]'
  , '[id*=highlight]'
  , '[class*=copyright]'
  , '[id*=copyright]'
  , '[class*=popular]'
  , '[id*=popular]'
  , '[class*=prev]'
  , '[id*=prev]'
  , '[class*=next]'
  , '[id*=next]'
  , '[class^=right]'
  , '[id^=right]'
  , '[class*=link]'
  , '[id*=link]'
  , '[style*="display: none"]'
  ]

  return parseDom(body, 'body', removeSelectors.join(','))
  .then(function (parsedBody) {
    return cheerio(parsedBody).text()
  })
}

function parseDom(body, elementSelector, removeSelector) {
  return when.promise(function (resolve, reject) {
    var cornet = new Cornet()
    var stream = new Readable()

    stream.push(body)
    stream.push(null)

    stream.pipe(new Parser(cornet))
    cornet.remove(removeSelector)

    cornet.select(elementSelector, function (parsedBody) {
      cornet.removeAllListeners()
      cornet = null
      resolve(parsedBody)
    })
  }).timeout(1000, 'Timed out trying to get ' + elementSelector + ' element')
}
function removeCommonWords(bodyText) {
  return when.promise(function (resolve, reject) {
    var content = bodyText.replace(RE_ALPHA_NUM, ' ')
    resolve(
      content.split(' ')
      .map(function lowerCaseAndTrim(word) {
        return word.toLowerCase().replace(/[\d'"”<>\/]/g, ' ').trim()
      })
      .filter(function commonWordFilter(word) {
        return !commonWords[word]
      })
      .join(' ')
      .replace(RE_SPACES, ' ')
    )
  })
}
