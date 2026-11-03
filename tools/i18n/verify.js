/* 変換が挙動を変えていないことを構造的に確かめる。
   日本語モードでは TR(s)===s なので、変換後から
     ・挿入したランタイム <script> を取り除き
     ・TR('x') を 'x' へ戻し
     ・TRF("fmt",a,b) をテンプレートリテラルへ戻し
     ・ルールブックに足した1行を取り除く
   元の index.html と1バイトも違わなければ、変換は無害だと言える。
*/
const fs = require('fs');
const acorn = require('acorn');

const ORIG = process.argv[2] || '/home/user/thechess/thechess-app/www/index.html';
const NEW  = process.argv[3] || '/home/user/thechess/thechess-app/www/index.html.i18n';
const unesc = s => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

function unwrap(code, label) {
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' }); }
  catch (e) { throw new Error(`${label}: ${e.message}`); }
  const edits = [];
  let nTR = 0, nTRF = 0;
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n.type) return;
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier') {
      if (n.callee.name === 'TR' && n.arguments.length === 1
          && (n.arguments[0].type === 'Literal'
              || (n.arguments[0].type === 'TemplateLiteral' && !n.arguments[0].expressions.length))) {
        edits.push({ s: n.start, e: n.end, t: code.slice(n.arguments[0].start, n.arguments[0].end) });
        nTR++; return;
      }
      if (n.callee.name === 'TRF' && n.arguments[0] && n.arguments[0].type === 'Literal') {
        const fmt = n.arguments[0].value;
        const args = n.arguments.slice(1).map(a => code.slice(a.start, a.end));
        // {0}{1}… を ${expr} に戻してテンプレートリテラルを再構成
        let out = '`';
        let i = 0;
        while (i < fmt.length) {
          const m = /^\{(\d+)\}/.exec(fmt.slice(i));
          if (m) { out += '${' + args[+m[1]] + '}'; i += m[0].length; }
          else {
            const c = fmt[i];
            out += (c === '`' || c === '\\') ? '\\' + c
                 : (c === '$' && fmt[i + 1] === '{') ? '\\$' : c;
            i++;
          }
        }
        out += '`';
        edits.push({ s: n.start, e: n.end, t: out });
        nTRF++;
        // 引数の中にさらに TR があるかもしれないので、引数部分だけ再帰
        n.arguments.slice(1).forEach(walk);
        return;
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      walk(n[k]);
    }
  })(ast);
  edits.sort((a, b) => b.s - a.s);
  let out = code;
  for (const ed of edits) out = out.slice(0, ed.s) + ed.t + out.slice(ed.e);
  return { out, nTR, nTRF };
}

let a = fs.readFileSync(ORIG, 'utf8');
let b = fs.readFileSync(NEW, 'utf8');

// 挿入したランタイムを外す
const rt = /<script>\n\/\* ══ 多言語[\s\S]*?<\/script>\n/;
if (!rt.test(b)) throw new Error('ランタイムブロックが見つからない');
b = b.replace(rt, '');

let TR = 0, TRF = 0;
// ルールブック
const sdRe = /(<iframe id="rbFrame" title="[^"]*" srcdoc=")([\s\S]*?)(">)/;
{
  const m = sdRe.exec(b);
  let inner = unesc(m[2]);
  inner = inner.replace(/\n\/\* 文言は親の辞書を使う[\s\S]*?\nconst TR=s=>parent\.__TR\(s\), TRF=\(f,\.\.\.a\)=>parent\.__TRF\(f,\.\.\.a\);\nconst __rbTR=[\s\S]*?addEventListener\('load',__rbTR\);\n/, '');
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let s2, edits = [];
  while ((s2 = re.exec(inner))) {
    if (!s2[1].trim()) continue;
    const st = s2.index + s2[0].indexOf(s2[1]);
    const r = unwrap(s2[1], 'rulebook'); TR += r.nTR; TRF += r.nTRF;
    edits.push({ s: st, e: st + s2[1].length, t: r.out });
  }
  edits.sort((x, y) => y.s - x.s);
  for (const ed of edits) inner = inner.slice(0, ed.s) + ed.t + inner.slice(ed.e);
  b = b.slice(0, m.index + m[1].length) + esc(inner) + b.slice(m.index + m[1].length + m[2].length);
}
// 本体
{
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m, edits = [];
  while ((m = re.exec(b))) {
    if (!m[1].trim()) continue;
    const st = m.index + m[0].indexOf(m[1]);
    edits.push({ s: st, e: st + m[1].length, code: m[1] });
  }
  edits = edits.map(ed => { const r = unwrap(ed.code, 'main'); TR += r.nTR; TRF += r.nTRF; return { ...ed, t: r.out }; });
  edits.sort((x, y) => y.s - x.s);
  for (const ed of edits) b = b.slice(0, ed.s) + ed.t + b.slice(ed.e);
}

console.log(`戻した呼び出し: TR ${TR}件 / TRF ${TRF}件`);
if (a === b) { console.log('✅ 元の index.html と完全に一致 ─ 変換は挙動を変えていない'); process.exit(0); }
console.log(`❌ 不一致  元 ${a.length} / 復元 ${b.length}  (差 ${b.length - a.length})`);
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  if (a[i] !== b[i]) {
    console.log('最初の相違 offset', i);
    console.log('  元 :', JSON.stringify(a.slice(Math.max(0, i - 60), i + 80)));
    console.log('  復元:', JSON.stringify(b.slice(Math.max(0, i - 60), i + 80)));
    break;
  }
}
process.exit(1);
