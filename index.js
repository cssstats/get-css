'use strict';

var q = require('q');
var isCss = require('is-css');
var isBlank = require('is-blank');
var isUrl = require('is-url-superb');
var request = require('request');
var cheerio = require('cheerio');
var normalizeUrl = require('normalize-url');
var stripHtmlComments = require('strip-html-comments');
var resolveCssImportUrls = require('resolve-css-import-urls');
var ua = require('ua-string');

var getLinkContents = require('./utils/get-link-contents');
var createLink = require('./utils/create-link');

module.exports = function(url, options){
  var deferred = q.defer();
  var options = options || {};
  options.headers = options.headers || {};
  options.headers['User-Agent'] = options.headers['User-Agent'] || ua;
  options.timeout = options.timeout || 5000;
  options.gzip = true;

  if (typeof url !== 'string' || isBlank(url) || !isUrl(url)) {
    throw new TypeError('get-css expected a url as a string')
  }

  url = normalizeUrl(url, { stripWWW: false });
  options.url = url;

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
        if(isHrefPresent(this)) {
            result.links.push(createLink(link, url));
        }else{
            result.styles.push(stripHtmlComments($(this).text()));
        }
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

    /**
     * check if the link object is a valid resouce link
     * @param link
     */
    function isHrefPresent ( link ) {
        var href = $(link).attr('href');
        return (typeof href !== typeof undefined && href !== false);
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
