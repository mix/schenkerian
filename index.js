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
var RE_TITLE_TAG = /<title>([\s\S]+?)<\/title>/
var RE_META_TAGS = /<meta ([\s\S]+?)\/?>/g
var RE_ALPHA_NUM = /[^\w]/g
var RE_BAD_TITLES = /&lt;\/?\w+?&gt;/g
var RE_AMPS = /&amp;/g
var contentRe = /content=(['"])([^\1]*?)(\1)/
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
  return renderPage(url, _.merge(requestOptions, defaultReqOptions).headers['user-agent'])
  .then(function (results) {
    endUrl = results.url
    return sendToAnalyze(endUrl, results.body, prOption, returnSource)
  })
  .then(function (res) {
    return _.merge({url: endUrl}, res)
  })
}
function renderPage(url, userAgent) {
  return when.promise(function promise(resolve, reject) {
    var childArgs = [
      path.join(__dirname, 'phantom-load.js'),
      url,
      userAgent
    ]

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
  var things = gatherMetaTitle(url, body)
  var promises = [cleanBody.bind(null, body)]
  if (!returnSource) promises.push(removeCommonWords)
  return pipeline(promises)
  .then(function (content) {
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

function gatherMetaTitle(url, body) {
  var things = {}
  var meta = body.match(RE_META_TAGS) || []
  meta.forEach(function metaTag(m) {
    var part

    if (m.match('\"og:title\"')) {
      part = m.match(contentRe)
      if (part && part[2]) things.title = part[2]
    }

    if (!things.title) {
      if (m.match('\"twitter:title\"') ||
        m.match(/name=['"]?title['"]?/)) {
        part = m.match(contentRe)
        if (part && part[2]) things.title = part[2]
      }
    }

    if (!things.image) {
      if (m.match('\"twitter:image:src\"') || m.match('\"og:image\"')) {
        part = m.match(contentRe)
        if (part && part[2] && !(/\.svg$/i).test(part[2])) {
          things.image = part[2] && part[2].trim()
          var host = Url.parse(url).host
          if (!(/^(http(s)?\:)?\/\//i).test(things.image) && !(new RegExp(host, 'i')).test(things.image)) {
            things.image = 'http://' + host + '/' + things.image
          }
          if ((/^\/\//).test(things.image)) things.image = 'http:' + things.image
        }
      }
    }

    if (m.match('\"og:description\"')) {
      part = m.match(contentRe)
      if (part && part[2]) things.description = part[2]
    }
  })

  if (!things.title) {
    var title = body.match(RE_TITLE_TAG)
    things.title = title ? title[1] : 'Untitled'
  }
  return things
}

function cleanBody(body) {
  return when.promise(function (resolve, reject) {
    var cornet = new Cornet()
    var stream = new Readable()

    stream.push(body)
    stream.push(null)

    stream.pipe(new Parser(cornet))

    cornet.remove([
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
    ].join(','))

    cornet.select('body', function (parsedBody) {
      cornet.removeAllListeners()
      cornet = null
      resolve(parsedBody)
    })
  }).timeout(1000, 'Timed out trying to get body element')
  .then(function (parsedBody) {
    return cheerio(parsedBody).text()
  })
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
