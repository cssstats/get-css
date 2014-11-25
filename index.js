
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
    request({ url: link, timeout: options.timeout, gzip: true }, function(error, response, body) {
      if (error) d.reject(error);
      d.resolve(body);
    });
    return d.promise;
  }

  function fixLinkUrl(link) {
    if (!link.match(/^(http|https)/g)) {
      if (link.match(/^\/[^\/]/g)) {
        link = url + link;
      } else if (link.match(/^\/\//g)) {
        link = 'http:' + link;
      } else if (link.match(/^\.\./g)) {
        link = url + link.replace('..', '');
      } else {
        link = url + '/' + link;
      }
    }
    return link;
  }

  function parseHtml(html) {
    var $ = cheerio.load(html);
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
      link.url = fixLinkUrl(link.link);
      getLinkContents(link.url)
        .then(function(css) {
          link.css = css;
          result.css += css;
          parsed++;
          handleResolve();
        })
        .catch(function(error) {
          link.error = error;
          parsed++;
          handleResolve();
        });;
    });
    result.styles.forEach(function(css) {
      result.css += css;
      parsed++;
      handleResolve();
    });
  }

  request({ url: url, timeout: options.timeout }, function(error, response, body) {
    if (error) deferred.reject(error);
    parseHtml(body);
  });

  return deferred.promise;

};

