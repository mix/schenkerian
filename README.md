## HTML Schenkerian analyzer

[http://en.wikipedia.org/wiki/Schenkerian_analysis](Schenkerian analysis) is a method of musical analysis by interpreting the underlying structure of a tonal work and to help reading the score according to that structure.

This library is that, but for HTML built on top of [https://github.com/NaturalNode/natural](Natural Node) which includes term frequency, string similarities, and tokenizing. Given most webpages (attempt) to use the semantics of HTML, it takes into account not only term frequency, but the weight of an HTML tag, placement in document, and other useful forms of denoting significance (like Open Graph).

### install

``` sh
$ npm install schenkerian --save
```

### Usage

``` js
var analzye = require('schenkerian')

analyze({
  url: 'http://example.com',
  body: '<html>...</html>',
  pagerank: false
})
.then(function (result) {
  console.log(result)
})
```
