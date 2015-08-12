'use strict';

var q = require('q');
var isCss = require('is-css');
var request = require('request');
var cheerio = require('cheerio');
var normalizeUrl = require('normalize-url');
var stripHtmlComments = require('strip-html-comments');
var resolveCssImportUrls = require('resolve-css-import-urls');

var getLinkContents = require('./utils/get-link-contents');
var createLink = require('./utils/create-link');
var userAgentString = require('./utils/user-agent-string');

module.exports = function(url, options){
  var deferred = q.defer();
  var options = options || {};
  options.headers = options.headers || {};
  options.headers['User-Agent'] = options.headers['User-Agent'] || userAgentString();
  options.url = normalizeUrl(url);
  options.timeout = options.timeout || 5000;
  options.gzip = true;

  if (options.ignoreCerts) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  var status = {
    parsed: 0,
    total: 0
  };

  var result = {
    links: [],
    styles: [],
    css: ''
  };

  function handleResolve() {
    if (status.parsed >= status.total) {
      deferred.resolve(result);
    }
  }

  function parseHtml(html) {
    var $ = cheerio.load(html);
    result.pageTitle = $('head > title').text();

    $('[rel=stylesheet]').each(function() {
      var link = $(this).attr('href');
      result.links.push(createLink(link, url));
    });

    $('style').each(function() {
      result.styles.push(stripHtmlComments($(this).text()));
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
      var importLink = createLink(importUrl, importUrl);
      result.links.push(importLink);

      getLinkContents(importLink.url, options)
        .then(function(css) {
          handleCssFromLink(importLink, css);
        })
        .catch(function(error) {
          link.error = error;
          status.parsed++;
          handleResolve();
        });
    });
  }

  request(options, function(error, response, body) {
    if (error) {
      if (options.verbose) console.log('Error from ' + url + ' ' + error);
      deferred.reject(error);
      return;
    }

    if (response && response.statusCode != 200) {
      if (options.verbose) console.log('Received a ' + response.statusCode + ' from: ' + url);
      deferred.reject({ url: url, statusCode: response.code });
      return;
    }

    if (isCss(url)) {
      var link = createLink(url, url);
      result.links.push(link);
      handleCssFromLink(link, body);
    } else {
      parseHtml(body);
    }
  });

  return deferred.promise;
};
