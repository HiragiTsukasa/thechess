# アイコンとスプラッシュの置き場

ここに2枚置いて、`thechess-app/` で下を実行する。

```
resources/
├ icon.png     1024×1024  透過なし（アルファチャンネルがあると審査で弾かれる）
└ splash.png   2732×2732  中央に収まる絵柄で。端は切られる前提
```

```bash
npx @capacitor/assets generate --ios
```

`ios/App/App/Assets.xcassets/` の AppIcon と Splash が各サイズで置き換わる。
**`ios/` が存在しないと書き込み先が無くて失敗する**ので、先に `npm run init` を済ませること
（このリポジトリでは `ios/` はコミット済みなので `npm install` だけで足りる）。

## 1枚で済ませる場合

`assets/logo.png` を置いて背景色を渡すと、アイコンとスプラッシュを自動で作ってくれる。

```bash
mkdir -p assets && cp 元絵.png assets/logo.png
npx @capacitor/assets generate --ios \
  --iconBackgroundColor '#0b0c0e' --splashBackgroundColor '#0b0c0e'
```

## 補足

起動画面の背景は `ios/App/App/Base.lproj/LaunchScreen.storyboard` で `#0b0c0e` に
固定済み（既定の systemBackgroundColor のままだとライトモードで白く光るため）。
