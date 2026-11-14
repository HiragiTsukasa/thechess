# ライブアップデートの仕様（The Chess）

審査を通さずに JS・HTML・素材を実機へ届ける。**CUBE TACTICS で実際に届いた仕様**
（`LIVE-UPDATE-SPEC` 2026-11-05 版）を土台に、チェス側で**実装を読んで裏を取り直した**もの。

CUBE と違うところには【チェス】を付けた。**そこを CUBE のまま進めると詰まる。**

| | |
| --- | --- |
| 部品 | `@capgo/capacitor-updater` 8.54.2。**Capgo の有料クラウドは使わない** |
| 置き場 | Firebase Hosting（無料の Spark。従量課金の経路なし） |
| 費用 | 0円 |
| 出せる | JS・HTML・zip に入れた素材 |
| 出せない | ネイティブの部品、課金商品の追加、説明と食い違う新機能 → **ストア更新** |
| 道具 | Node・Python・git・`firebase-tools`。**Mac も Xcode も要らない** |
| 届くまで | 1回目の起動で裏で取り、**閉じて開き直した2回目から**新しい版 |
| 失敗したら | 新しい版で起動できなければ、プラグインが自動で前の版へ戻す |

---

## 0. 揃って初めて通る3つ

**1つでも欠けると黙って何も起きない。** CUBE が1件ずつ実機で突き止めたもので、
チェスでは**プラグインの実装を読んで同じ結論を確認した**。

### (1) 版は「数字.数字.数字」のちょうど3つ

`ios/Sources/CapacitorUpdaterPlugin/CapgoSemanticVersion.swift` が
3要素でなければ `ParseError.invalidComponents` を投げる。4つ区切りも頭0も不可。

### (2) `latest.json` に zip の sha256 を書き、`download()` へ渡す

`CapgoUpdater.swift` の `resolveExpectedBundleChecksum()`：

```swift
if checksum.isEmpty {
    logger.error("No checksum provided")
    throw NSError(domain: "ChecksumError", code: 2, ... "Checksum required")
}
```

**空だと必ず弾かれる。** 値は `CryptoCipher.calcChecksumOrThrow()` が
`SHA256` を `String(format:"%02x")` で繋いだもの＝**zip 全体の sha256・小文字16進**。

### (3) 置き場に `Access-Control-Allow-Origin: *`

アプリの中の画面は `capacitor://localhost` という別オリジン。この印が無いと
`latest.json` の取得そのものを**中身を見る前に**弾かれる。`firebase/firebase.json` に
`/live/**` で入れてある。

---

## 1. どこで止まったかを実機で読む

取りに行く処理は失敗を握りつぶすので、印が無いと「届かない」としか分からない。
`localStorage` の `tc_live_v1`（**セーブとは別の鍵**。混ぜると引き継ぎコードに乗って出ていく）に残し、
**メニューの「バージョン」の行の後ろに出している**。

【チェス】**印は ASCII だけ。** 版の行は等幅フォントで、そこに日本語の字は入っていない
（`fonts/mono*.woff2` は英数字のみ）。日本語を出すと豆腐になる。

| 印 | 意味 |
| --- | --- |
| `live: none` | プラグインがアプリに入っていない（理由が続く） |
| `live: checking` | `latest.json` を取りに行ったまま（**通信が一切届いていない**） |
| `live: x Load failed` | **CORS で弾かれた**。置き場の印を疑う |
| `live: no-json 404` | `latest.json` をまだ置いていない |
| `live: bad-json` | 紙に `version` か `url` が無い |
| `live: latest 〇〇` | 置いてある版が、いまの版より新しくない |
| `live: no-sum 〇〇` | `checksum` が書かれていない（**呼ぶ前に止めている**） |
| `live: get 〇〇` | zip を落としている途中で終わった |
| `live: no-bundle 〇〇` | 落ちたが中身が返らなかった |
| `live: next 〇〇` | **成功。次の起動から新しい版** |
| `live: x …` | 落とす／入れるところで失敗（理由つき） |

