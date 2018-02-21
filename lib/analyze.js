const _ = require('lodash')
const Promise = require('bluebird')
const Url = require('url')
const commonWords = {}
const gramophone = require('gramophone')
const Parser = require('htmlparser2').WritableStream
const Cornet = require('cornet')
const Readable = require('stream').Readable
const cheerio = require('cheerio')
const RE_SPACES = /\s+/g
const RE_ALPHA_NUM = /[^\w]/g
const RE_BAD_TITLES = /&lt;\/?\w+?&gt;/g
const RE_AMPS = /&amp;/g
const TfIdf = require('natural').TfIdf
const path = require('path')

const commonWordsArray = require('yamljs').load(path.join(__dirname, '../config/common-words.yaml')).words

commonWordsArray.forEach(w => {
  commonWords[w] = 1
})

/**
 * analyze gets metadata, cleans the content from a body of html
 * and does some basic natural language analysis on the body of html
 *
 * Optional returnSource parameter will put the cleaned source in the
 * returned object from the promise.
 *
 * metadata returned includes:
 *   - title
 *   - description
 *   - image
 *   - amp url
 *   - canonical url from html
 *
 * content is cleaned of html tags
 * if returnSource is not specified, the content is also cleaned of stop words
 *
 * @param url
 * @param body
 * @param returnSource
 * @returns {PromiseLike<T> | Promise<T>}
 */
module.exports = function (url, body, returnSource) {
  return Promise.all([
    gatherMetaData(url, body),
    cleanBody(body)
    .then(result => {
      if (!returnSource) {
        return removeCommonWords(result)
      }
      return result
    })
  ])
  .spread((things, content) => {
    return _.merge(
      wordAnalysis(things.title, content),
      _.pick(things, ['image',  'amphtml', 'canonical']),
      {
        title: things.title.replace(RE_BAD_TITLES, '').replace(RE_AMPS, '&'),
        description: things.description ? things.description.replace(RE_BAD_TITLES, '').replace(RE_AMPS, '&') : '',
      }
    )
  })
  .then(results => {
    if (returnSource) {
      return removeScript(body)
      .then(rsBody =>
        _.merge(results, {
          source: rsBody
        })
      )
    }
    return results
  })
}

function wordAnalysis(title, content) {
  let graph = gramophone.extract([title, content].join(' '), {
    score: true,
    stopWords: commonWordsArray,
    stem: true,
    limit: 20
  })
  let tfidf = new TfIdf()
  tfidf.addDocument([title, content].join(' '))
  let tfGraph = graph.map(item =>
    _.merge({
      score: tfidf.tfidf(item.term, 0)
    }, item)
  )
  tfGraph = _.filter(tfGraph, item => item.term !== '')

  return {
    totalWords: content.split(' ').length,
    relevance: tfGraph
  }
}

function gatherMetaData(url, body) {
  return parseDom(body, 'head', removeHeadSelectors.join(','))
  .then(parsedBody => {
    let cheerioBody = cheerio(parsedBody)
    let title
    cheerioBody.find('meta[property="og:title"], meta[property="twitter:title"]').each((i, elem) => {
      if (!title) title = cheerio(elem).attr('content')
    })
    if (!title) {
      cheerioBody.find('title').each((i, elem) => {
        title = cheerio(elem).text()
      })
    }

    let image
    cheerioBody.find('meta[property="og:image"], meta[property="twitter:image:src"]').each((i, elem) => {
      let elemContent = cheerio(elem).attr('content')
      if (!image) image = elemContent && elemContent.trim()
    })
    if (image) {
      let host = Url.parse(url).host
      if (!(/^(http(s)?\:)?\/\//i).test(image) && !(new RegExp(host, 'i')).test(image)) {
        image = 'http://' + host + '/' + image
      }
      if ((/^\/\//).test(image)) image = 'http:' + image
      image = image.replace(RE_AMPS, '&')
    }

    let getSimpleValue = function (cheerioTagQuery, targetAttribute) {
      let foundValue

      cheerioBody.find(cheerioTagQuery).each((i, elem) => {
        let elemContent = cheerio(elem).attr(targetAttribute)
        foundValue = elemContent && elemContent.trim()
      })

      return foundValue
    }

    return {
      title: (title && title.trim()) || 'Untitled',
      image: image,
      description: getSimpleValue('meta[property="og:description"]', 'content'),
      amphtml: getSimpleValue('link[rel="amphtml"]', 'href'),
      canonical: getSimpleValue('link[rel="canonical"]', 'href')
    }
  })
}

function cleanBody(body) {
  return parseDom(body, 'body', removeBodySelectors.join(','))
  .then(parsedBody => cheerio(parsedBody).text().replace(RE_SPACES, ' '))
}

function removeScript(body) {
  return parseDom(body, 'html', removeBaseSelectors.join(','))
  .then(parsedBody => cheerio(parsedBody).html().replace(RE_SPACES, ' '))
}

function parseDom(body, elementSelector, removeSelector) {
  return new Promise(resolve => {
    let cornet = new Cornet()
    let stream = new Readable()

    stream.push(body)
    stream.push(null)

    stream.pipe(new Parser(cornet))
    cornet.remove(removeSelector)

    cornet.select(elementSelector, parsedBody => {
      cornet.removeAllListeners()
      cornet = null
      resolve(parsedBody)
    })
  }).timeout(1000, 'Timed out trying to get ' + elementSelector + ' element')
}

function removeCommonWords(bodyText) {
  return new Promise(resolve => {
    let content = bodyText.replace(RE_ALPHA_NUM, ' ')
    resolve(
      content.split(' ')
      .map(word => word.toLowerCase().replace(/[\d'"”<>\/]/g, ' ').trim())
      .filter(word => !commonWords[word])
      .join(' ')
      .replace(RE_SPACES, ' ')
    )
  })
}


// Lists of dom elements for removal in different sections
// Place these lists at the bottom for readability
const removeBaseSelectors = [
  'script'
, 'style'
, 'noscript'
, 'iframe'
, 'nav'
, 'footer'
]

const removeHeadSelectors = [
  'label'
, 'audio'
, 'video'
, 'aside'
].concat(removeBaseSelectors)

const removeBodySelectors = [
  'head'
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
].concat(removeBaseSelectors)
