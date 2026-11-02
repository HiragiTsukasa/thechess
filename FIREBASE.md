# Firebase のつなぎ方 ─ The Chess

目的は4つ。優先度の高い順。

1. **購入した対戦回数を端末の外へ**（アプリを消しても消えないように）
2. **レシート検証**（いまは無条件で「検証済み」扱い）
3. **サーバー時刻で日付判定**（端末の時計を戻して無料回数を増やす穴を塞ぐ）
4. ランクマッチの対戦相手・レート・リーダーボード（これは後回しでよい）

---

## 先に知っておくこと（2つ）

### ① Cloud Functions は Blaze プラン必須＝クレカ登録が要る

レシート検証はサーバーでしかできない（＝Cloud Functions）。
Functions のデプロイは**無料の Spark プランではできず、従量課金の Blaze プランが必要**。
Blaze にも無料枠はあるので、この規模なら実質ゼロ円で収まるが、**カード登録は避けられない。**

### ② 匿名認証のUIDは、アプリを消すと消える ★ここが肝

「Firebase にすれば購入が消えない」は**自動では成立しない。**
Firebase 匿名認証のUIDは端末内（WebView なら IndexedDB）に保存されるので、
アプリを削除すると新しいUIDになり、サーバー上の残高にたどり着けなくなる。

**なので、購入残高の鍵は匿名UIDではなく「App Store のレシート」にする。**
レシートは Apple 側が持っていて、再インストールしても `原取引ID（original_transaction_id）` が
同じまま復元できる。これが唯一、端末を跨いで購入を追える値。

```
　×  UID → 残高        （アプリ削除で迷子）
　○  原取引ID → 残高    （Apple が持っているので復元できる）
　    UID は「いまこの端末が誰か」を示すだけに使う
```

---

## 構成

| 使うもの | 用途 |
|---|---|
| Authentication（匿名） | 端末の識別。Firestore ルールの `request.auth.uid` に使う |
| Firestore | レート・対戦回数・購入残高の保存 |
| Cloud Functions | レシート検証／回数の増減／サーバー時刻。**ここが本体** |

### ★ 絶対の原則：回数をクライアントに書かせない

回数の増減は**すべて Functions 経由**にして、Firestore のルールでクライアントからの
write を禁止する。これをやらないと、localStorage の穴がそのままクラウドに移るだけで、
Firestore を直接叩いて回数を増やせてしまう。

```js
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /players/{uid} {
      allow read:  if request.auth != null && request.auth.uid == uid;
      allow write: if false;        // ← 書き込みは Functions だけ（Admin SDK はルールを迂回する）
    }
  }
}
```

---

## 手順

### 1. プロジェクトを作る

1. https://console.firebase.google.com/ で「プロジェクトを追加」
2. Google アナリティクスは**オフでよい**（アプリに解析を入れない方針なので、入れるとプラポリの書き換えが増える）
3. 「ウェブアプリを追加」（iOS アプリではなく**ウェブ**。Capacitor の WebView から JS SDK で叩くため）
4. 出てくる `firebaseConfig` を控える
5. Authentication →「匿名」を有効化
6. Firestore を作成（本番モードで。ルールは上のものに差し替え）
7. **プロジェクトを Blaze に上げる**（Functions のため）

### 2. SDK を同梱する

いまのアプリは外部通信ゼロで、Three.js もフォントも同梱してある。その方針を崩さないため、
**Firebase SDK も CDN ではなくファイルで置く。**

```bash
cd thechess-app
npm i firebase
# firebase/app, firebase/auth, firebase/firestore, firebase/functions を
# 1ファイルにバンドルして www/lib/firebase.js として出力する
npx esbuild --bundle --format=iife --global-name=FB --outfile=www/lib/firebase.js src/fb-entry.js
```

`src/fb-entry.js` は

```js
export {initializeApp} from 'firebase/app';
export {getAuth, signInAnonymously, onAuthStateChanged} from 'firebase/auth';
export {getFirestore, doc, onSnapshot} from 'firebase/firestore';
export {getFunctions, httpsCallable} from 'firebase/functions';
```

`index.html` の `<script src="lib/peerjs.min.js">` の隣に `<script src="lib/firebase.js">` を足す。

### 3. Functions を3本書く

```
functions/
└ index.js
    verifyPurchase   … レシートを検証し、残高に反映する
    spendPlay        … 対局開始時に1回引く
    refundPlay       … キング撃破で負けたとき1回戻す
```

`spendPlay` / `refundPlay` をサーバーに置くのは、**日付の判定をサーバー時刻でやるため**でもある。

