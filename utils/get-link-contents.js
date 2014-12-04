var q = require('q');
var request = require('request');

module.exports = function getLinkContents(linkUrl, options) {
  var d = q.defer();

  request({ url: linkUrl, timeout: options.timeout, gzip: true }, function(error, response, body) {
    if (error) {
      d.reject(error);
    }

    d.resolve(body);
  });

  return d.promise;
};
