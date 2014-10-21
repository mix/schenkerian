## HTML Schenkerian analyzer

[Schenkerian analysis](http://en.wikipedia.org/wiki/Schenkerian_analysis) is a method of musical analysis by interpreting the underlying structure of a tonal work and to help reading the score according to that structure.

This library is that, but for HTML built on top of [Natural Node](https://github.com/NaturalNode/natural) which includes term frequency, string similarities, and tokenizing. Given most webpages (attempt) to use the semantics of HTML, it takes into account not only term frequency, but the weight of an HTML tag, placement in document, and other useful forms of denoting significance (like Open Graph).

### Install

``` sh
$ npm install schenkerian --save
```

### Usage

``` js
var analzye = require('schenkerian')

analyze({
  url: 'http://dustindiaz.com',
  body: '<html>...</html>', // optional. if absent, the module will `request` the given webpage
  pagerank: false // optional
})
.then(function (result) {
  console.log(result)
})
```

### output
``` json
{
"pagerank": 5,
"totalWords": 637,
"permalink": "http://dustindiaz.com/",
"title": "Dustin Diaz",
"relevance": [
    {
      "word": "javascript",
      "score": 1.074,
      "count": 47
    },
    {
      "word": "ender",
      "score": 0.571,
      "count": 25
    },
    {
      "word": "follow",
      "score": 0.228,
      "count": 10
    },
    {
      "word": "css",
      "score": 0.228,
      "count": 10
    },
    {
      "word": "qwery tiny selector",
      "score": 0.14,
      "count": 3
    },
    {
      "word": "open submodule library",
      "score": 0.14,
      "count": 3
    },
    {
      "word": "js open submodule",
      "score": 0.14,
      "count": 3
    },
    {
      "word": "ender js open",
      "score": 0.14,
      "count": 3
    },
    {
      "word": "mvc framework node",
      "score": 0.14,
      "count": 3
    },
    {
      "word": "tiny selector engine",
      "score": 0.14,
      "count": 3
    }
  ]
}
```
