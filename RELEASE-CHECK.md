# The Chess ─ iOSリリース前チェック結果

検査日 2026-11-02 / 対象 `thechess-app/www/`（zip同梱の実ビルド）
方法 ヘッドレスChromium（iPhone相当・390×844・タッチ）で実起動＋コード精査。
数値はすべて実測かコード上の実値。

---

## 判定

**今のままでは提出できない。** ブロッカーが3つ（課金が起動しない疑い・プライバシーポリシー・アイコン）。
一方で、ゲーム本体の品質は高い。**実起動でエラー0、外部通信0、92戦のシミュレーションで例外0、パズル25問すべて成立。**

> **【その後の対応】** この文書は初回監査の記録です。
> 機械的に直せるものは `thechess-app/` に適用済み（A-1・A-2の配線・B-2・C-2・C-3・C-4・C-5・D-2・D-7）。
> **残り＝判断が要るものは `DECISIONS.md` にまとめました。** 以下の各項は「見つかった時点」の記述のままです。

---

## A. リリースブロッカー

### A-1. 課金が起動しない可能性が極めて高い ★最重要

`www/iap.js` はスクリプトのパース時にそのまま走り、先頭でこう判定している。

```js
function ready(){ return window.CdvPurchase && window.CdvPurchase.store; }
if(!ready()){ return; }     /* ブラウザで開いたときは何もしない */
```

ところが `cordova-plugin-purchase` の `plugin.xml` を見ると `store.js` は

```xml
<js-module src="www/store.js" name="CdvPurchase">
  <clobbers target="CdvPurchase" />
```

という **cordova の js-module** で、`window.CdvPurchase` が生えるのは cordova のブートストラップ
（`DOMContentLoaded` 以降）。`iap.js` は `<body>` 内でパース中に実行されるので、**その時点ではまだ未定義**。

結果として `window.__IAP` が作られず、購入ボタンは

```js
if(!DEVBUY){ toast('購入はアプリ版で有効になります'); return; }
```

に落ちる。**アプリ版なのに「アプリ版で有効になります」と出て何も買えない。**
商品を2つ登録して提出しているのに購入できない状態なので、審査は確実に落ちる。

→ 修正版を `fixes/iap.js` に置いた。`deviceready` を待つようにしてある。**実機で必ず確認すること。**

### A-2. プライバシーポリシー／利用規約が死んでいる

```html
<button class="rw rwb" type="button" id="hmRestore"><span>購入を復元</span><em>›</em></button>
<div class="rw"><span>利用規約 / プライバシー</span><em>›</em></div>
```

上は `<button>`＋id付きでハンドラあり。下は **ただの `<div>`。id もハンドラも無い。**
`›` が付いていて押せそうに見えるのに何も起きない（＝見た目の矛盾でもある）。

審査では App Store Connect のプライバシーポリシーURL欄が必須。アプリ内導線も用意しておくのが安全。Guideline 5.1.1。

### A-3. アイコンとスプラッシュが無い

zip に `resources/` が存在しない。1024×1024 のアイコン無しでは**そもそもビルド提出ができない**。

```bash
# resources/icon.png (1024x1024) と resources/splash.png (2732x2732) を置いてから
npx @capacitor/assets generate --ios
```

---

## B. 課金まわりの穴（有料リリース前に必須）

### B-1. レシート検証がゼロ

`store.validator` を設定していない。プラグインのソースで確認したところ、validator 未設定のとき

```js
if (!this.controller.validator) {
    // for backward compatibility, we consider that the receipt is verified.
    callback({ receipt, payload: { ok: true, ... } });
```

**無条件で「検証済み」として通す。** つまり購入自体は動くが、検証は一切されていない。

### B-2. 消耗型が何度でも付与されうる

```js
window.__IAP_APPLY=function(o){
  if(o.plays)RKS.buy=plBuy()+(o.plays|0);   // ← transactionId で重複排除していない
```

