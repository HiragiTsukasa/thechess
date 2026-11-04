# ヘッダ画像（App Store Connect「ヘッダと検索結果」）

5244×2950 と 3840×1646 の2枚 × 日英。審査には不要な任意アセット。

- 右の絵：初期配置の盤を真上から撮ったもの（`board.js`）。言語に依らないので1枚を使い回す。
- 左の文字：タイトルロックアップと2行コピー。フォントはゲーム本体と同じ `www/fonts/` の woff2。

```
# www/ を 8731 で配ってから
node tools/shot/header/board.js                       # /tmp/board.png（盤だけ）
cp tools/shot/header/_hdr.html  thechess-app/www/
cp tools/shot/header/_hdr-art.png thechess-app/www/   # board.png を切り出したもの
node tools/shot/header/render.js                      # 出力は store/header/
rm -f thechess-app/www/_hdr.html thechess-app/www/_hdr-art.png   # 必ず消す
```

最後の行を忘れると、テンプレートと素材がアプリに同梱される。

文字サイズは 5244×2950 を基準に、高さの比で拡大縮小している。
