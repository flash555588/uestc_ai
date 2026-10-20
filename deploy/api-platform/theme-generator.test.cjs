const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const test = require('node:test');

test('Vue scope hash changes do not change the dark override selectors', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-theme-check-'));
  try {
    function generate(hash) {
      const source = `.dark .sticky-header-cell[data-v-${hash}]{background-color:#1f2937}.select-trigger[data-v-${hash}]:is(.dark *){background-color:rgb(36 54 43 / var(--tw-bg-opacity, 1))}.dark\\:bg-green-900:is(.dark *){background-color:#26382c}`;
      fs.writeFileSync(path.join(dir,'input.css'), source);
      const result = spawnSync(process.execPath,[path.join(__dirname,'generate-dark-utilities.cjs'),path.join(dir,'input.css'),path.join(dir,'output.css')],{encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);
      return fs.readFileSync(path.join(dir,'output.css'),'utf8').replace(/^\/\*.*\*\/\n/,'');
    }
    const first=generate('1234abcd'), next=generate('5678ffff');
    assert.equal(first,next);
    assert.doesNotMatch(first,/data-v-|bg-green-/);
    assert.match(first,/html:root\.dark \.sticky-header-cell/);
    assert.match(first,/#242427/);
    assert.match(first,/rgb\(36 36 39 \/ var\(--tw-bg-opacity, 1\)\)/);
  } finally {
    // dir is a freshly created child of the system temporary directory.
    assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));
    fs.rmSync(dir,{recursive:true});
  }
});
