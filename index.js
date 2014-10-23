var v = require('valentine')
var pagerank = require('./pr')
var URL = require('url')
var util = require('util')
var commonWords = {}
var gramophone = require('gramophone')
var when = require('when')
var RE_HTML = /<\/?\!?\w[\s\S]*?>/g
var RE_HTML_JUNK = /<(script|style|nav|footer|label|audio|video)[\s\S]*?>[\s\S]*?<\/\1>/g
var RE_HTML_COMMENTS = /<!--[\s\S]+?-->/g
var RE_HTML_ENTITIES = /&[\w#]+;/g
var RE_NEWLINES = /\n+/g
var RE_SPACES = /\s+/g
var RE_TITLE_TAG = /<title>([\s\S]+?)<\/title>/
var RE_META_TAGS = /<meta ([\s\S]+?)\/?>/g
var request = require('request').defaults({
  followAllRedirects: true,
  maxRedirects: 12,
  timeout: 3000,
  'headers': {
    'user-agent': 'Schenkerianbot/1.0 (+https://github.com/openlikes/schenkerian)'
  }
})

var contentRe = /content=(['"])([^\1]+?)(\1)/

var commonWordsArray = require('yamljs').load(__dirname + '/common-words.yaml').words

commonWordsArray.forEach(function (w) {
  commonWords[w] = 1
})

module.exports = function (options) {
  var url = options.url
  options.pagerank = options.pagerank || false
  return when.promise(function (resolve, reject) {
    v.waterfall(
      function (next) {
        if (options.pagerank === false) return next(null, 0)
        var host = URL.parse(url).host
        pagerank.get(host, next)
      },
      function (pr, next) {
        if (options.body) return next(null, pr, analyze(options.body, pr))
        request.get(url, function (err, res, body) {
          if (err || res.statusCode != '200') return next(new Error('Webpage could not resolve'))
          next(null, pr, analyze(body, pr))
        })
      },
      function (err, pagerank, analyzed) {
        if (err) return reject(err)
        resolve(v.extend({ pagerank: pagerank }, analyzed))
      }
    )
  })
}

function analyze(body, pr) {
  pr = pr || 5
  var things = gatherMetaTitle(body)
  var map = {}
  var content = cleanBody(body)

  var graph = gramophone.extract(content, { score: true, stopWords: commonWordsArray })

  var splitContent = content.split(' ')
  splitContent.forEach(function (word) {
    map[word] = map[word] || 0
    map[word]++
  })

  // give weight to titles
  v(things.title.replace(RE_SPACES, ' ').split(' ')).uniq().forEach(function (word, i, ar) {
    word = word.toLowerCase().trim()
    var n = Math.max(1, 7 - i)
    map[word] = map[word] || 0
    map[word] = map[word] + n
  })

  var totalWords = splitContent.length
  var keywords = compileKeywords(graph, map).splice(0, 30)
  var multiplier = (pr == 10 ? 2 : Number('1.' + pr)) - .5
  keywords = keywordsAndScores(keywords, totalWords, multiplier)

  return {
    totalWords: totalWords,
    title: things.title,
    image: things.image,
    relevance: keywords
  }
}

function gatherMetaTitle(body) {
  var things = {}
  var meta = body.replace(RE_HTML_JUNK, ' ').match(RE_META_TAGS) || []
  meta.forEach(function (m) {
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
  var content = body
    .replace(RE_HTML_JUNK, ' ')
    .replace(RE_HTML, ' ')
    .replace(RE_HTML_ENTITIES, ' ')
    .replace(RE_HTML_COMMENTS, ' ')
    .replace(RE_NEWLINES, '\n')
    .replace(RE_SPACES, ' ')

  return content.split(' ').map(function (word) {
    return word.toLowerCase().replace(/[\d'"”<>\/]/g, ' ').trim()
  })
  .filter(function commonWordFilter(word) {
    return !commonWords[word]
  })
  .join(' ')
}

function compileKeywords(graph, map) {
  return v(graph).map(function (item) {
    return {
      word: item.term,
      count: item.tf
    }
  })
  .map(function (item) {
    return {
      word: item.word,
      count: item.count + (map[item.word] ? map[item.word] : 0)
    }
  })
  .filter(function nonWordFilter(item) {
    return !!item.word.match(/^\w[\w -]+$/i)
  })
  .filter(function nonNumberFilter(item) {
    return !item.word.match(/^\d+$/)
  })
}

function keywordsAndScores(keywords, totalWords, multiplier) {
  return keywords.map(function (el, i, ar) {
    var first = ar[0].count
    var phraseLen = Math.max(1, el.word.split(' ').length * .68)
    var score = (((el.count / first) + (el.count / totalWords)) * multiplier) * phraseLen
    return {
      word: el.word,
      score: Math.round(score * 1000) / 1000,
      count: el.count
    }
  })
  .sort(function (a, b) {
    return b.score - a.score
  })
}
