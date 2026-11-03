"""libritts_r の指定話者で技名を生成し、指定スタイルで加工して1本の比較音声にまとめる。
  python3 compare.py <style> <出力名> <sid> [<sid> ...]
  style: arena / hall / tight / both / hype / hype2   （announcer.sh と同じ数値）
話者の切れ目は1秒の無音。番号は喋らせない（声の印象が混ざるため）。
"""
import sys, wave, subprocess, os, shutil
from piper import PiperVoice, SynthesisConfig

STYLE, OUTNAME = sys.argv[1], sys.argv[2]
SIDS = [int(x) for x in sys.argv[3:]]
WORDS = ["Checkmate", "Overkill", "Sudden Death", "Double Check"]

EQ_CALM = ("equalizer=f=115:t=q:w=1.0:g=3.5,equalizer=f=2900:t=q:w=1.3:g=4,"
           "highpass=f=80,lowpass=f=12000")
CP_CALM = "acompressor=threshold=-20dB:ratio=5:attack=4:release=140:makeup=4"
E_ARENA = "aecho=0.86:0.9:38|72|125|210:0.34|0.25|0.17|0.11"
E_HALL  = "aecho=0.84:0.92:45|90|165|270|410:0.40|0.32|0.24|0.16|0.10"

S = {
 # pitch tempo det  dly vol  eq       comp      sat                              echo               tail
 "arena": (0.90, 1.04, 1.006, 22, .55, EQ_CALM, CP_CALM, "", E_ARENA, 0.7),
 "hall":  (0.88, 1.02, 1.008, 28, .65, EQ_CALM, CP_CALM, "", E_HALL, 1.0),
 "tight": (0.92, 1.08, 1.005, 16, .45, EQ_CALM, CP_CALM, "",
           "aecho=0.9:0.85:25|48:0.22|0.13", 0.4),
 "both":  (0.90, 1.16, 1.007, 24, .60, EQ_CALM, CP_CALM, "", E_ARENA + "," + E_HALL, 1.4),
 "hype":  (1.00, 1.14, 1.004, 18, .50,
           "equalizer=f=150:t=q:w=1.2:g=2,equalizer=f=4200:t=q:w=1.1:g=6,"
           "equalizer=f=8000:t=q:w=1.5:g=3,highpass=f=100,lowpass=f=13500",
           "acompressor=threshold=-26dB:ratio=8:attack=2:release=90:makeup=7",
           "asoftclip=type=tanh:param=0.55,",
           "aecho=0.88:0.88:30|58|100|170:0.30|0.22|0.15|0.09,"
           "aecho=0.86:0.9:40|80|150|250:0.32|0.24|0.16|0.10", 1.2),
}
if STYLE not in S:
    sys.exit(f"不明な style: {STYLE}  （{'/'.join(S)}）")
P, T, DET, DLY, VOL, EQ, CP, SAT, ECHO, TAIL = S[STYLE]

TRIM = ("silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB,"
        "areverse,silenceremove=start_periods=1:start_silence=0:start_threshold=-55dB,areverse")
CHAIN = (f"asetrate=22050*{P},aresample=44100,atempo={T},"
         f"asplit=2[d1][d2];"
         f"[d2]asetrate=44100*{DET},aresample=44100,adelay={DLY}|{DLY},volume={VOL}[d2b];"
         f"[d1][d2b]amix=inputs=2:normalize=0,volume=0.75,"
         f"{EQ},{SAT}{CP},apad=pad_dur={TAIL},{ECHO},alimiter=limit=0.95,"
         f"loudnorm=I=-14:TP=-1.0:LRA=9,{TRIM}[out]")

WRK = f"cmp-{STYLE}-{OUTNAME}"
shutil.rmtree(WRK, ignore_errors=True); os.makedirs(WRK)
def ff(a): subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + a, check=True)

v = PiperVoice.load("lr.onnx")
ff(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1.0", f"{WRK}/gap.wav"])
ff(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.35", f"{WRK}/gap_s.wav"])

lines = []
for sid in SIDS:
    for wi, w in enumerate(WORDS):
        raw, out = f"{WRK}/{sid}_{wi}_raw.wav", f"{WRK}/{sid}_{wi}.wav"
        with wave.open(raw, "wb") as wf:
            v.synthesize_wav(w, wf, SynthesisConfig(speaker_id=sid))
        ff(["-i", raw, "-filter_complex", f"[0:a]{CHAIN}", "-map", "[out]",
            "-ac", "1", "-ar", "44100", out])
        lines += [f"file '{os.path.abspath(out)}'",
                  f"file '{os.path.abspath(WRK)}/gap_s.wav'"]
    lines.append(f"file '{os.path.abspath(WRK)}/gap.wav'")
    print(f"  sid {sid} 済", flush=True)

open(f"{WRK}/list.txt", "w").write("\n".join(lines) + "\n")
ff(["-f", "concat", "-safe", "0", "-i", f"{WRK}/list.txt",
    "-ac", "1", "-ar", "44100", "-b:a", "96k", f"compare-{STYLE}-{OUTNAME}.mp3"])
print(f"→ compare-{STYLE}-{OUTNAME}.mp3   順番: {SIDS}  style={STYLE}")