★**CORS で弾かれたときの文言は見る場所で違う。** 実機（WKWebView＝Safari）は
`Load failed`、PC の Chrome で開いたときは `Failed to fetch`。**どちらも同じ TypeError。**
CUBE が 2026-11-04 に実機で踏んだ形。

【チェス】CUBE は CORS 失敗が `生: 見に行った` で止まるだけだったが、
こちらは `.catch` で理由まで出す。**`live: checking` のまま止まるのは「通信が全く無い」場合だけ**。

---

## 2. アプリ側（出す版に入っていること）

**部品が「いま配っているストアの版」に入っていないと一生届かない。**
あとから入れるには審査が1回要る。

【チェス】**CocoaPods ではなく SPM。** CUBE の `Podfile.lock` を見る手順は使えない。
archive の前に見るのはこの3つ：

```
grep capgo thechess-app/package.json
grep -i capgo thechess-app/ios/App/CapApp-SPM/Package.swift   ← いちばん大事
grep -i autoUpdate thechess-app/capacitor.config.json          ← false であること
```

2行目が出なければ**アプリの実体に入っていない**。`npm i` はしたが
archive の前に `npx cap sync ios` が通っていない、がいちばん起こりやすい。

**2026-11-14 時点で3つとも通っている**（`.package(name: "CapgoCapacitorUpdater", ...)` を確認済み）。

`autoUpdate` は必ず `false`。既定の `true` だとプラグインが Capgo 自身のクラウドを見に行き、
手で入れた版を起動のたびに元へ戻す。

部品の有無は `Capacitor.Plugins` に並ばないことがあるので `registerPlugin` でも架け、
**`notifyAppReady()` が通るかで判定する**（Promise なので `try/catch` では捕まらない）。

---

## 3. 版の付け方と、ストア更新の落とし穴

`index.html` の `const APP_VER` が、その端末が「いま持っている版」。
ライブで出すたびに上げる（`1.0.0` → `1.0.1` → `1.0.2`）。

★**ストアの新しいビルドを出すときは、`APP_VER` を「いちばん新しく出したライブ版」より上にする。**

`capacitor.config.json` は `resetWhenUpdate:true` なので、ストア更新が入ると端末は
ライブ版を捨てて素の版に戻る。このとき `latest.json` がまだ古いライブ版を指していて、
新しいストア版の `APP_VER` がそれより小さいと、**新しいストア版の上に古いライブ版が被さる。**

例：ライブで `1.0.3` まで出した → 次のストア版は `1.1.0` にする（`1.0.0` のままにしない）。

`tools/live/build.py` は「置いてある版より `APP_VER` が新しくない」ときは書き出しを止めるので、
**ライブ側の取り違えは自動で止まる。ストア側は人が気をつける。**

---

## 4. 置き場

`firebase/firebase.json` の `hosting` に入れてある。対話式の初期化は走らせない。

