var q = require('q');
var request = require('request');

module.exports = function getLinkContents(link, options) {
  var d = q.defer();

  request({ url: link, timeout: options.timeout, gzip: true }, function(error, response, body) {
    if (error) {
      d.reject(error);
    }

    d.resolve(body);
  });

  return d.promise;
};
