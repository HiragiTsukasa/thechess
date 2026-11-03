/* dict.json の訳を index.html の TRX へ流し込む。
   ─ check.js は「辞書に訳があるか」しか見ない。実際にアプリが引くのは
     index.html に埋め込まれた TRX なので、dict.json を直しただけでは
     英語の端末に日本語が出たままになる。その穴を塞ぐためのもの。

   足す・上書きするだけで、TRX から消すことはしない。
   TR() に変数を渡している箇所は静的解析では見えないため、
   使われていないように見える訳でも消すと壊れる可能性がある。

   node sync.js          差分を表示するだけ
   node sync.js --write  index.html の TRX を書き換える
*/
const fs = require('fs');
const path = require('path');

const SRC = '/home/user/thechess/thechess-app/www/index.html';
const DICT = path.join(__dirname, 'dict.json');
const MARK = 'const TRX=';

const html = fs.readFileSync(SRC, 'utf8');
const i = html.indexOf(MARK);
if (i < 0) { console.error('index.html に TRX が見つからない'); process.exit(2); }
const j = html.indexOf('};', i);
if (j < 0) { console.error('TRX の終端が見つからない'); process.exit(2); }

const cur = JSON.parse(html.slice(i + MARK.length, j + 1));
const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));

const added = [], changed = [];
for (const k of Object.keys(dict)) {
  if (!(k in cur)) added.push(k);
  else if (cur[k] !== dict[k]) changed.push(k);
}
const extra = Object.keys(cur).filter(k => !(k in dict));

const show = (label, list) => {
  console.log(`${label}: ${list.length}件`);
  list.slice(0, 20).forEach(k => console.log('   ' + JSON.stringify(k).slice(0, 80)));
};
show('TRX に無い訳（英語で日本語が出る）', added);
show('訳が変わったもの', changed);
console.log(`TRX にだけある訳: ${extra.length}件（消さない）`);

if (!process.argv.includes('--write')) {
  if (added.length || changed.length) console.log('\n→ 反映するには node sync.js --write');
  process.exit(added.length || changed.length ? 1 : 0);
}

if (!added.length && !changed.length) { console.log('\n変更なし'); process.exit(0); }
const next = Object.assign({}, cur);
for (const k of added.concat(changed)) next[k] = dict[k];
// キーの順は元のまま＋末尾に追加。差分を読みやすくするため並べ替えはしない
fs.writeFileSync(SRC, html.slice(0, i) + MARK + JSON.stringify(next) + html.slice(j + 1));
console.log(`\n→ TRX を更新（追加 ${added.length} / 上書き ${changed.length}）`);
