const q = require('q');
const request = require('request');

module.exports = function getLinkContents(linkUrl, options) {
  const d = q.defer();

  request({ url: linkUrl, timeout: options.timeout, gzip: true }, (error, response, body) => {
    if (error || response.statusCode !== 200) {
      d.reject(error);
    }

    d.resolve(body);
  });

  return d.promise;
};
