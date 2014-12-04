'use strict';

var q = require('q');
var request = require('request');
var cheerio = require('cheerio');

var getLinkContents = require('./utils/get-link-contents');
var resolveUrl = require('./utils/resolve-url');

module.exports = function(url, options){

  var deferred = q.defer();

  var options = options || {};
  var parsed = 0;
  var total = 0;

  var result = {
    links: [],
    styles: [],
    imports: [],
    css: ''
  };

  options.timeout = options.timeout || 5000;

  function handleResolve() {
    if (parsed >= total) {
      deferred.resolve(result);
    }
  }

  function parseHtml(html) {
    var $ = cheerio.load(html);
    result.pageTitle = $('title').text();

    $('[rel=stylesheet]').each(function() {
      var link = $(this).attr('href');
      var resolvedUrl = resolveUrl(url, link);
      result.links.push({ link: link, url: url });
    });

    $('style').each(function() {
      result.styles.push( $(this).text() );
    });

    total = result.links.length + result.styles.length;

    if (!total) deferred.resolve(false);
    result.links.forEach(function(link) {
      getLinkContents(link.url, options)
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
        });
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
