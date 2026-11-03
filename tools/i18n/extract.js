/* The Chess ─ 日本語文字列の抽出（調査のみ。ファイルは書き換えない）
   対象
     ① 本体の <script> 内の JS 文字列リテラル／テンプレートリテラル
     ② 本体の HTML テキストノードと属性（aria-label / placeholder / title）
     ③ ルールブック（srcdoc）の JS リテラルと HTML テキスト
   出力: extracted.json と、画面向けの要約
*/
const fs = require('fs');
const acorn = require('acorn');

const SRC = process.argv[2] || '/home/user/thechess/thechess-app/www/index.html';
const html = fs.readFileSync(SRC, 'utf8');
const JP = /[぀-ヿ一-鿿々ー]/;

const unesc = s => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ── 本体スクリプトの範囲を取る（最後の大きな <script>…</script>） ──
function scriptBlocks(doc) {
  const out = []; const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(doc))) {
    if (!m[1].trim()) continue;
    out.push({ start: m.index + m[0].indexOf(m[1]), code: m[1] });
  }
  return out;
}

function jsLiterals(code, offset, where) {
  const found = [];
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script', locations: false });
  } catch (e) {
    return { found, error: e.message };
  }
  (function walk(n, parent, key) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(c => walk(c, parent, key)); return; }
    if (n.type === 'Literal' && typeof n.value === 'string' && JP.test(n.value)) {
      // プロパティ名として使われている文字列は識別子なので訳さない
      const isKey = parent && parent.type === 'Property' && key === 'key' && !parent.computed;
      found.push({ where, kind: 'js', start: offset + n.start, end: offset + n.end,
                   raw: code.slice(n.start, n.end), value: n.value, isKey });
    }
    if (n.type === 'TemplateLiteral') {
      n.quasis.forEach(q => {
        if (JP.test(q.value.cooked || '')) {
          found.push({ where, kind: 'tpl', start: offset + q.start, end: offset + q.end,
                       raw: code.slice(q.start, q.end), value: q.value.cooked, isKey: false });
        }
      });
    }
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      walk(n[k], n, k);
    }
  })(ast, null, null);
  return { found };
}

// ── HTML のテキストノードと属性 ──
function htmlText(doc, offset, where, skipRanges) {
  const found = [];
  const inSkip = i => skipRanges.some(([a, b]) => i >= a && i < b);
  // テキストノード: > ... < の間
  const re = />([^<>]+)</g; let m;
  while ((m = re.exec(doc))) {
    const t = m[1];
    if (!JP.test(t)) continue;
    const at = m.index + 1;
    if (inSkip(at)) continue;
    found.push({ where, kind: 'text', start: offset + at, end: offset + at + t.length,
                 raw: t, value: t.trim(), isKey: false });
  }
  for (const attr of ['aria-label', 'placeholder', 'title', 'alt', 'content']) {
    const ra = new RegExp(`${attr}="([^"]*)"`, 'g'); let a;
    while ((a = ra.exec(doc))) {
      if (!JP.test(a[1])) continue;
      const at = a.index + a[0].indexOf(a[1]);
      if (inSkip(at)) continue;
      found.push({ where, kind: 'attr:' + attr, start: offset + at, end: offset + at + a[1].length,
                   raw: a[1], value: a[1], isKey: false });
    }
  }
  return found;
}

const all = [];
const scripts = scriptBlocks(html);
const skip = scripts.map(s => [s.start, s.start + s.code.length]);

// srcdoc の範囲も HTML テキスト走査から除く
const sd = /(<iframe id="rbFrame" title="[^"]*" srcdoc=")([\s\S]*?)(">)/.exec(html);
if (sd) {
  const a = sd.index + sd[1].length;
  skip.push([a, a + sd[2].length]);
}

for (const s of scripts) {
  const r = jsLiterals(s.code, s.start, 'main');
  if (r.error) console.error('  パース失敗(main):', r.error);
  all.push(...r.found);
}
all.push(...htmlText(html, 0, 'main', skip));

// ── ルールブック ──
let rb = null;
if (sd) {
  const inner = unesc(sd[2]);
  rb = { attrStart: sd.index + sd[1].length, escLen: sd[2].length, rawLen: inner.length };
  const iscripts = scriptBlocks(inner);
  const iskip = iscripts.map(s => [s.start, s.start + s.code.length]);
  for (const s of iscripts) {
    const r = jsLiterals(s.code, s.start, 'rulebook');
    if (r.error) console.error('  パース失敗(rulebook):', r.error);
    all.push(...r.found);
  }
  all.push(...htmlText(inner, 0, 'rulebook', iskip));
}

// ── 集計 ──
const by = {};
for (const f of all) {
  const k = `${f.where}/${f.kind}${f.isKey ? '(キー)' : ''}`;
  by[k] = (by[k] || 0) + 1;
}
const uniq = new Map();
for (const f of all) if (!f.isKey) {
  const v = f.value.trim();
  if (!v) continue;
  if (!uniq.has(v)) uniq.set(v, []);
  uniq.get(v).push(f);
}
console.log('=== 抽出結果 ===');
for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(28)} ${String(v).padStart(4)}件`);
}
const chars = [...uniq.keys()].reduce((a, s) => a + s.length, 0);
console.log(`\n  訳す対象（重複除く）: ${uniq.size}件 / ${chars.toLocaleString()}字`);
console.log(`  うち複数箇所に出る   : ${[...uniq.values()].filter(a => a.length > 1).length}件`);
const keys = all.filter(f => f.isKey);
console.log(`  プロパティ名（訳さない）: ${keys.length}件`);
if (keys.length) console.log('    例: ' + [...new Set(keys.map(k => k.value))].slice(0, 6).join(' / '));

fs.writeFileSync('extracted.json', JSON.stringify({ rb, items: all }, null, 1));
const lens = [...uniq.entries()].sort((a, b) => b[0].length - a[0].length);
console.log('\n  長い文字列の例:');
lens.slice(0, 5).forEach(([v]) => console.log('    ' + v.slice(0, 90) + (v.length > 90 ? '…' : '')));
console.log('\n  短い文字列の例:');
lens.slice(-8).forEach(([v, a]) => console.log(`    ${JSON.stringify(v)} ×${a.length}`));
