var urlResolver = require('url').resolve;

module.exports = function resolveUrl(url, link) {
  if(link.match(/^(http|https)/g)) {
    return link;
  } else {
    if(url.indexOf('/', url.length - '/'.length) == -1) {
      url = url + '/';
    }

    return urlResolver(url, link);
  }
};
