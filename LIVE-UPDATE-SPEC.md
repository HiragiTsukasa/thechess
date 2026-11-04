# ライブアップデートの仕様（CUBE TACTICS から移す形）

**審査を通さずに、JS と HTML の直しを数分で実機へ届ける。** CUBE TACTICS で動くまでに
払った授業料ごとまとめたもの。★の付いた行は、**全部こちらで実機で踏んだ穴**。

CUBE TACTICS 側の正は `tools/build-live.py`／`docs/native/firebase/README.md`／
`docs/native/firebase/NEXT-BUILD.md`、画面側は `index.html` の `capUpd`／`liveInit`／`liveGo`／`liveSt`。

---

## 0. 結論

| | |
| --- | --- |
| 使う部品 | **`@capgo/capacitor-updater`**（Capacitor のプラグイン）。**Capgo の有料クラウドは使わない** |
| 置き場 | **Firebase Hosting**（無料の Spark で足りる。従量課金の経路なし） |
| 費用 | **0円。** Cloud Functions も CDN 契約も要らない |
| 出せるもの | **JS と HTML と、zip に入れた素材だけ** |
| 出せないもの | ネイティブの部品（Swift・プラグイン追加）、アプリの説明と食い違う新機能 → **ストアの更新** |
| 要る道具 | Node・Python・git・`firebase-tools`。★**Windows だけで完結する。Mac も Xcode も要らない** |
| 届くまで | 1回目の起動で裏で取り、**閉じて開き直した2回目から**新しい版になる |
| 失敗したら | 新しい版で起動できなければ、プラグインが自動で前の版へ戻す |

★**いちばん大事な前提：部品が「いま配っているストアの版」に入っていないと、一生届かない。**
あとから入れるには審査が1回要る。**だからチェスでは、次に出す版へ先に入れておく。**

---

## 1. 仕組み

```
Windows                         Firebase Hosting              iPhone（アプリ）
build-live.py  ──zip＋印──▶  /live/2026.11.1.zip         起動
                            /live/latest.json             │
                              { version, url, checksum }  ├─ latest.json を見る
                                                          ├─ 版が大きければ zip を取る
                                                          ├─ sha256 を照合
                                                          └─ next() ＝次の起動から使う
```

- **版の比べ方は「文字列として大きいか」ではなく SemVer**（下の 3 参照）。
- `latest.json` は**いつも最新の1つだけ**を指す。古い版を使っている端末は**自分の中に**持っている。

---

## 2. アプリ側（包むときに1回だけ）

```
npm i @capgo/capacitor-updater
npx cap sync ios
```

`capacitor.config.json` の `plugins` に足す：

```json
"CapacitorUpdater": { "autoUpdate": false }
```

★**`autoUpdate` は必ず `false`。** 既定の `true` だとプラグインが **Capgo 自身のクラウド**を
見に行き、こちらが手で入れた版を**起動のたびに元へ戻す**。

★**archive の前に、この3行を必ず確かめる**（チェスの `thechess-app` で）：

```
grep capgo package.json
```
```
grep -i capgo ios/App/Podfile.lock
```
```
cat capacitor.config.json
```

**2行目がいちばん大事。** `Podfile.lock` に出なければ**アプリの実体に入っていない**＝
ライブは絶対に届かない。**`npm i` はしたのに `npx cap sync ios` を archive の前に
通していない**——これがいちばん起こりやすい。

---

## 3. HTML 側に入れるもの

### (1) 版の数字（チェスにはまだ無い）

```js
const APP_VER='2026.11.1';
```

★★**「数字.数字.数字」のちょうど3つ**にする。Capgo は版を **SemVer として厳しく見る**ので、
`2026.11.03.1` のような**4つ区切りは受け取らない**。**頭に 0 の付く数字（`03`）も不可。**
CUBE TACTICS は **年.月.その月の何回目**（`2026.11.1` → 次は `2026.11.2`）にしてある。

★**この数字を画面のどこかに出すこと。** CUBE TACTICS は設定の最下行。
**出していないと、実機で「入れ替わったか」を確かめる方法が無い。**
ストアの「1.1」はアプリの中のどこにも出ないので、遊ぶ人も確かめられない。

### (2) プラグインの橋

```js
function capUpd(){try{
  const C=window.Capacitor; if(!C)return null;
  const p=C.Plugins&&C.Plugins.CapacitorUpdater; if(p)return p;
  if(typeof C.registerPlugin==='function')return C.registerPlugin('CapacitorUpdater')||null;
  return null;
}catch(e){return null;}}
```

★**`Capacitor.Plugins` に並ばないことがある**ので `registerPlugin` でも架ける。
ただし架かっても**本当に有るとは限らない**ので、下の `notifyAppReady()` が通るかで判定する
（Promise なので `try/catch` では捕まらない）。

### (3) 取りに行く本体

