# The Chess ─ アプリ化とリリースの手順

このファイルが通しの手順。細部は各所の README に分かれている。

- `thechess-app/README.md` … Capacitor まわり
- `thechess-app/resources/README.md` … アイコンの置き方
- `tools/voice/README.md` … 技名ボイスの作り直し
- `tools/i18n/README.md` … 英語対応
- `tools/bgm/README.md` … BGMのループ点と差し替え
- `DECISIONS.md` … 決まったこと／残っている判断
- `RELEASE-CHECK.md` … 最初の監査の記録（経緯）

---

## いまの状態

| | |
|---|---|
| アプリID | `com.shuji.thechess` |
| 課金 | `com.shuji.thechess.unlimited`（非消耗型・¥980）**1つだけ** |
| 最低OS | iOS 15.0 |
| 対象 | iPhone のみ・縦持ち固定 |
| 言語 | 日本語／英語（端末の言語で自動） |
| プライバシーポリシー | https://thechess-privacy.netlify.app/ |
| 外部通信 | 部屋対戦の時だけ（PeerJS）。CPU戦・パズル・ルールブックは通信ゼロ |
| BGM | OpenTracks の4曲（商用可・表記不要）。メニューでオンオフ |

`ios/` はこのリポジトリに入っていて、Xcode 側の設定も済ませてある。
**`npx cap add ios` は実行しないこと**（既存の設定が消える）。

---

## 手順

### 1. Mac で取ってくる

```bash
git clone https://github.com/HiragiTsukasa/thechess.git
cd thechess/thechess-app
npm install
```

必要なもの … macOS / Xcode 15以降 / Node 18以降 / Apple Developer アカウント

Capacitor 8 は CocoaPods ではなく Swift Package Manager を使うので `pod install` は不要。

### 2. アイコンを置いて生成する

```
resources/
├ icon.png     1024×1024  透過なし（アルファがあると審査で弾かれる）
└ splash.png   2732×2732  中央に収まる絵柄で。端は切られる
```

```bash
npx @capacitor/assets generate --ios
```

`ios/App/App/Assets.xcassets/` の AppIcon と Splash が各サイズで置き換わる。

### 3. Xcode を開く

```bash
npm run open
```

触るのは**2つだけ**。

1. **Signing & Capabilities** → Team を自分のアカウントに
2. **Signing & Capabilities** → ＋ Capability → **In-App Purchase** を追加

以下は設定済みなので触らなくてよい。

| 項目 | 値 |
|---|---|
| 画面の向き | 縦のみ |
| 対象端末 | iPhone のみ |
| 輸出コンプライアンス | 該当なし（提出のたびの質問が省ける） |
| 起動画面の背景 | `#0b0c0e`（既定のままだとライトモードで白く光る） |
| Bundle ID | `com.shuji.thechess` |

### 4. App Store Connect の準備

**商品を1つだけ作る。**

| 商品ID | 種別 | 価格 |
|---|---|---|
| `com.shuji.thechess.unlimited` | 非消耗型 | ¥980 |

- 消耗型（`plays12`）は**作らない**。回数制は廃止した
- プライバシーポリシーURL欄に https://thechess-privacy.netlify.app/ を入れる
- 「データ収集」の申告は**「収集しない」**。実際にサーバーへ何も送っていない
- 言語は**日本語と英語の両方**を登録する（アプリ本体が両対応なので）

### 5. 実機で確認する ★ここが必須

**ブラウザでは検証できない3つ。** ここを飛ばすと、買えないアプリを出すことになる。

| 確認 | 手順 | 何を見ているか |
|---|---|---|
| **購入** | 「ふつう」か「つよい」を押す → 購入パネル → 購入 → 鍵が外れる | `iap.js` を `deviceready` 待ちに直した効果。**元のコードは必ず失敗していた** |
| **復元** | アプリを削除 → 入れ直す → ホームの「購入を復元」 | 非消耗型の復元 |
| **部屋対戦** | 2台で、片方が「キーを作成」（製品版が必要）、もう片方が「キーを入力」 | `limitsNavigationsToAppBoundDomains` を外した影響 |
| **BGM** | タイトル→対局→ベアキング発動、と鳴り続けるか。メニューでオフにして無音になるか | 曲の入れ替えと、継ぎ目のループ。**本体の消音スイッチが入っていると鳴らない**（iOSの仕様。SEも同じ） |

Sandbox アカウントで購入を試すこと。

### 6. 提出

---

## 直したあとに流すもの

`www/index.html` を触ったら、言語の整合性だけは確認する。

```bash
cd tools/i18n
node check.js      # 未訳があれば終了コード1
```

Capacitor への反映は `npm run sync`。`ios/` の設定は保持される（確認済み）。

---

## 残っている判断

`DECISIONS.md` に詳しいが、いま残っているのは次の3つ。どれもリリースを止めるものではない。

| # | 内容 |
|---|---|
| A | App Store Connect の**英語版リスティング**（アプリ名・説明文・キーワード・スクリーンショット） |
| B | 表示名の UGC 対応。部屋対戦は6文字キーを口頭で渡した相手としか繋がらないので優先度は低い |
| C | ランクマッチの対人マッチング。いまは「ふつう」のCPUが相手（v2で Firebase、`firebase/` に土台あり） |

---

## やらないと決めたこと

後から「なぜ入っていないのか」と迷わないように残しておく。

- **回数制（1日4回）** … 廃止。ランクマッチから無制限に遊べる抜け道があり、アンストでも時計戻しでもリセットできた。買い切り1本にして、数えるものを無くした
- **消耗型の課金** … 廃止。端末削除で購入が消えるため
- **Firebase** … v1 では使わない。回数を数えなくなったのでサーバーが要らない
- **スマブラ風のボイス** … 差し替え済み。元は無料プランで生成したクローン音声で、規約・声優の権利・商標の三重に不可だった。いまは CC0 の合成音声
