# ストア用スクリーンショット

```
cd thechess-app/www && python3 -m http.server 8731 &
node tools/shot/shots.js          # 出力は tools/shot/out/
```

- `pos.js` … 実戦らしい中盤の局面と、そこで狙ったスキルが出る手。
  駒は20〜30枚。`__G.setPos()`（index.html のデバッグフック）に渡すだけで、
  ダメージも判定もゲーム本体の計算をそのまま使う。
- `shots.js` … Playwright で 6.7/6.5インチ × ja/en を撮る。
  カットインは1.46秒で流れるので、CSS アニメを `animation-delay:-0.70s` ＋ `paused` で
  決めポーズのまま止め、要素の `remove()` を潰してから撮る。
  狙ったスキル以外のカットインは `display:none`。
  ダメージが乱数なので、出るまで最大8回指し直す。

採用した絵は `store/` に入れてある（STORE.md の「スクリーンショット」を参照）。
