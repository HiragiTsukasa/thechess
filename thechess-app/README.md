# The Chess: Groundbreaking — iOS アプリ化キット

`www/` の中身がそのままアプリの画面になります。通信は一切しません（Three.js・PeerJS・フォントは全部同梱）。
部屋対戦だけは PeerJS の公開シグナリングを使うので、そこだけネットが要ります。

## 中身

```
thechess-app/
├ package.json          Capacitor 8.6 の依存とスクリプト
├ capacitor.config.json アプリID・名前・iOS設定
├ resources/            アイコンとスプラッシュを置く場所（今は空）
└ www/
  ├ index.html          ゲーム本体（約1MB）
  ├ iap.js              Apple課金とゲームを繋ぐ層
  ├ lib/three.min.js    r128
  ├ lib/peerjs.min.js   1.5.4
  └ fonts/*.woff2       明朝・Dela Gothic・等幅（日本語は使用文字だけに削ってある。全部で約500KB）
```

## Mac での手順

必要なもの … macOS / Xcode 15以降 / Node 18以降 / Apple Developer アカウント

`ios/` はこのリポジトリにコミット済みなので、`cap add ios` は要りません。
向き・輸出コンプライアンス・起動画面の背景色・iPhone専用の設定は**入れてあります**。

```bash
cd thechess-app
npm install                             # ① 依存を入れる（package-lock.json で固定済み）

# ② 用意したアイコンを置く（詳しくは resources/README.md）
#     resources/icon.png     1024×1024・透過なし
#     resources/splash.png   2732×2732

npx @capacitor/assets generate --ios    # ③ 各サイズを生成して ios/App へ
npm run open                            # ④ Xcode が開く
```

Capacitor 8 は CocoaPods ではなく **Swift Package Manager** を使うので、`pod install` は不要です。

Xcode 側で触るのは**2つだけ**です（向きと端末種別は設定済み）。

1. **Signing & Capabilities** … Team を自分のアカウントにする。Bundle Identifier は `jp.epg.thechess`（変えるなら `capacitor.config.json` の `appId` も合わせる）
2. **Signing & Capabilities → ＋ Capability** … `In-App Purchase` を追加

### 設定済みの項目（触らなくてよい）

| 項目 | 値 | どこ |
|---|---|---|
| 画面の向き | 縦のみ | `ios/App/App/Info.plist` |
| 対象端末 | iPhone のみ | `TARGETED_DEVICE_FAMILY = 1` |
| 輸出コンプライアンス | 該当なし | `ITSAppUsesNonExemptEncryption = false`（提出のたびの質問が省ける） |
| 起動画面の背景 | `#0b0c0e` | `LaunchScreen.storyboard`（既定のままだとライトモードで白く光る） |
| 必要CPU | arm64 | 既定の armv7 は32bit機用で実態と合わないため |
| Bundle ID / 最低OS | `jp.epg.thechess` / iOS 15.0 | `project.pbxproj` |

これで実機にビルドすれば動きます。`www/` を直したあとは `npm run sync` だけで反映されます。

### 実機で必ず確認すること

ブラウザでは検証できない3つ。

1. **購入** … 「ふつう」か「つよい」を押す → 購入パネル → 購入が通り、鍵が外れるか
2. **購入を復元** … アプリを削除して入れ直し、ホームの「購入を復元」で戻るか
3. **部屋対戦** … 2台で、片方が「キーを作成」（製品版が必要）、もう片方が「キーを入力」で繋がるか

1 と 2 は `www/iap.js` を `deviceready` 待ちに直した効果の確認でもあります。3 は
`capacitor.config.json` から `limitsNavigationsToAppBoundDomains` を外した影響の確認です。

## 難易度

| メニュー | 中身 |
|---|---|
| やさしい | 1手読み・ノイズあり・25%でランダム（無料） |
| ふつう | 2手読み＋上位10手3手目＋定石加点（旧「つよい」） |
| つよい | αβ探索＋反復深化＋静止探索、評価関数 safety-v2。1手 `GM_MS`=1500ms まで考える |

ランクマッチの相手は対人マッチングが入るまで「ふつう」のCPU（表示名は生成）。

## 課金の繋ぎこみ

`www/iap.js` に書いてあります。ゲーム本体は触らなくていいです。

App Store Connect で商品を2つ、同じIDで作ります。

| 商品ID | 種別 | 中身 |
|---|---|---|
| `jp.epg.thechess.unlimited` | 非消耗型 | 無制限版 |
| `jp.epg.thechess.plays12` | 消耗型 | 対戦回数 +12 |

ゲーム側は `window.__IAP.buy('unl'\|'p12')` と `window.__IAP.restore()` を呼ぶだけで、
結果は `window.__IAP_APPLY({unlim:true})` / `({plays:12})` で返ってきます。
メニューの「購入を復元」ボタンはもう `restore()` に繋がっています。

**消耗型の残高を Apple は覚えてくれません。** 今は端末の localStorage に持っているので、
アプリを消すと買った回数も消えます。本番前に Firebase 側へ移してください（下の「残り作業」）。

## 残り作業

リリース前チェックの結果は リポジトリ直下の `RELEASE-CHECK.md`、
そのうち**判断が要るもの**は `DECISIONS.md` にまとめてあります。まずそちらを見てください。

1. **アイコンとスプラッシュ** … `resources/icon.png`（1024×1024）と `resources/splash.png`（2732×2732）を置いて `npx @capacitor/assets generate --ios`
2. **プライバシーポリシーのURL** … ボタンは配線済みですが、URLが空です。`index.html` の `TERMS_URL`（grep で一発）に入れてください。審査で必須
3. **課金の実機確認** … `www/iap.js` は `deviceready` 待ちに直しましたが、**実機ではまだ一度も通していません**。購入・復元の両方を必ず確認。商品は **`jp.epg.thechess.unlimited`（非消耗型・¥300）の1つだけ**。無料版は「オフライン・やさしい」のみで、ふつう／つよい／ランクマッチが開放されます
4. **`limitsNavigationsToAppBoundDomains`** … `capacitor.config.json` で `true` にしていますが、Info.plist に `WKAppBoundDomains` がありません。部屋対戦が繋がるか実機で確認のうえ、消すかキーを足すか決めてください
5. **Firebase** … ランクマッチの対戦相手・レート・対戦回数・購入残高をサーバーへ。日付もサーバー時刻にすれば端末の時計を戻して回数を増やす抜け道が閉じます
6. **レートの最終数値** … 参加費・基礎報酬・勝敗・内容ボーナスは今の値が仮です

## 動作確認したこと

外部通信を全部ブロックした状態で起動 → 通信ゼロ・エラーゼロ・3D盤とフォント表示OK・ルールブックの32デモ全部OK。