`verified` が再発火するたびに +12 される。**「購入を復元」を押すたびに回数が増える**恐れがある。
`fixes/iap.js` では transactionId を記録して一度だけ反映するようにした。

### B-3. 残高が端末の localStorage だけ

アプリを消すと購入した回数も消える（README も認識済み）。返金・低評価の原因になる。
Firebase 側へ移すまでは、少なくとも消耗型（`plays12`）の販売は止めることも検討の価値がある。

---

## C. 実際の動きの矛盾

### C-1. 決着しない対局が実在する ★実測

サドンデスを本当に効かせた状態で CPU 同士を2000手まで回した結果。

| 対戦 | 勝敗がついた | 2000手で未決着 | 到達した stallN |
|---|---|---|---|
| つよい vs つよい | 0 / 8 | **8 / 8** | 1618〜1944 |
| ふつう vs つよい | 1 / 8 | 7 / 8 | 1744〜1968 |
| ふつう vs ふつう | 3 / 8 | 5 / 8 | 400〜1763 |
| やさしい vs ふつう | 8 / 8 | 0 / 8 | — |

`stallN` が1900ということは **1900手連続でダメージが出ていない**。
サドンデスは `MAXADD:2`（+200%）で頭打ちになり、そこから先は何も起こらない。
加えて**引き分け・手数上限の終了条件が無い**（`endGame(null)` は「動ける手が無い」時だけ）。

人間が殴りにいけば終わるので即バグではないが、**CPUが不利になると延々と逃げ回る**挙動になる。
投了すると回数は戻らない仕様なので、ユーザーは「終われないのに投了すると損」という状態に置かれる。

→ 手数上限（例：200手で残HP合計の多い方の勝ち）か、サドンデスの上限撤廃を推奨。

### C-2. 新規プレイヤーがいきなり Queen Ⅱ

```js
if(!o.rate)o.rate=RKT.BASE+11*RKT.STEP+40;   // = 1200 + 1320 + 40 = 2560
```

`RKT={BASE:1200,STEP:120}` なので **2560 ＝ 18段中12段目＝Queen Ⅱ**。
仕様書の「レート1200から120刻み」どおりなら Pawn Ⅰ スタートのはず。デバッグ値の消し忘れに見える。

### C-3. 「開催中 23:00まで」が常に出る

```html
<div class="livez"><span class="dot"></span>開催中<em>23:00まで</em><b id="rkLeft"></b></div>
```
```js
$('rkLeft').textContent='';    // 常に空
```

仕様では 9:00〜23:00 開催だが、**時刻を見ているコードが無い**。深夜3時でも「開催中」と表示される。

### C-4. 無料回数のリセットが UTC 基準

```js
const day=new Date().toISOString().slice(0,10);   // ← UTC
if(o.day!==day){o.day=day;o.left=4;}
```

`toISOString()` は UTC。日本時間だと **毎朝9時** に「本日の残り」が戻る。
仕様書の「日付が変わると戻る」と食い違う。`o.left=4` が `PLAY_MAX` ではなくハードコードなのも直しておきたい。

### C-5. コピーに失敗しても成功トーストが出る

```js
$('hmCopy').addEventListener('click',()=>{try{navigator.clipboard.writeText(RKS.uid);toast('IDをコピーしました');}catch(e){}});
```

`writeText()` は Promise を返すので、拒否されても `catch` に入らない。失敗しても「コピーしました」と出る。

---

## D. 要確認・軽微