```js
// functions/index.js （骨格）
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const PLAY_MAX = 4;

/* サーバー時刻のJST日付。端末の時計は一切見ない */
const jstDay = () => new Date(Date.now() + 9*3600*1000).toISOString().slice(0,10);

exports.spendPlay = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated','sign in first');
  const ref = db.doc(`players/${uid}`);
  return db.runTransaction(async (tx) => {              // ← 二重消費を防ぐ
    const s = await tx.get(ref);
    const p = s.exists ? s.data() : {free:PLAY_MAX, buy:0, unlim:false, day:jstDay()};
    if (p.day !== jstDay()) { p.day = jstDay(); p.free = PLAY_MAX; }   // 日付リセット
    if (p.unlim) { tx.set(ref, p, {merge:true}); return {ok:true, spent:'unlim', ...p}; }
    let spent = null;
    if (p.free > 0) { p.free--; spent = 'free'; }
    else if (p.buy > 0) { p.buy--; spent = 'buy'; }
    else throw new HttpsError('resource-exhausted','no plays left');
    p.lastSpend = spent;
    tx.set(ref, p, {merge:true});
    return {ok:true, spent, ...p};
  });
});
```

`verifyPurchase` の中身がレシート検証。**Apple は `verifyReceipt` を2023年6月に非推奨にして
App Store Server API を推奨**しているので、新規なら後者で書く。
Apple 公式の `app-store-server-library-node` を使うと、取引を自前で復号して検証できる。

```js
// 要点だけ
// 1. クライアントから受け取った transactionId を App Store Server API に問い合わせる
// 2. 返ってきた productId と originalTransactionId を確かめる
// 3. purchases/{originalTransactionId} が未処理なら、残高に +12 して「処理済み」に印をつける
//    ← この印が無いと、同じ取引で何度も +12 できてしまう（いまのアプリと同じ穴）
// 4. consumable は originalTransactionId が毎回変わるので、取引ごとに1回だけ付与される
```

必要な鍵：App Store Connect →「ユーザーとアクセス」→「キー」→ **In-App Purchase 用のキー**
（`.p8`）。Issuer ID と Key ID も控える。Functions のシークレットに入れる。

```bash
firebase functions:secrets:set APPSTORE_KEY_P8
firebase functions:secrets:set APPSTORE_KEY_ID
firebase functions:secrets:set APPSTORE_ISSUER_ID
```

### 4. ゲーム側の差し替え

**直すのはここだけ。** 永続化の接点が5か所しかないのが救い。

| 場所 | いま | Firebase 後 |
|---|---|---|
| `const RKS=(()=>{...})()` 付近 3664行 | localStorage から読む | 匿名ログイン → `players/{uid}` を購読。**届くまでは localStorage の値で描いておく** |
| `rkSave()` 3673行 | localStorage へ書く | レート・表示名・設定だけ書く。**回数は書かない** |
| `plSpend()` 3725行 | ローカルで1減らす | `spendPlay()` を呼ぶ |
| `plRefund()` 3730行 | ローカルで1戻す | `refundPlay()` を呼ぶ |
| `window.__IAP_APPLY` 3771行 | `RKS.buy += 12` | `verifyPurchase(transactionId)` を呼ぶ。**クライアントでは足さない** |

`www/iap.js` も直す。いまは `__IAP_APPLY({plays:12})` を呼んでいるが、
Firebase 後は**取引IDを渡すだけ**にして、数えるのはサーバーに任せる。

---

## ★ 決めること：オフラインで CPU 戦を遊べるようにするか

回数の管理をサーバーに移すと、**機内モードでは CPU 戦が始められなくなる。**
いまは完全オフラインで遊べるのが売りなので、ここは判断が要る。

| 案 | 内容 |
|---|---|
| A | オンライン必須にする。いちばん堅いが、電波が無いと遊べない |
| B | **オフラインでは無料ぶんだけ遊べる**ようにし、オンラインになったら同期。購入ぶんはオンライン時のみ。抜け道は「無料4回」の範囲に限定されるので実害が小さい ← 推奨 |
| C | いまのまま端末で数え、サーバーは控えとしてだけ持つ（穴は塞がらない） |

---

## 進める順番（おすすめ）

1. プロジェクト作成＋Blaze＋匿名認証＋Firestore ルール
2. `spendPlay` / `refundPlay` だけ先に入れる（レシート検証より簡単で、時計の穴が閉じる）
3. ゲーム側の5か所を差し替え、オフラインの扱い（上記A/B/C）を実装
4. `verifyPurchase` と App Store Server API
5. **プラポリを書き換えて再デプロイ**（`DECISIONS.md` の「Firebase 接続に伴う宿題」）
6. ランクマッチのマッチング・リーダーボード（最後でよい）

---

## 参考

- Apple の `verifyReceipt` 非推奨と App Store Server API への移行
  https://developer.apple.com/documentation/appstorereceipts
- Firebase の料金プラン（Functions は Blaze 必須）
  https://firebase.google.com/pricing
