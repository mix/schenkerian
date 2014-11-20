var lodash = require('lodash')
var pagerank = require('./pr')
var Url = require('url')
var commonWords = {}
var gramophone = require('gramophone')
var jsdom = require('jsdom').jsdom
var when = require('when')
var pipeline = require('when/pipeline')
var RE_HTML_JUNK = /<\s*(script|style|nav|footer|label|audio|video)[\s\S]*?>[\s\S]*?<\/\1>/g
var RE_SPACES = /\s+/g
var RE_TITLE_TAG = /<title>([\s\S]+?)<\/title>/
var RE_META_TAGS = /<meta ([\s\S]+?)\/?>/g
var RE_ALPHA_NUM = /[^\w]/g
var RE_BAD_TITLES = /&lt;\/?\w+?&gt;/g
var RE_AMPS = /&amp;/g
var contentRe = /content=(['"])([^\1]+?)(\1)/
var request = require('request').defaults({
  followAllRedirects: true,
  maxRedirects: 12,
  timeout: 3000,
  'headers': {
    'user-agent': 'Schenkerianbot/1.0 (+https://github.com/openlikes/schenkerian)'
  }
})

var commonWordsArray = require('yamljs').load(__dirname + '/common-words.yaml').words

commonWordsArray.forEach(function commonWordAdd(w) {
  commonWords[w] = 1
})

module.exports = function _export(options) {
  var url = options.url
  options.pagerank = options.pagerank || false
  return pipeline([
    getPageRank.bind(null, url, options.pagerank),
    sendToAnalyze.bind(null, url, options.body)
  ])
}
function getPageRank(url, prOption) {
  return when.promise(function promise(resolve, reject) {
    if (prOption === false) return resolve(0)
    var host = Url.parse(url).host
    pagerank.get(host, resolve)
  })
}

function sendToAnalyze (url, bodyOption, pr) {
  return when.promise(function promise(resolve, reject) {
    if (bodyOption) return analyze(bodyOption, pr).then(function (res) { resolve(lodash.extend({pagerank: pr}, res)) })

    request.get(url, function reqCallback(err, res, body) {
      if (err || res.statusCode != '200') return reject(new Error('Webpage could not resolve'))
      analyze(body, pr).then(function (res) {
        resolve(lodash.extend({pagerank: pr}, res))
      })
    })
  })
}

function analyze(body, pr) {
  pr = pr || 5
  var things = gatherMetaTitle(body)
  var map = {}
  return cleanBody(body).then(function (content) {
    var graph = gramophone.extract(content, { score: true, stopWords: commonWordsArray })

    var splitContent = content.split(' ')
    splitContent.forEach(function wordCount(word) {
      map[word] = map[word] || 0
      map[word]++
    })

    // give weight to titles
    lodash.uniq(things.title.replace(RE_SPACES, ' ').split(' ')).forEach(function (word, i, ar) {
      word = word.toLowerCase().trim()
      var n = Math.max(1, 7 - i)
      map[word] = map[word] || 0
      map[word] = map[word] + n
    })

    var totalWords = splitContent.length
    var keywords = compileKeywords(graph, map).splice(0, 30)
    var multiplier = (pr == 10 ? 2 : Number('1.' + pr)) - 0.5
    keywords = keywordsAndScores(keywords, totalWords, multiplier)

    return {
      totalWords: totalWords,
      title: things.title.replace(RE_BAD_TITLES, '').replace(RE_AMPS, '&'),
      image: things.image,
      relevance: keywords
    }
  })
}

function gatherMetaTitle(body) {
  var things = {}
  var meta = body.replace(RE_HTML_JUNK, ' ').match(RE_META_TAGS) || []
  meta.forEach(function metaTag(m) {
    var part
    if (m.match('og:title')) {
      part = m.match(contentRe)
      if (part && part[2]) things.title = part[2]
    }
    if (!things.title) {
      if (m.match('twitter:title') ||
        m.match(/name=['"]?title['"]?/)) {
        part = m.match(contentRe)
        if (part && part[2]) things.title = part[2]
      }
    }

    if (!things.image) {
      if (m.match('twitter:image:src') ||
        m.match('og:image')) {
        part = m.match(contentRe)
        if (part && part[2]) things.image = part[2]
      }
    }
  })

  if (!things.title) {
    var title = body.match(RE_TITLE_TAG)
    things.title = title ? title[1] : 'Untitled'
  }
  return things
}

function cleanBody(body) {
  var doc
  try {
    doc = jsdom(body, {
      features: {
        FetchExternalResources: false,
        ProcessExternalResources : false
      }
    })
  } catch (e) {
    return ''
  }
  var window = doc && doc.parentWindow
  if (!window || !window.document || !window.document.body) return ''

  var dom = window.document
  return pipeline([
    removeTagFromDOM.bind(null, 'script'),
    removeTagFromDOM.bind(null, 'style'),
    removeTagFromDOM.bind(null, 'nav'),
    removeTagFromDOM.bind(null, 'footer'),
    removeTagFromDOM.bind(null, 'label'),
    removeTagFromDOM.bind(null, 'audio'),
    removeTagFromDOM.bind(null, 'video'),

    removeClassFromDOM.bind(null, 'footer'),
    removeClassFromDOM.bind(null, 'nav'),

    removeIdFromDOM.bind(null, 'footer'),
    removeIdFromDOM.bind(null, 'nav')
  ], dom)
  .then(function (res) {
    return selectBodySuccess(res.body.textContent)
  })
}

function removeTagFromDOM(tagName, dom) {
  ([]).slice.call(dom.getElementsByTagName(tagName)).forEach(function (i) { i.parentNode.removeChild(i) })
  return dom
}

function removeClassFromDOM(className, dom) {
  ([]).slice.call(dom.getElementsByClassName(className)).forEach(function (i) { i.parentNode.removeChild(i) })
  return dom
}

function removeIdFromDOM(id, dom) {
  var el = dom.getElementById(id)
  if (el) el.parentNode.removeChild(el)
  return dom
}

function selectBodySuccess(body) {
  var content = body.replace(RE_ALPHA_NUM, ' ')
  return content.split(' ').map(function lowerCaseAndTrim(word) {
    return word.toLowerCase().replace(/[\d'"”<>\/]/g, ' ').trim()
  })
  .filter(function commonWordFilter(word) {
    return !commonWords[word]
  })
  .join(' ')
  .replace(RE_SPACES, ' ')
}

function compileKeywords(graph, map) {
  return lodash.map(graph, function graphMap(item) {
    return {
      word: item.term,
      count: item.tf + (map[item.term] ? map[item.term] : 0)
    }
  })
  .filter(function nonWordFilter(item) {
    return !(/^\w[\w -]+$/i).test(item.word) || !(/^\d+$/).test(item.word)
  })
}

function keywordsAndScores(keywords, totalWords, multiplier) {
  return keywords.map(function getWordScores(el, i, ar) {
    var first = ar[0].count
    var phraseLen = Math.max(1, el.word.split(' ').length * 0.68)
    var score = (((el.count / first) + (el.count / totalWords)) * multiplier) * phraseLen
    return {
      word: el.word,
      score: Math.round(score * 1000) / 1000,
      count: el.count
    }
  })
  .sort(function scoreSorter(a, b) {
    return b.score - a.score
  })
}
