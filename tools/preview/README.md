# オーバーキルの発動タイミングを見る台

`overkill.html` を `www/` の隣に置き、`game.html` という名前で `www/index.html` を配ると動く。
Artifact として公開するときは、`www/` の中身を丸ごと supporting files として添える。

- 「横から・クイーン」… h1 のクイーンが h7 の瀕死ポーンを撃つ（`missile`）
- 「上から・ナイト」… g5 のナイトが h7 の瀕死ポーンを踏み潰す（`meteor`）
- スライダーは `__G.okSet()` を叩いて `OK_PIERCE` / `OK_DIVE_Y` をその場で差し替える
- 速度は `__G.speed`

気に入った値が決まったら、`www/index.html` の `let OK_PIERCE=…,OK_DIVE_Y=…;` を書き換える。
