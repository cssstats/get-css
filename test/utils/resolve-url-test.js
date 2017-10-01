const assert = require('assert');
const resolveUrl = require('../../utils/resolve-url');

describe('resolve-url', () => {
  it('should correctly resolve a .. relative link', () => {
    assert.equal(resolveUrl('http://foo.com/some/path', '../bar.css'), 'http://foo.com/some/bar.css');
  });

  it('should correctly resolve a .. relative link when the url has a trailing /', () => {
    assert.equal(resolveUrl('http://foo.com/some/path/', '../bar.css'), 'http://foo.com/some/bar.css');
  });

  it('should correctly resolve a relative link', () => {
    assert.equal(resolveUrl('http://foo.com/some/path', 'bar.css'), 'http://foo.com/some/path/bar.css');
  });

  it('should correctly return a full link', () => {
    assert.equal(
      resolveUrl('http://foo.com', 'http://foo.com/some/path/bar.css'),
      'http://foo.com/some/path/bar.css');
  });

  it('should correctly resolve an absolute link', () => {
    assert.equal(resolveUrl('http://foo.com/some/path', '/bar.css'), 'http://foo.com/bar.css');
  });

  it('should correctly resolve a relative url from an html file', () => {
    assert.equal(resolveUrl('http://foo.bar/awesome/baz.html', 'baz.css'), 'http://foo.bar/awesome/baz.css');
  });

  it('should correctly resolve an absolute url from an html file', () => {
    assert.equal(resolveUrl('http://foo.bar/awesome/baz.html', '/baz.css'), 'http://foo.bar/baz.css');
  });
});
