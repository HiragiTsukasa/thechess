/* 変換済み index.html.i18n に多言語ランタイムと辞書を差し込む。
   node runtime.js [辞書json]
   辞書json は {"日本語":"English", ...}。省略すると空（＝全部日本語のまま出る）。 */
const fs = require('fs');

const F = '/home/user/thechess/thechess-app/www/index.html.i18n';
const DICT = process.argv[2] && fs.existsSync(process.argv[2])
  ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {};
const strings = JSON.parse(fs.readFileSync(__dirname + '/strings.json', 'utf8'));

// 辞書は「日本語→英語」。訳が無いものは入れない（実行時に日本語へ落ちる）
const tbl = {};
let done = 0;
for (const s of strings) {
  const v = DICT[s];
  if (typeof v === 'string' && v !== '') { tbl[s] = v; done++; }
}

const runtime = `<script>
/* ══ 多言語 ══════════════════════════════════════════════════
   端末の言語が日本語なら日本語、それ以外は英語。ホームの設定でも切り替えられる。
   辞書に無い文字列はそのまま日本語を返すので、訳が欠けても壊れない。
   T/TF という名前は本体で4回ローカル宣言されていて影に隠れるため TR/TRF を使う。 */
const TRX=${JSON.stringify(tbl)};
let TRLANG=(()=>{try{const v=localStorage.getItem('nc_lang');if(v==='ja'||v==='en')return v;}catch(e){}
  return /^ja/i.test(navigator.language||navigator.userLanguage||'')?'ja':'en';})();
function TR(s){if(TRLANG==='ja')return s;const v=TRX[s];return v==null||v===''?s:v;}
function TRF(f,...a){return TR(f).replace(/\\{(\\d+)\\}/g,(m,i)=>a[+i]==null?'':a[+i]);}
/* HTML に直接書いてある日本語は、起動時にここで差し替える（マークアップは触らない） */
function TRdom(root){
  if(TRLANG==='ja')return;
  const d=root||document;
  const w=d.createTreeWalker(d.body||d,NodeFilter.SHOW_TEXT);
  const hit=[];
  for(let n=w.nextNode();n;n=w.nextNode()){
    const p=n.parentNode&&n.parentNode.nodeName;
    if(p==='SCRIPT'||p==='STYLE')continue;
    const t=n.nodeValue,k=t.trim();
    if(k&&TRX[k])hit.push([n,t.replace(k,TRX[k])]);
  }
  hit.forEach(([n,v])=>{n.nodeValue=v;});
  for(const a of ['aria-label','placeholder','title','alt']){
    d.querySelectorAll('['+a+']').forEach(e=>{
      const v=TRX[e.getAttribute(a).trim()];if(v)e.setAttribute(a,v);});
  }
  if(d===document)d.documentElement.setAttribute('lang','en');
}
window.__TR=TR;window.__TRF=TRF;window.__TRdom=TRdom;
window.__TRlang=v=>{if(v==='ja'||v==='en'){try{localStorage.setItem('nc_lang',v);}catch(e){}location.reload();}return TRLANG;};
addEventListener('DOMContentLoaded',()=>TRdom());
</script>
`;

let html = fs.readFileSync(F, 'utf8');
// 本体スクリプトより前（three.min.js の読み込み直前）に入れる
const anchor = '<script src="lib/three.min.js"></script>';
if (!html.includes(anchor)) throw new Error('差し込み位置が見つからない');
if (html.includes('const TRX=')) throw new Error('すでにランタイムが入っている');
html = html.replace(anchor, runtime + anchor);

// ルールブック iframe は読み込み後に自分の DOM も差し替える
fs.writeFileSync(F, html);
console.log(`ランタイムを挿入。辞書 ${done}/${strings.length}件`);
console.log(`index.html.i18n: ${(html.length / 1024).toFixed(0)}KB`);
