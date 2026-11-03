/* The Chess ─ 日本語リテラルを T()/TF() 呼び出しに機械置換する。
   第1段階では辞書の英訳を空のままにするので、見た目も挙動も日本語版と完全に同じになる。
   そこで回帰を取ってから英訳を流し込む。

   置換するもの
     'あ'            → TR('あ')
     `A${x}B`(日本語含む) → TRF('A{0}B', x)        語順が言語で変わるため書式文字列にする
   置換しないもの
     obj['あ'] のような計算プロパティ（英訳すると参照先が消えるため）
   HTML の静的テキストと属性は触らない（起動時に DOM を走査して差し替える）
   T/TF は本体で4回ローカル宣言されていて影に隠れるため TR/TRF を使う

   使い方: node transform.js [--write]
*/
const fs = require('fs');
const acorn = require('acorn');

const SRC = '/home/user/thechess/thechess-app/www/index.html';
const WRITE = process.argv.includes('--write');
const JP = /[぀-ヿ一-鿿々ー]/;

const unesc = s => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const strings = new Set();      // 辞書に入れる日本語
const report = { lit: 0, tpl: 0, skipKey: 0, skipped: [] };

function transformCode(code, label) {
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' }); }
  catch (e) { throw new Error(`${label} のパースに失敗: ${e.message}`); }

  const edits = [];
  const stack = [];
  (function walk(n, parent, key) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(c => walk(c, parent, key));
    if (!n.type) return;

    if (n.type === 'Literal' && typeof n.value === 'string' && JP.test(n.value)) {
      // obj['あ'] のような計算プロパティは参照なので訳さない
      const computedKey = parent && parent.type === 'MemberExpression'
        && parent.computed && key === 'property';
      const objKey = parent && parent.type === 'Property' && key === 'key' && !parent.computed;
      if (computedKey || objKey) {
        report.skipKey++;
        report.skipped.push(`${label}: ${n.value.slice(0, 30)} (${computedKey ? '計算プロパティ' : 'オブジェクトキー'})`);
      } else {
        strings.add(n.value);
        edits.push({ s: n.start, e: n.end, t: `TR(${code.slice(n.start, n.end)})` });
        report.lit++;
      }
    }

    if (n.type === 'TemplateLiteral' && !(parent && parent.type === 'TaggedTemplateExpression')) {
      const hasJP = n.quasis.some(q => JP.test(q.value.cooked || ''));
      if (hasJP) {
        let fmt = '';
        n.quasis.forEach((q, i) => {
          fmt += q.value.cooked;
          if (i < n.expressions.length) fmt += `{${i}}`;
        });
        const args = n.expressions.map(x => code.slice(x.start, x.end));
        strings.add(fmt);
        // 補間が無いテンプレートリテラルは原文の表記のまま包む（評価結果は同じ）
        const call = args.length
          ? `TRF(${JSON.stringify(fmt)},${args.join(',')})`
          : `TR(${code.slice(n.start, n.end)})`;
        edits.push({ s: n.start, e: n.end, t: call });
        report.tpl++;
        return;  // 中の式は上の args で原文のまま持っているので再帰しない
      }
    }

    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      walk(n[k], n, k);
    }
  })(ast, null, null);

  edits.sort((a, b) => b.s - a.s);
  let out = code;
  for (const ed of edits) out = out.slice(0, ed.s) + ed.t + out.slice(ed.e);
  return out;
}

// ── 本体 ──
let html = fs.readFileSync(SRC, 'utf8');

// ルールブック（srcdoc）を先に処理
const sdRe = /(<iframe id="rbFrame" title="[^"]*" srcdoc=")([\s\S]*?)(">)/;
const sd = sdRe.exec(html);
if (!sd) throw new Error('rbFrame の srcdoc が見つからない');
{
  const inner = unesc(sd[2]);
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m, out = inner, edits = [];
  while ((m = re.exec(inner))) {
    if (!m[1].trim()) continue;
    const s = m.index + m[0].indexOf(m[1]);
    edits.push({ s, e: s + m[1].length, t: transformCode(m[1], 'rulebook') });
  }
  edits.sort((a, b) => b.s - a.s);
  for (const ed of edits) out = out.slice(0, ed.s) + ed.t + out.slice(ed.e);
  // ルールブック側の T/TF は親の実装を借りる
  out = out.replace(/<script>/, `<script>
/* 文言は親の辞書を使う（同一オリジンの srcdoc なので parent を参照できる） */
const TR=s=>parent.__TR(s), TRF=(f,...a)=>parent.__TRF(f,...a);
`);
  html = html.slice(0, sd.index + sd[1].length) + esc(out) + html.slice(sd.index + sd[1].length + sd[2].length);
}

// 本体スクリプト
{
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m, edits = [];
  while ((m = re.exec(html))) {
    if (!m[1].trim()) continue;
    const s = m.index + m[0].indexOf(m[1]);
    edits.push({ s, e: s + m[1].length, code: m[1] });
  }
  edits = edits.map(ed => ({ ...ed, t: transformCode(ed.code, 'main') }));
  edits.sort((a, b) => b.s - a.s);
  for (const ed of edits) html = html.slice(0, ed.s) + ed.t + html.slice(ed.e);
}

const list = [...strings].sort();
console.log(`リテラル置換 ${report.lit}件 / テンプレート置換 ${report.tpl}件`);
console.log(`訳さず残した参照用の文字列: ${report.skipKey}件`);
report.skipped.slice(0, 10).forEach(s => console.log('   ' + s));
console.log(`辞書に入る日本語: ${list.length}件 / ${list.reduce((a, s) => a + s.length, 0).toLocaleString()}字`);

fs.writeFileSync('strings.json', JSON.stringify(list, null, 1));
if (WRITE) { fs.writeFileSync(SRC + '.i18n', html); console.log('→ index.html.i18n を書き出した（まだ差し替えていない）'); }
