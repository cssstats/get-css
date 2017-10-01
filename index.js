const q = require('q');
const isCss = require('is-css');
const isPresent = require('is-present');
const isBlank = require('is-blank');
const isUrl = require('is-url-superb');
const request = require('request');
const cheerio = require('cheerio');
const normalizeUrl = require('normalize-url');
const stripHtmlComments = require('strip-html-comments');
const resolveCssImportUrls = require('resolve-css-import-urls');
const ua = require('ua-string');

const getLinkContents = require('./utils/get-link-contents');
const createLink = require('./utils/create-link');

module.exports = function (url, options) {
  const deferred = q.defer();

  options = options || {};

  options.headers = options.headers || {};
  options.headers['User-Agent'] = options.headers['User-Agent'] || ua;
  options.timeout = options.timeout || 5000;
  options.gzip = true;

  if (typeof url !== 'string' || isBlank(url) || !isUrl(url)) {
    throw new TypeError('get-css expected a url as a string');
  }

  url = normalizeUrl(url, { stripWWW: false });
  options.url = url;

  if (options.ignoreCerts) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const status = {
    parsed: 0,
    total: 0,
  };

  const result = {
    links: [],
    styles: [],
    css: '',
  };

  function handleResolve() {
    if (status.parsed >= status.total) {
      deferred.resolve(result);
    }
  }

  function parseHtml(html) {
    const $ = cheerio.load(html);
    result.pageTitle = $('head > title').text();

    $('[rel=stylesheet]').each(function () {
      const link = $(this).attr('href');
      if (isPresent(link)) {
        result.links.push(createLink(link, url));
      } else {
        result.styles.push(stripHtmlComments($(this).text()));
      }
    });

    $('style').each(function () {
      result.styles.push(stripHtmlComments($(this).text()));
    });

    status.total = result.links.length + result.styles.length;
    if (!status.total) {
      deferred.resolve(false);
    }

    result.links.forEach((link) => {
      getLinkContents(link.url, options)
        .then((css) => {
          handleCssFromLink(link, css);
        })
        .catch((error) => {
          link.error = error;
          status.parsed++;
          handleResolve();
        });
    });

    result.styles.forEach((css) => {
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

    link.imports.forEach((importUrl) => {
      const importLink = createLink(importUrl, importUrl);
      result.links.push(importLink);

      getLinkContents(importLink.url, options)
        .then((css) => {
          handleCssFromLink(importLink, css);
        })
        .catch((error) => {
          link.error = error;
          status.parsed++;
          handleResolve();
        });
    });
  }

  request(options, (error, response, body) => {
    if (error) {
      if (options.verbose) {
        console.log(`Error from ${url} ${error}`);
      }

      deferred.reject(error);

      return;
    }

    if (response && response.statusCode !== 200) {
      if (options.verbose) {
        console.log(`Received a ${response.statusCode} from: ${url}`);
      }

      deferred.reject({ url, statusCode: response.code });

      return;
    }

    if (isCss(url)) {
      const link = createLink(url, url);
      result.links.push(link);
      handleCssFromLink(link, body);
    } else {
      parseHtml(body);
    }
  });

  return deferred.promise;
};
