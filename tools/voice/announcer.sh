#!/usr/bin/env bash
# The Chess ─ 技名33本を「実況アナウンサー」風に加工する。
#   ./announcer.sh <voice> <style>     例: ./announcer.sh bryce arena
# style: arena（深い残響＋ダブリング） / hall（さらに深い） / tight（残響控えめ・押し出し強め）
# 出力: out-<voice>-<style>/*.mp3（ゲーム同梱用・タイトめ）
#       preview-<voice>-<style>.mp3（試聴用・単語間に0.5秒の無音を実際に挿入）
set -euo pipefail
cd "$(dirname "$0")"
V="${1:-bryce}"; STYLE="${2:-arena}"
MODEL="$(ls en_US-$V-*.onnx 2>/dev/null | head -1)"
[ -f "$MODEL" ] || { echo "モデルが無い: en_US-$V-*.onnx"; exit 1; }
OUT="out-$V-$STYLE"; WRK="wrk-$V-$STYLE"
rm -rf "$OUT" "$WRK"; mkdir -p "$OUT" "$WRK"

NAMES=(
  "Castling" "En Passant" "Promotion" "Check" "Double Check" "Fork"
  "Royal Fork" "Pin" "Discovered Attack" "Battery" "Outpost" "Desperado"
  "Command" "Checkmate" "Back Rank Mate" "Smothered Mate" "Laser" "Sanctuary"
  "Homecoming" "Phalanx" "Death March" "Tempest" "Stampede" "Skewer"
  "Rampart" "Chain" "Dread" "Awakening" "Bare King" "Spoils"
  "Ascension" "Overkill" "Sudden Death"
)

# ── スタイルごとの数値 ──────────────────────────────
# 既定（落ち着いたアナウンサー）
EQ="equalizer=f=115:t=q:w=1.0:g=3.5,equalizer=f=2900:t=q:w=1.3:g=4,highpass=f=80,lowpass=f=12000"
COMP="acompressor=threshold=-20dB:ratio=5:attack=4:release=140:makeup=4"
SAT=""
case "$STYLE" in
  arena) PITCH=0.90; TEMPO=1.04; DBL_DET=1.006; DBL_MS=22; DBL_VOL=0.55
         ECHO="aecho=0.86:0.9:38|72|125|210:0.34|0.25|0.17|0.11"; TAIL=0.7 ;;
  hall)  PITCH=0.88; TEMPO=1.02; DBL_DET=1.008; DBL_MS=28; DBL_VOL=0.65
         ECHO="aecho=0.84:0.92:45|90|165|270|410:0.40|0.32|0.24|0.16|0.10"; TAIL=1.0 ;;
  tight) PITCH=0.92; TEMPO=1.08; DBL_DET=1.005; DBL_MS=16; DBL_VOL=0.45
         ECHO="aecho=0.9:0.85:25|48:0.22|0.13"; TAIL=0.4 ;;
  # arena と hall の残響を両方かけて、少し早口にしたもの
  both)  PITCH=0.90; TEMPO=1.16; DBL_DET=1.007; DBL_MS=24; DBL_VOL=0.60
         ECHO="aecho=0.86:0.9:38|72|125|210:0.34|0.25|0.17|0.11,aecho=0.84:0.92:45|90|165|270|410:0.40|0.32|0.24|0.16|0.10"
         TAIL=1.4 ;;
  bothf) PITCH=0.90; TEMPO=1.28; DBL_DET=1.007; DBL_MS=24; DBL_VOL=0.60
         ECHO="aecho=0.86:0.9:38|72|125|210:0.34|0.25|0.17|0.11,aecho=0.84:0.92:45|90|165|270|410:0.40|0.32|0.24|0.16|0.10"
         TAIL=1.4 ;;
  # ── テンション高め ───────────────────────────────
  # Piper に感情指定は無い（「!」を付けても音は同一）ので、
  # 明るさ・押し出し・軽い歪みで「張り上げている感じ」を作る。
  hype)  PITCH=1.00; TEMPO=1.14; DBL_DET=1.004; DBL_MS=18; DBL_VOL=0.50
         EQ="equalizer=f=150:t=q:w=1.2:g=2,equalizer=f=4200:t=q:w=1.1:g=6,equalizer=f=8000:t=q:w=1.5:g=3,highpass=f=100,lowpass=f=13500"
         COMP="acompressor=threshold=-26dB:ratio=8:attack=2:release=90:makeup=7"
         SAT="asoftclip=type=tanh:param=0.55,"
         ECHO="aecho=0.88:0.88:30|58|100|170:0.30|0.22|0.15|0.09,aecho=0.86:0.9:40|80|150|250:0.32|0.24|0.16|0.10"
         TAIL=1.2 ;;
  hype2) PITCH=1.05; TEMPO=1.20; DBL_DET=1.004; DBL_MS=16; DBL_VOL=0.55
         EQ="equalizer=f=160:t=q:w=1.2:g=2,equalizer=f=4500:t=q:w=1.0:g=7,equalizer=f=9000:t=q:w=1.5:g=4,highpass=f=110,lowpass=f=14000"
         COMP="acompressor=threshold=-28dB:ratio=10:attack=1:release=70:makeup=8"
         SAT="asoftclip=type=tanh:param=0.75,"
         ECHO="aecho=0.88:0.88:26|50|88|150:0.28|0.20|0.13|0.08,aecho=0.86:0.9:36|72|135|225:0.30|0.22|0.14|0.09"
         TAIL=1.1 ;;
  *) echo "不明な style: $STYLE"; exit 1 ;;
