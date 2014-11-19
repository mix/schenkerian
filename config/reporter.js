module.exports = {
  reporter: function (res) {
    var len = res.length
      , str = ''

    res.forEach(function (r) {
      var file = r.file
        , err = r.error

      if (err.reason.match('a reserved word')) {
        return --len
      }
      if (err.reason.match('to have an indentation at')) {
        return --len
      }
      str += file + ': line ' + err.line + ', col ' +
      err.character + ', ' + err.reason + '\n'
    })

    if (str) {
      process.stdout.write(str + '\n' + len + ' error' +
      ((len === 1) ? '' : 's') + '\n')
      process.exit(1)
    } else {
      process.stdout.write('Rock on. No Lint errors\n')
      process.exit(0)
    }
  }
}
