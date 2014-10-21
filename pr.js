var PageRank = require('pagerank')

module.exports.get = function (domain, callback) {
  new PageRank(domain, function (err, rank) {
    if (err || !rank) callback(null, 0)
    if (!err) {
      rank = rank || 0
      callback(null, rank)
    }
  })
}