esac

# 1) 低く・やや遅く（重みを出す）
A1="asetrate=22050*$PITCH,aresample=44100,atempo=$TEMPO"
# 2) ダブリング: 同じ声をわずかに detune してずらして重ねる＝厚み
A2="asplit=2[d1][d2];\
[d2]asetrate=44100*$DBL_DET,aresample=44100,adelay=${DBL_MS}|${DBL_MS},volume=$DBL_VOL[d2b];\
[d1][d2b]amix=inputs=2:normalize=0,volume=0.75"
# 3) 音作り（スタイル依存）
A3="$EQ"
# 4) 粒を揃えて押し出す（+ テンション高め系は軽い歪みで張り上げ感）
A4="${SAT}$COMP"
# 5) 残響のための余白 → 残響 → 頭と末尾の無音を削る（残響の減衰は残す）
A5="apad=pad_dur=$TAIL,$ECHO,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.0:LRA=9"
TRIM="silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB,\
areverse,silenceremove=start_periods=1:start_silence=0:start_threshold=-55dB,areverse"

for n in "${NAMES[@]}"; do
  base="$(echo "$n" | tr ' ' '_')"
  echo "$n" | piper -m "$MODEL" -f "$WRK/raw.wav" >/dev/null 2>&1
  # 生成直後の前後無音を先に落としてから加工（残響が無音に乗らないように）
  ffmpeg -y -loglevel error -i "$WRK/raw.wav" \
    -af "silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB,areverse" \
    "$WRK/clean.wav"
  ffmpeg -y -loglevel error -i "$WRK/clean.wav" \
    -filter_complex "[0:a]$A1,$A2,$A3,$A4,$A5,$TRIM[out]" -map "[out]" \
    -ac 1 -ar 44100 "$WRK/$base.wav"
  ffmpeg -y -loglevel error -i "$WRK/$base.wav" -ac 1 -ar 44100 -b:a 64k \
    -write_xing 0 -id3v2_version 0 "$OUT/$base.mp3"
  printf '  %-20s %5s bytes  %ss\n' "$n" "$(stat -c%s "$OUT/$base.mp3")" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WRK/$base.wav" | cut -c1-4)"
done

# ── 試聴用: 単語間に本物の無音を挟む（重ならない） ──
GAP=0.5
ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=44100:cl=mono" -t $GAP "$WRK/sil.wav"
: > "$WRK/list.txt"
for n in "${NAMES[@]}"; do
  echo "file '$PWD/$WRK/$(echo "$n" | tr ' ' '_').wav'" >> "$WRK/list.txt"
  echo "file '$PWD/$WRK/sil.wav'" >> "$WRK/list.txt"
done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$WRK/list.txt" -ac 1 -ar 44100 -b:a 96k "preview-$V-$STYLE.mp3"
echo
echo "同梱用 $(du -sh "$OUT" | cut -f1)   試聴 preview-$V-$STYLE.mp3 (単語間 ${GAP}s の無音)"