```js
function liveInit(){
  const U=capUpd(); if(!U){ liveSt('生: 部品なし'); return; }
  Promise.resolve(U.notifyAppReady()).then(function(){ liveGo(U); },
    function(e){ liveSt('生: 部品なし '+e); });
}
function liveGo(U){
  if(!fbReady()){ liveSt('生: 設定なし'); return; }
  liveSt('生: 見に行った');
  fetch('https://'+FB.projectId+'.web.app/live/latest.json',{cache:'no-store'})
    .then(r=>r.ok?r.json():null)
    .then(function(m){
      if(!m||!m.version||!m.url){ liveSt('生: 紙が読めない'); return; }
      if(!verGt(m.version,APP_VER)){ liveSt('生: 最新 '+m.version); return; }
      if(!m.checksum){ liveSt('生: 印が無い '+m.version); return; }
      liveSt('生: 取得中 '+m.version);
      return Promise.resolve(U.download({url:m.url,version:m.version,checksum:m.checksum}))
        .then(b=>Promise.resolve(U.next({id:b.id}))
        .then(function(){ liveSt('生: 次回 '+m.version); }));
    }).catch(function(e){ liveSt('生× '+e); });
}
```

★★**`download()` には zip の sha256（小文字16進）を必ず渡す。**
新しい Capgo は自前配信のとき**必須**で、無いと `No checksum provided / Checksum required`
で弾く。**これが抜けていたせいで、CUBE TACTICS のライブは一度も届いていなかった**（2026-11-04）。

`verGt` は SemVer の比較（`2026.11.2 > 2026.11.1`）。`cache:'no-store'` を忘れると古い紙を見る。

### (4) ★どこで止まったかを実機で読めるようにする

`liveInit` は失敗を全部 `.catch` で握りつぶすので、**何もしないと「届かない」としか分からず、
部品が入っていないのか版の形が悪いのかを切り分けられない**（CUBE TACTICS で半日溶かした）。
`localStorage` の別の鍵に印を残して、版の行の後ろに出す。

```js
const LIVE_KEY='tc_live_v1';
function liveSt(s){ try{ localStorage.setItem(LIVE_KEY,String(s).slice(0,40)); }catch(e){} }
function liveTxt(){ try{ return localStorage.getItem(LIVE_KEY)||''; }catch(e){ return ''; } }
```

| 出る印 | 意味 |
| --- | --- |
| `生: 部品なし` | プラグインがアプリに入っていない（理由も続く） |
| `生: 設定なし` | `FB` が空 |
| `生: 見に行った` | `latest.json` を取りに行ったまま（通信が届いていない） |
| `生: 最新 〇〇` | 置いてある版が、いまの版より新しくない |
| `生: 取得中 〇〇` | zip を落としている途中で終わった |
| `生: 次回 〇〇` | **成功。次の起動から新しい版** |
| `生× …` | 落とす／入れるところで失敗（理由つき） |

★**セーブの鍵とは別にする。** 混ぜると引き継ぎや控えに乗って出ていく。

---

## 4. 置き場（Firebase Hosting）

★**`firebase init hosting` は走らせない。** 対話が public ディレクトリを間違えやすく、
「`public/index.html` を上書きするか」まで聞いてくる。**設定をリポジトリに入れておく。**

`firebase.json`（チェスは `firebase/` に Firestore 用のものがあるので、**hosting の節を足す**）：

```json
"hosting": {
  "public": "hosting/public",
  "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
  "headers": [
    { "source": "/live/latest.json",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }] },
    { "source": "/live/*.zip",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

★**`latest.json` は `no-store`。** でないと CDN が古い紙を返し続ける。
`.firebaserc` に `{"projects":{"default":"<projectId>"}}`。

はじめの1回だけ：`npm i -g firebase-tools` → `firebase login`。

★**ログインできない／鍵のファイルでやるなら**、サービスアカウントの JSON を作り
`GOOGLE_APPLICATION_CREDENTIALS` に渡す。そのとき権限は **Firebase Hosting 管理者だけでは足りない**
——`Permission denied to get service [firebasehosting.googleapis.com]` で止まる（Service Usage のほう）。
**編集者（レガシー）**を付けると通る。
★**その JSON は鍵。リポジトリのフォルダの中には置かない。**

★**`hosting/public/live/` は .gitignore する。** Hosting は**ローカルに無いファイルを
サーバーから消す**ので、各マシンは自分が作った zip だけを置けばよい（古い zip は消えて困らない）。

---

## 5. 版を出す手順（3行。1行ずつ貼る）

```
git pull
```
```
python tools\build-live.py
```
```
firebase deploy --only hosting
```

- `APP_VER` を**前より大きい数**にしてから。
- ★**審査中は出さない。** 提出した版も起動のたび `latest.json` を見るので、**審査する人の端末にも降りる。**
- `firebase deploy` に `--info` のような旗は無い（`--only hosting` だけ）。

---

## 6. 作る側（`tools/build-live.py`）

CUBE TACTICS 版は単一HTMLなので `index.html` 1枚を zip している。**チェスは `www/` が多ファイル**
なので、ここだけ書き替える。要るのは4つ。

1. `APP_VER` を読む → **SemVer でなければ書き出しを止める**（★形の間違いは実機では見えない）
2. `www/` を zip にする
3. **zip 全体の sha256 を計算する**
4. `latest.json` に `{version,url,checksum}` を書く

```python
import os,re,json,zipfile,hashlib
ver=re.search(r"const APP_VER='([0-9.]+)'",src).group(1)
if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', ver):
    raise SystemExit('APP_VER が SemVer ではない: '+ver)
