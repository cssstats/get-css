
var q = require('q');
var request = require('request');
var cheerio = require('cheerio');

module.exports = function(url, options){

  var deferred = q.defer();

  var options = options || {};
  var parsed = 0;
  var total = 0;
  var result = {};
  result.links = [];
  result.styles = [];
  result.css = '';

  options.timeout = options.timeout || 5000;

  function handleResolve() {
    if (parsed >= total) {
      deferred.resolve(result);
    }
  }

  function getLinkContents(link) {
    var d = q.defer();
    request({ url: link, timeout: options.timeout }, function(error, response, body) {
      if (error) d.reject(error);
      d.resolve(body);
    });
    return d.promise;
  }

  request({ url: url, timeout: options.timeout }, function(error, response, body) {

    var $ = cheerio.load(body);

    result.pageTitle = $('title').text();

    $('[rel=stylesheet]').each(function() {
      result.links.push({ link: $(this).attr('href') });
    });

    $('style').each(function() {
      result.styles.push( $(this).text() );
    });

    total = result.links.length + result.styles.length;

    if (!total) deferred.resolve(false);

    result.links.forEach(function(link) {
      getLinkContents(link.link)
        .then(function(css) {
          link.css = css;
          result.css += css;
          parsed++;
          handleResolve();
        });
    });

    result.styles.forEach(function(css) {
      result.css += css;
      parsed++;
      handleResolve();
    });

  });

  return deferred.promise;

};

