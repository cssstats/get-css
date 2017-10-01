const assert = require('assert');
const createLink = require('../../utils/create-link');

describe('create-link', () => {
  it('should create the correct link object', () => {
    assert.deepEqual(
      createLink('../bar.css', 'http://foo.com/css/my-css.css'),
      { link: '../bar.css', url: 'http://foo.com/bar.css', css: '' });
  });

  it('should correctly resolve full url links', () => {
    assert.deepEqual(
      createLink('http://foo.com/bar.css', 'http://foo.com/css/my-css.css'),
      { link: 'http://foo.com/bar.css', url: 'http://foo.com/bar.css', css: '' });
  });
});
