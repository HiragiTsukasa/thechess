/* すでに TR() 化された index.html を見て、辞書の過不足を調べる（書き換えない）。
   transform.js は「変換前のファイル」を入力にするので、一度 TR() 化したあとの
   日常の確認にはこちらを使う。

   node check.js            調べるだけ
   node check.js --prune    使われなくなった訳を dict.json から外す
*/
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const SRC = '/home/user/thechess/thechess-app/www/index.html';
const DICT = path.join(__dirname, 'dict.json');
const JP = /[぀-ヿ一-鿿々ー]/;
const unesc = s => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const html = fs.readFileSync(SRC, 'utf8');
const used = new Set();

function scan(code, label) {
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' }); }
  catch (e) { console.error(`  ${label} のパースに失敗: ${e.message}`); return; }
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n.type) return;
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier'
        && (n.callee.name === 'TR' || n.callee.name === 'TRF')) {
      const a = n.arguments[0];
      if (a && a.type === 'Literal' && typeof a.value === 'string') used.add(a.value);
      else if (a && a.type === 'TemplateLiteral' && !a.expressions.length)
        used.add(a.quasis[0].value.cooked);
    }
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      walk(n[k]);
    }
  })(ast);
}

// HTML に直書きされた日本語（起動時に TRdom が差し替えるもの）
function scanHtml(doc, skip) {
  const inSkip = i => skip.some(([a, b]) => i >= a && i < b);
  let m;
  const re = />([^<>]+)</g;
  while ((m = re.exec(doc))) {
    if (inSkip(m.index + 1)) continue;
    const t = m[1].trim();
    if (t && JP.test(t)) used.add(t);
  }
  for (const attr of ['aria-label', 'placeholder', 'title', 'alt']) {
    const ra = new RegExp(`${attr}="([^"]*)"`, 'g');
    while ((m = ra.exec(doc))) {
      if (inSkip(m.index + m[0].indexOf(m[1]))) continue;
      const t = m[1].trim();
      if (t && JP.test(t)) used.add(t);
    }
  }
}

const sdRe = /(<iframe id="rbFrame" title="[^"]*" srcdoc=")([\s\S]*?)(">)/;
const sd = sdRe.exec(html);
if (sd) {
  const inner = unesc(sd[2]);
  const skip = [];
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(inner))) {
    const s0 = m.index + m[0].indexOf(m[1]);
    skip.push([s0, s0 + m[1].length]);
    if (m[1].trim()) scan(m[1], 'rulebook');
  }
  scanHtml(inner, skip);
}
{
  const skip = [];
  let m;
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  while ((m = re.exec(html))) {
    const s0 = m.index + m[0].indexOf(m[1]);
    skip.push([s0, s0 + m[1].length]);
    if (m[1].trim()) scan(m[1], 'main');
  }
  const st = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g;
  while ((m = st.exec(html))) { const s0 = m.index + m[0].indexOf(m[1]); skip.push([s0, s0 + m[1].length]); }
  if (sd) { const a = sd.index + sd[1].length; skip.push([a, a + sd[2].length]); }
  scanHtml(html, skip);
}

const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));
const jpUsed = [...used].filter(s => JP.test(s));
const missing = jpUsed.filter(s => !(s in dict));
const unused = Object.keys(dict).filter(s => !used.has(s));

console.log(`いま使われている日本語: ${jpUsed.length}件`);
console.log(`辞書: ${Object.keys(dict).length}件`);
console.log(`未訳（英語で日本語が出る）: ${missing.length}件`);
missing.slice(0, 20).forEach(s => console.log('   ' + JSON.stringify(s).slice(0, 90)));
console.log(`使われていない訳: ${unused.length}件`);
unused.slice(0, 20).forEach(s => console.log('   ' + JSON.stringify(s).slice(0, 60)));

if (process.argv.includes('--prune') && unused.length) {
  unused.forEach(k => delete dict[k]);
  fs.writeFileSync(DICT, JSON.stringify(dict, null, 1) + '\n');
  console.log(`→ dict.json から ${unused.length}件を削除`);
}
process.exit(missing.length ? 1 : 0);
