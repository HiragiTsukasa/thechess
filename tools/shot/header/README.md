# ヘッダ画像（App Store Connect「ヘッダと検索結果」）

5244×2950 と 3840×1646 の2枚 × 日英。審査には不要な任意アセット。

```
# 1) テンプレートとアートを www/ に置く（配布物には残さないこと）
cp tools/shot/header/_hdr.html thechess-app/www/
python3 - <<'PY'
from PIL import Image
for lg in ('ja','en'):
    im=Image.open(f'store/6.7-{lg}-5-laser.png'); w,h=im.size
    im.crop((0,int(h*0.20),w,int(h*0.78))).save(f'thechess-app/www/_hdr-art-{lg}.png')
PY
# 2) www/ を 8731 で配ってから
node tools/shot/header/render.js      # 出力は store/header/
# 3) 後始末（これを忘れるとアプリに同梱される）
rm -f thechess-app/www/_hdr.html thechess-app/www/_hdr-art-*.png
```

文字は 5244×2950 を基準に、高さの比で拡大縮小している。
フォントはゲーム本体と同じ `www/fonts/` の woff2 をそのまま使う。
