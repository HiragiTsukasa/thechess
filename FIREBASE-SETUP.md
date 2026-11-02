# Firebase つなぎ込み ─ 作業手順

方針は決定済み。

- **The Chess 専用の新しいプロジェクトを作る**（CUBE TACTICS とは分ける）
- **オフラインでは無料ぶん（1日4回）だけ遊べる。** 購入ぶんはオンラインのときだけ

サーバー側（`firebase/`）は書いてあります。**あなたの作業はコンソールの設定と1回のデプロイだけ**です。

---

## A. Firebase コンソール（10分）

1. https://console.firebase.google.com/ →「プロジェクトを追加」
   - 名前は `thechess` など。**CUBE TACTICS のプロジェクトは選ばないこと**
   - **Google アナリティクスはオフ。** 入れると「解析を入れていない」と書いたプラポリの書き換えが増える
2. 作成後、左下の歯車 →「プロジェクトの設定」→ 下の「マイアプリ」→ **`</>`（ウェブ）** を選ぶ
   - iOS ではなくウェブ。Capacitor の WebView から JS SDK で叩くため
   - アプリ名は `The Chess`。「Firebase Hosting も設定する」は**チェックしない**
   - 出てくる **`firebaseConfig` を控える**（あとで使う）
3. 「構築」→「Authentication」→「始める」→ **「匿名」を有効化**
4. 「構築」→「Firestore Database」→「データベースの作成」
   - ロケーションは **`asia-northeast1`（東京）**
   - **「本番環境モード」**で開始（ルールはあとで上書きする）
5. 左下の歯車の下あたり →「使用量と請求」→ **プランを Blaze に変更**
   - Functions のデプロイに必須。無料枠があるのでこの規模なら実質ゼロ円
   - 請求先アカウントは CUBE TACTICS と同じものを選んでよい（カードは1枚でよい）
   - 心配なら「予算アラート」を 1,000円 などで設定しておく

## B. App Store Connect（5分）

1. 「ユーザーとアクセス」→「組み込み」→ **「App内課金」**タブ
2. 「鍵を生成」→ 名前は `The Chess server` など → **`.p8` をダウンロード（再取得不可）**
3. 同じ画面の **キーID** と **Issuer ID** を控える

> この鍵は**アカウント共通**で、CUBE TACTICS のレシートでも署名検証は通ります。
> そのため `functions/index.js` では `bundleId` と `productId` を
> `com.shuji.thechess` のものに限定してあります（そこは触らないこと）。

## C. デプロイ（コマンド3つ）

```bash
npm i -g firebase-tools
firebase login

cd thechess/firebase
cp .firebaserc.example .firebaserc
# .firebaserc の中身を、Aで作ったプロジェクトIDに書き換える

cd functions && npm install && cd ..

# Bで控えた3つを登録（対話で値を貼る）
firebase functions:secrets:set APPSTORE_KEY_P8      # .p8 の中身を丸ごと貼る（-----BEGIN から END まで）
firebase functions:secrets:set APPSTORE_KEY_ID
firebase functions:secrets:set APPSTORE_ISSUER_ID

firebase deploy --only firestore:rules,functions
```

デプロイできたら、コンソールの Firestore →「ルール」が
`allow write: if false` になっていることを目視で確認してください。**ここが生命線**です。

---

## D. ゲーム側（ここは私がやります）

`firebaseConfig` をもらえれば、以下を差し替えます。差し替え箇所は5つだけ。

| 場所 | いま | 後 |
|---|---|---|
| `const RKS=(()=>{...})()` | localStorage から読む | 匿名ログイン → `getPlays()`。**届くまでは localStorage の値で描く** |
| `rkSave()` | 全部 localStorage へ | レート・表示名・設定だけ。**回数は書かない** |
| `plSpend()` | ローカルで1減らす | `spendPlay()`。オフラインなら無料ぶんをローカルで減らして後で `syncOfflinePlays()` |
| `plRefund()` | ローカルで1戻す | `refundPlay()` |
| `__IAP_APPLY` | `RKS.buy += 12` | `verifyPurchase(transactionId)`。**クライアントでは足さない** |

`www/iap.js` も、回数を自分で数えるのをやめて取引IDを渡すだけにします。

---

## E. 最後に必ず：プライバシーポリシーの書き換え

いま公開中のページには **「開発者はサーバーを持っておらず、利用者のデータを受け取っていません」
「端末の中にだけ保存」** と書いてあります。**Firebase をつないだ時点でこれは嘘になります。**

書き換える箇所は `DECISIONS.md` の「Firebase 接続に伴う宿題」に4点まとめてあります。
ソースは `privacy/index.html`、再デプロイのコマンドもそこに書いてあります。
**App Store Connect の「データ収集」申告も揃えること。**

---

## 用意したもの

```
firebase/
├ firebase.json            デプロイ設定（Node 22）
├ firestore.rules          ★クライアントの write を全面禁止
├ firestore.indexes.json
├ .firebaserc.example      プロジェクトIDを入れて .firebaserc にコピー
└ functions/
   ├ package.json          @apple/app-store-server-library 3.1.0 ほか
   └ index.js              関数5本
```

| 関数 | 役割 |
|---|---|
| `getPlays` | 残高を読む（初回はここで作る） |
| `spendPlay` | 対局開始時に1回引く。トランザクションで二重消費を防止 |
| `refundPlay` | キング撃破で負けたときだけ1回戻す |
| `syncOfflinePlays` | オフラインで使った無料ぶんを後から反映。**1日4回の枠を超えない** |
| `verifyPurchase` | レシート検証。`purchases/{originalTransactionId}` に印をつけて**消耗型の二重付与を防止** |

日付判定はすべて `jstDay()`（サーバー時刻のJST）で、端末の時計は一切見ません。
