# 技名ボイスの作り方

同梱している技名33本は **Piper**（MIT）をローカルで動かして生成し、ffmpeg で実況風に
加工したもの。採用したのは **en_US-bryce-medium（CC0 / パブリックドメイン）** の `arena` 加工。

**CC0 なので商用利用・改変・再配布は自由、クレジット表記も不要。**

## 準備

```bash
pip install piper-tts
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/bryce/medium
curl -sL "$B/en_US-bryce-medium.onnx"      -o en_US-bryce-medium.onnx
curl -sL "$B/en_US-bryce-medium.onnx.json" -o en_US-bryce-medium.onnx.json
```

## 作り直す

```bash
./announcer.sh bryce arena        # out-bryce-arena/*.mp3 と preview-bryce-arena.mp3
python3 embed.py out-bryce-arena  # index.html の const VO={...} 行を差し替え
```

`announcer.sh` のスタイル: `arena`（採用）/ `hall`（残響深い）/ `tight`（残響控えめ）/
`both`（arena+hall を二重がけ・早口）/ `hype`・`hype2`（テンション高め）。
数値はスクリプト冒頭の `case` 文にまとまっている。

## 声を変えたいとき

**ライセンスは音声ごとに違う。** 各ボイスの MODEL_CARD で確認すること。

- 商用可・表記不要（CC0 / public domain）: `joe` `mike` `kathleen` `reza_ibrahim`
  `bryce` `john` `kristin` `norman` `ljspeech`、`cori`(en_GB)、`sam`(Apache-2.0)
- 商用可・**表記要**（CC BY 4.0）: `libritts` `libritts_r` `alba` `aru` `vctk`
- **商用不可**（NC）: `ryan` `hfc_male` `hfc_female` `l2arctic` `semaine`
- 継承条件つき（CC BY-SA）で避けたほうがよい: `northern_english_male`
  `southern_english_female`

`screen.py` は libritts_r の全904話者を1フレーズずつ生成し、ピッチの振れ幅・話速・
スペクトル重心などから「テンションの高さ」で順位付けする。`compare.py <style> <名前> <sid...>`
で候補を並べて試聴できる。ただし libritts 系は CC BY 4.0 なので表記が要る。

## 注意

Piper に感情パラメータは無い。テキストに `!` を付けても**生成音声は1バイトも変わらない**
（末尾に無音が増えるだけ。md5 で確認済み）。テンションは加工で作るか、声そのものを変える。