| # | 内容 |
|---|---|
| D-1 | `capacitor.config.json` の `limitsNavigationsToAppBoundDomains: true`。Capacitor公式は **Info.plist に `WKAppBoundDomains` がある場合に推奨**としており、その際は `localhost` もリストに要追加。キーが無いまま true にする組み合わせは想定外。READMEにも手順が無い。外すか plist を足すか決めること |
| D-2 | `ON.db = window.claude && await window.claude.use('db')` — Claude Artifacts 用APIの残骸。ガードされているので落ちないが、iOSでは常に undefined。削除してよい |
| D-3 | オンラインは PeerJS の公開クラウド（0.peerjs.com）依存。審査時に落ちていると「オンライン」が動かず Guideline 2.1 リスク |
| D-4 | 表示名が対戦相手に見える＝ユーザー生成コンテンツ。通報・ブロック導線が無く Guideline 1.2 を突かれる可能性 |
| D-5 | 「リーダーボード」に実データが無く、階級の凡例のみ |
| D-6 | Three.js のジオメトリを `dispose()` していない（`setup()` は `scene.remove` のみ、ファイル全体で `.dispose()` は2箇所）。ただし **15回連続で新規対局を開始してもJSヒープは 9.76→11.63MB で増え続けなかった**（GCが回収）ので実害は小さい。GPU側は未検証 |
| D-7 | `nextTurn()` の `const [p,m]=cpuChoose(turnSide)` に null ガードが無い（`__G.sim` 側にはある）。`cpuEasy` 等は Homecoming を除外した結果 `mine` が空になると undefined を返しうる。92戦では一度も起きなかったので優先度は低い |

---

## E. 仕様書と実装の食い違い

| 仕様書の記述 | 実際 |
|---|---|
| 「音はすべて WebAudio で合成。**音声ファイルを持たない**」 | **base64のMP3ボイスが33本、382KB 埋まっている**（ファイル1.0MBの約38%）。技名の読み上げ用 |
| 保存キーは4種 | 実際は5つ。`nc_tut1` / `nc_tut2` が表に無い |
| ルールブックのタブ「遊びかた／駒／技／タクティクス」 | タブは「遊び方／駒／技」。タクティクスはタブではなく技タブ内のフィルタ |

※ ボイスはID3に `Lavf60`（ffmpeg）の痕跡あり。**TTS由来なら商用利用可否のライセンス確認を**。

---

## F. 問題が無かったところ（実測）

- **起動**：コンソールエラー0、`pageerror` 0、**外部通信0件**（オフライン完全成立を確認）
- **安定性**：CPU対CPU 92戦（easy/normal/hard の全組み合わせ）で**例外0**
- **パズル**：25問すべて、目標の技が1手で成立することを `__T.probe` で確認（詰み問題なし）
- **技**：32種が仕様書と完全一致（タクティクス16／発動3／常時10／結果3）
- **定数**：`HPMAX` `UNITP` `VAR` `CRIT_RATE/MUL` `KING_VS_OTHERS` `VALUE` `K_` `BARE` `SD` `RRATE` すべて仕様書の値と一致
- **ルールブック**：iframe内エラー0、親の `THREE`/`__RB` を共有、デモcanvasは全て描画あり（0×0なし）
- **CPU思考時間**（初期局面）：やさしい 2ms／ふつう 17ms／つよい 31ms — 体感に出ない速さ
- **AI強度の序列**：つよい vs やさしい は 10勝0敗。期待どおり
- **依存関係**：npm 6パッケージすべて実在、かつ最新（Capacitor 8.6.0 / cordova-plugin-purchase 13.20.0）
- **safe-area**：`viewport-fit=cover` ＋ `env(safe-area-inset-*)` を9箇所で使用。ノッチ対応済み
- **iOS非対応API**：使用なし（`webkitAudioContext` フォールバックも入っている）

---

## 推奨する着手順

1. `fixes/iap.js` を `www/iap.js` に差し替え、**実機で購入・復元を通す**（A-1 / B-2）
2. プライバシーポリシーのページを用意し、`<div>` を `<button>` にして繋ぐ（A-2）
3. アイコン・スプラッシュ生成（A-3）
4. 新規レートを 1200 に戻す（C-2）
5. 手数上限の決着条件を入れる（C-1）
6. 日付判定をローカル時刻に、`o.left` を `PLAY_MAX` に（C-4）
7. `limitsNavigationsToAppBoundDomains` の扱いを決める（D-1）
8. Firebase へ残高を移すまでは消耗型の扱いを再検討（B-3）