# www/ をそのまま zip（中の道は www/ からの相対）
sm=hashlib.sha256(open(zp,'rb').read()).hexdigest()
json.dump({'version':ver,'url':url,'checksum':sm}, open(latest,'w'))
```

---

## 7. ★チェス固有の壁（CUBE TACTICS には無かった問題）

### (1) zip は「新しい web ルート」なので、全部入りにする

Capgo は落とした zip を**新しい web ルートとして差し替える**。**zip に入っていないファイルは
404 になる。** チェスの `www/` は `index.html` のほかに `iap.js`・`lib/`（peerjs・three）・
`fonts/`・`bgm/` を持っているので、**index.html だけを zip にすると、更新した瞬間に
3D と通信と字と曲が全部死ぬ。**

実測（2026-11-04・`thechess-app/www` をそのまま zip）：

| 中身 | ファイル | zip |
| --- | --- | --- |
| www 全部 | 16 | **7,858 KB** |
| mp3 を除く | 12 | **1,244 KB** |

★**「index.html だけで足りるか」は未実測。** 上の仕組みからは 404 になるはずだが、
**実機1回で分かる**ので、最初のライブは**全部入り**で出して、次に試す。

### (2) ★BGM の mp3 を公開ウェブに置くことになる

チェスの BGM は OpenTracks の4曲で、**mp3 をそのままウェブに置くのは禁止**
（禁止7 配布・禁止8「コンバート等を行わず容易にアクセスできる状態」）。
**`live/*.zip` は URL を知れば誰でも取れる公開ウェブ**なので、中に素の mp3 を入れると
そのまま踏む。CUBE TACTICS で一度やって公開から外した（2026-10-25）。

道は3つ。**どれかを決めてから部品を入れる。**

1. ★**mp3 を index.html へ base64 で埋める**（CUBE TACTICS と同じ形。「コンバート済み・
   直接は取れない」で禁止8 を外れる、という同じ結論に乗る）。**zip の大きさは変わらない**
   （base64 は zip で元の大きさに戻るので、実測の 7.9MB のまま）
2. **曲を、ウェブ配置を許す素材（CC0 など）に差し替える**。制約そのものが消える
3. **ライブでは曲を触らない**——は**選べない**。(1) のとおり zip は全部入りなので、
   曲の直しに関係なく毎回 mp3 が公開ウェブに乗る

---

## 8. 払った授業料（全部実機で踏んだ）

1. ★★**`download()` の `checksum` 抜け。** `No checksum provided / Checksum required`。
   **これだけでライブは一度も届かなかった。** `latest.json` にも置き場にも異常は無く、
   HTTP 200・SHA-256 一致で、**実機では「版が変わらない」としか見えなかった**
2. ★**版が4つ区切り**（`2026.10.31.4`）。SemVer として読めず `.catch` に落ちて**黙って終わる**
3. ★**失敗を全部握りつぶしていた。** だから 1 と 2 を切り分けられなかった
   → `liveSt` を付けてから30分で終わった
4. ★**突き止めたのは Safari の Web インスペクタ。** ただし **TestFlight／ストアの版は覗けない**
   （iOS 16.4 以降 `isInspectable` が要り、Capacitor はデバッグビルドでしか立てない）。
   **`npx cap open ios` → Xcode から実機へ入れた版**で見る。
   ★**そのとき `www` は書き換えない**——古いままのほうが失敗を再現できる
5. ★**`autoUpdate: true`（既定）** のままだとプラグインが Capgo のクラウドを見て、
   手で入れた版を起動のたびに戻す
6. ★**`npm i` はしたが archive の前に `npx cap sync ios` が通っていない。**
   `package.json` には出るのに `Podfile.lock` には無い＝アプリの実体には入っていない
7. ★**Hosting の権限不足。** Firebase Hosting 管理者だけでは `firebase deploy` が 403
   （Service Usage）。**編集者（レガシー）**で通った

---

## 9. 使い分け

| やること | 出し方 |
| --- | --- |
| 数字の調整・不具合の直し・画面の直し・文言 | **ライブ**（審査なし・数分） |
| 素材（曲・絵・字）の差し替え | ライブ（zip に入るので。ただし 7 の (2)） |
| 課金を足す・ネイティブの部品を足す・ゲームの目的が変わる変更 | **ストアの更新**（審査） |

★**ストアの版を出すときは Version も上げる**（`1.0` の train は閉じるので `1.1` にしないと
「Invalid Pre-Release Train」で弾かれる）。Build だけ上げても通らない。
