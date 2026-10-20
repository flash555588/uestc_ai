/* Regenerate against the deployed CSS when the upstream frontend changes. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const postcss = require('postcss');
const path = require('node:path');
const sourcePath = process.argv[2];
const files = fs.statSync(sourcePath).isDirectory()
  ? fs.readdirSync(sourcePath).filter(name => name.endsWith('.css')).sort((a,b) => Number(b.startsWith('index-')) - Number(a.startsWith('index-')) || a.localeCompare(b)).map(name => path.join(sourcePath,name))
  : [sourcePath];
const input = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const shades = {
  '131f18': '111113', '1b2a21': '1c1c1f', '24362b': '242427',
  '354b3c': '333438', '586c5d': '505159', '809183': '9698a1',
  '9aad9c': 'aaabb3', 'bdcbbc': 'c5c5cd', 'dce5d9': 'd0d0d5',
  'edf1e9': 'f1f1f3',
  // The upstream gray scale was also retinted green/beige.
  '26382c': '141416', '304536': '242427', '3e5445': '333438',
  '526558': '505159', '65776a': '9698a1', '7b8b7e': 'aaabb3',
  'eeede7': 'f1f1f3', 'ddd8ce': 'd0d0d5', 'f4f2ec': 'f1f1f3',
  // Shared tables retain upstream Slate/Gray values in lazy CSS chunks.
  '020617': '111113', '0f172a': '141416', '1e293b': '242427',
  '334155': '333438', '475569': '505159', '64748b': '9698a1',
  '94a3b8': 'aaabb3', 'cbd5e1': 'c5c5cd', 'e2e8f0': 'd0d0d5',
  'f1f5f9': 'f1f1f3', 'f8fafc': 'f1f1f3',
  '030712': '111113', '111827': '1c1c1f', '1f2937': '242427',
  '374151': '333438', '4b5563': '505159', '6b7280': '9698a1',
  '9ca3af': 'aaabb3', 'd1d5db': 'c5c5cd', 'e5e7eb': 'd0d0d5',
  'f3f4f6': 'f1f1f3', 'f9fafb': 'f1f1f3',
};
function neutral(value) {
  return value.replace(/#([\da-f]{6})([\da-f]{2})?\b/gi, (all, hex, alpha) => shades[hex.toLowerCase()] ? '#' + shades[hex.toLowerCase()] + (alpha || '') : all)
    .replace(/rgb\((\d+) (\d+) (\d+)(?=[ /)])/g, (all, r, g, b) => {
      const hex = [r,g,b].map(x => Number(x).toString(16).padStart(2, '0')).join('');
      const mapped = shades[hex];
      return mapped ? 'rgb(' + [0,2,4].map(i => parseInt(mapped.slice(i,i+2),16)).join(' ') : all;
    }).replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?=[,)])/g, (all,r,g,b) => {
      const hex = [r,g,b].map(x => Number(x).toString(16).padStart(2,'0')).join('');
      return shades[hex] ? all.slice(0,all.indexOf('(')+1) + [0,2,4].map(i=>parseInt(shades[hex].slice(i,i+2),16)).join(',') : all;
    });
}
const result = postcss.root();
postcss.parse(input).walkRules(rule => {
  // Only dark-aware selectors: no light theme declarations or semantic colors.
  const semantic = /(?:green|emerald|primary|amber|blue|cyan|orange|pink|red|purple|indigo|teal|yellow|rose|lime|sky|violet|success|danger|warning|error|info)-|badge-(?:success|danger|warning|info)/;
  const selectors = rule.selectors.filter(s => s.includes('.dark') && s.trim() !== '.dark' && !semantic.test(s));
  if (!selectors.length) return;
  const declarations = [];
  rule.each(node => {
    if (node.type !== 'decl' || node.prop.startsWith('--ui-')) return;
    const value = neutral(node.value);
    if (value !== node.value) declarations.push(node.clone({value}));
  });
  if (!declarations.length) return;
  // Vue changes data-v hashes on rebuild. Keep stable component classes and
  // replace the lost attribute specificity with :root on the dark ancestor.
  let clone = postcss.rule({selector:selectors.map(s => 'html:root.dark ' + s.replace(/^\s*\.dark\s+/, '').replace(/\[data-v-[\da-f]+\]/gi, '')).join(',')});
  declarations.forEach(d => clone.append(d));
  for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    const wrapper = parent.clone({nodes:[]}); wrapper.append(clone); clone = wrapper;
  }
  result.append(clone);
});
const hash = crypto.createHash('sha256').update(input).digest('hex');
fs.writeFileSync(process.argv[3], '/* Generated neutral dark utilities. Source SHA256: ' + hash + ' */\n' + result.toString() + '\n');
console.log('Generated rules:', result.nodes.length);