```json
"hosting": {
  "public": "hosting/public",
  "headers": [
    { "source": "/live/**",        "headers": [{ "key": "Access-Control-Allow-Origin", "value": "*" }] },
    { "source": "/live/latest.json","headers": [{ "key": "Cache-Control", "value": "no-store" }] },
    { "source": "/live/*.zip",      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

- `latest.json` は `no-store`。でないと CDN が古い紙を返し続ける
- `firebase/hosting/public/live/` は **.gitignore 済み**。Hosting はローカルに無いファイルを
  サーバーから消すので、各マシンは自分が作った zip だけ置けばよい
- `.firebaserc` は `.firebaserc.example` から作る
- 鍵のファイルで出すなら、権限は **Hosting 管理者だけでは足りない**（Service Usage で 403）。
  **編集者（レガシー）**で通る。★その JSON はリポジトリの中に置かない

---

## 5. 出す手順

```
git pull
python3 tools/live/build.py
cd firebase && firebase deploy --only hosting
```

`build.py` がやること（`tools/live/build.py`）:

1. `APP_VER` を読む → **SemVer でなければ止める**
2. 置いてある版より新しくなければ**止める**
3. `www/` を**全部**まとめて zip（中身が同じなら毎回同じ zip になる）
4. zip の sha256 を計算
5. `latest.json` に `{version,url,checksum}` を書く

★**審査中は出さない。** 提出した版も起動のたび `latest.json` を見るので、
**審査する人の端末にも降りる。**

### 確かめ方

アプリを**完全に終了**して開く → バージョンの行に `live: next 〇〇`。
**もう一度終了して開く** → 版の数字が変わる。これで通っている。

---

## 6. 【チェス】zip は全部入りにするしかない

プラグインは落とした zip を**新しい web ルートそのもの**にする。
`CapacitorUpdaterPlugin.swift` が `bridge.setServerBasePath(dest.path)` を呼ぶだけで、
**元の `www` へ戻る道は無い。zip に入っていないファイルは 404。**

CUBE は単一HTMLなので `index.html` 1枚で足りたが、チェスは `iap.js`・`lib/three.min.js`・
`fonts/`・`bgm/` を持つ。**index.html だけを zip にすると、更新した瞬間に
3D と課金と字と曲が全部死ぬ。**（CUBE 側の仕様書では「未実測」だったが、実装で確定した）

zip のルートに `index.html` が要る（`definitions.d.ts`：
"The bundle must include an `index.html` file at the root level."）。

### ★BGM の mp3 が未解決

`www/bgm/*.mp3` が4本・6.5MB。zip は **URL を知れば誰でも取れる公開ウェブ**に置かれるので、
素の mp3 を入れると OpenTracks の禁止事項（配布／コンバートせず容易にアクセスできる状態）を踏む。
CUBE で一度やって公開から外した。

`build.py` は **mp3 を見つけたら書き出しを止める**。先に決めること：

1. mp3 を `index.html` に埋め込む形に変える（zip の大きさは変わらない。base64 は zip で元に戻る）
2. CC0 など、ウェブ配置を許す曲に差し替える
3. 権利者に確認が取れている → `--with-mp3` を付ける

★**「zip から外す」は選べない。** 上のとおり web ルートごと差し替わるので曲が 404 になる。

★**この決着が付くまで、ライブ更新は出せない。** 部品と経路は通っているが、
最初の1回を出した時点で mp3 が公開ウェブに乗る。

---

## 7. 実機を覗くとき

**TestFlight／ストアの版は Web インスペクタで覗けない**（iOS 16.4 以降は `isInspectable` が要り、
Capacitor はデバッグビルドでしか立てない）。`npx cap open ios` → Xcode から実機へ入れた版で見る。
そのとき配信物は書き換えない（古いままのほうが失敗を再現できる）。

---

## 8. 使い分け

| やること | 出し方 |
| --- | --- |
| 数字の調整・不具合の直し・画面の直し・文言 | **ライブ**（審査なし・数分） |
| 素材の差し替え | ライブ（ただし 6 の mp3） |
| 課金を足す・ネイティブの部品を足す・目的が変わる変更 | **ストア更新**（審査） |

★ストア版を出すときは Version も上げる（Build だけだと「Invalid Pre-Release Train」で弾かれる）。

---

## 9. この仕様で確認したこと（2026-11-14）

実機が無いので、**プラグインの実装を読む**のと**経路を模して通す**の2本で裏を取った。

- プラグイン 8.54.2 の Swift を読み、checksum（sha256・必須）・SemVer 3要素・
  `setServerBasePath` による全差し替え・ルート直下の `index.html` を確認
- `tools/live/build.py` が zip と `latest.json` を作ることを確認。
  **同じ中身なら同じ zip**（時刻と順序を固定してある）
- `liveInit` を、プラグインを模した相手に対して **10通りの分岐で通した**
  （部品なし／ready失敗／CORS／404／壊れた紙／版が古い／checksum無し／取得失敗／
  成功2通り）。**10/10 で期待どおりの印が出る**
- SPM に `CapgoCapacitorUpdater` が入っていること、`autoUpdate:false` であることを確認

**実機でしか分からないもの**：zip の展開と差し替えが本当に起きるか、
`next()` の後に再起動で切り替わるか、Firebase Hosting が実際に CORS を返すか。
→ 最初の1回で `live: next 〇〇` が出るかを見る。出れば残りは通っている。
