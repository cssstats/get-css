'use strict';

var q = require('q');
var request = require('request');
var cheerio = require('cheerio');

var resolveCssImportUrls = require('resolve-css-import-urls');
var getLinkContents = require('./utils/get-link-contents');
var resolveUrl = require('./utils/resolve-url');

module.exports = function(url, options){

  var deferred = q.defer();

  var options = options || {};

  var status = {
    parsed: 0,
    total: 0
  }

  var result = {
    links: [],
    styles: [],
    css: ''
  };

  options.timeout = options.timeout || 5000;

  function handleResolve() {
    if (status.parsed >= status.total) {
      deferred.resolve(result);
    }
  }

  function parseHtml(html) {
    var $ = cheerio.load(html);
    result.pageTitle = $('title').text();

    $('[rel=stylesheet]').each(function() {
      var link = $(this).attr('href');
      var resolvedUrl = resolveUrl(url, link);
      result.links.push({ link: link, url: resolvedUrl, css: '' });
    });

    $('style').each(function() {
      result.styles.push( $(this).text() );
    });

    status.total = result.links.length + result.styles.length;
    if (!status.total) {
      deferred.resolve(false);
    }

    result.links.forEach(function(link) {
      getLinkContents(link.url, options)
        .then(function(css) {
          handleCssFromLink(link, css);
        })
        .catch(function(error) {
          link.error = error;
          status.parsed++;
          handleResolve();
        });
    });

    result.styles.forEach(function(css) {
      result.css += css;
      status.parsed++;
      handleResolve();
    });
  }

  function handleCssFromLink(link, css) {
    link.css += css;

    parseCssForImports(link, css);

    status.parsed++;
    handleResolve();
  }

  // Handle potential @import url(foo.css) statements in the CSS.
  function parseCssForImports(link, css) {
    link.imports = resolveCssImportUrls(link.url, css);
    status.total += link.imports.length;
    result.css += css;

    link.imports.forEach(function(importUrl) {
      getLinkContents(importUrl, options)
        .then(function(css) {
          result.css += css;
          handleCssFromLink(link, css);
        })
        .catch(function(error) {
          link.error = error;
          status.parsed++;
          handleResolve();
        });
    });
  }

  request({ url: url, timeout: options.timeout }, function(error, response, body) {
    if (error) deferred.reject(error);
    parseHtml(body);
  });

  return deferred.promise;
};
