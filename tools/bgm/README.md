# BGM

曲は **OpenTracks**（旧 DOVA-SYNDROME）。商用利用可・クレジット表記不要・編集可。
ライセンス https://opentracks.com/help/articles/license/ ／ 利用規約 https://opentracks.com/help/articles/terms/

`thechess-app/www/bgm/` に 128kbps の MP3 で 4曲、合計 6.5MB。

| ファイル | 曲 | 鳴る場面 |
|---|---|---|
| `battle.mp3` | Fight in the outer space | 通常の対局・パズル |
| `bare.mp3` | LAST GUARDIAN | どちらかがベアキングになって以降（その対局の最後まで） |
| `ranked.mp3` | Devil Disaster | ランクマッチ |
| `home.mp3` | Truly 2 | タイトル・ロビーなど対局以外 |

## ループのしかた

`<audio loop>` は使っていない。MP3 はエンコード時に先頭と末尾へ無音のパディングが
必ず入るので、そのまま回すと1周ごとに数十msの空白ができて「タンッ…タンッ」と途切れる。

`AudioBufferSourceNode` の `loopStart` / `loopEnd` に、**デコード後の波形で実際に
音が鳴り始める／鳴り終わる位置**を秒で渡している。これならパディングを跨がないので
継ぎ目が出ない。値は `index.html` の `BGM` テーブル。

| 曲 | loopStart | loopEnd | 初回の再生開始 |
|---|---|---|---|
| battle | 0.0249 | 58.8715 | loopStart と同じ |
| bare | 0.0249 | 172.3985 | loopStart と同じ |
| ranked | 0.0260 | 73.9124 | loopStart と同じ |
| home | 22.715 | 119.3420 | **0.0058**（イントロは初回だけ。2周目からは 22.7s へ戻る） |

## メモリ

デコード後は Float32 で、44.1kHz ステレオだと bare だけで 58MB、4曲ぜんぶ抱えると
143MB になる。鳴っている曲と直前の曲だけを残し、**デコード済みの合計 240秒**を超えたら
古い方から捨てる（`BGM_KEEP`）。240 は battle + bare が同時に収まる値。

bare は3分あってデコードに1秒以上かかるので、**どちらかの駒が残り2体以下になった時点で
先読みを始める**。ベアキング発動の瞬間には鳴らせる状態になっている。

## 曲を差し替えるとき

```bash
cd tools/bgm
python3 trim.py        # 前後の無音を測る → loopStart / loopEnd の候補
python3 findloop.py    # 曲の途中にループ点を置きたいとき（自己相関で周期を探す）
```

どちらも同じディレクトリに `battle.mp3` `bare.mp3` `ranked.mp3` `home.mp3` を置いて走らせる。
ffmpeg と numpy が要る。出た秒数を `index.html` の `BGM` テーブルへ入れる。

耳で確かめるときは、同じ再生方式の試聴ページを作って聴き比べた
（`loopStart/loopEnd` をそのまま渡し、継ぎ目の6秒前から鳴らせるようにしたもの）。
