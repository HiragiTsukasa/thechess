"""libritts_r の全904話者を1フレーズずつ生成し、「テンションの高さ」で採点する。

採点に使う指標（すべて音声から直接測る）
  rate   話速          : 同じ文なので、短いほど速い＝勢いがある
  f0     平均ピッチ     : 高いほど張っている（男女差が出るので男女別に正規化）
  f0sd   ピッチの振れ幅 : 抑揚が大きい＝棒読みでない。テンションの核
  cent   スペクトル重心 : 高いほど明るい・前に出る声
  crest  クレストファクタ: 小さいほど詰まっていて押し出しが強い
出力: screen.json（全話者の素の数値）
"""
import sys, json, wave, io, math
import numpy as np
from piper import PiperVoice, SynthesisConfig

MODEL = "lr.onnx"
# 子音の立ち上がりと母音の伸びが両方出る短文。技名と似た性格の語を含める
TEXT = "Checkmate! Overkill! Sudden Death!"

def feats(pcm, sr):
    x = pcm.astype(np.float64) / 32768.0
    if x.size < sr // 10:
        return None
    # 無音を除いて有声部だけ見る
    fl = max(1, int(sr * 0.02))
    nf = x.size // fl
    fr = x[: nf * fl].reshape(nf, fl)
    rms = np.sqrt((fr ** 2).mean(axis=1) + 1e-12)
    thr = max(rms.max() * 0.08, 1e-4)
    voiced = rms > thr
    if voiced.sum() < 5:
        return None
    dur = voiced.sum() * fl / sr                      # 実質の発話長
    # ピッチ: 有声フレームごとに自己相関
    f0s = []
    lo, hi = int(sr / 400), int(sr / 70)              # 70-400Hz
    for i in np.flatnonzero(voiced):
        seg = fr[i] - fr[i].mean()
        if seg.size < hi * 2:
            seg = x[i * fl : i * fl + hi * 2]
            if seg.size < hi * 2: continue
            seg = seg - seg.mean()
        ac = np.correlate(seg, seg, mode="full")[seg.size - 1 :]
        if ac[0] <= 0: continue
        ac = ac / ac[0]
        w = ac[lo:hi]
        if w.size == 0: continue
        k = int(np.argmax(w))
        if w[k] < 0.3: continue                       # 無声/雑音は捨てる
        f0s.append(sr / (lo + k))
    if len(f0s) < 5:
        return None
    f0s = np.array(f0s)
    f0s = f0s[(f0s > 60) & (f0s < 420)]
    if f0s.size < 5:
        return None
    # スペクトル重心
    win = np.hanning(1024)
    cents = []
    for i in range(0, max(1, x.size - 1024), 512):
        s = x[i : i + 1024]
        if s.size < 1024 or np.sqrt((s ** 2).mean()) < thr: continue
        sp = np.abs(np.fft.rfft(s * win))
        fq = np.fft.rfftfreq(1024, 1 / sr)
        tot = sp.sum()
        if tot > 0: cents.append(float((sp * fq).sum() / tot))
    peak = float(np.abs(x).max())
    r = float(np.sqrt((x ** 2).mean()))
    return dict(
        dur=float(dur),
        f0=float(np.median(f0s)),
        f0sd=float(np.std(f0s)),
        f0rng=float(np.percentile(f0s, 90) - np.percentile(f0s, 10)),
        cent=float(np.mean(cents)) if cents else 0.0,
        crest=float(peak / (r + 1e-9)),
    )

def main():
    v = PiperVoice.load(MODEL)
    n = v.config.num_speakers
    print(f"話者数 {n}  文: {TEXT!r}", flush=True)
    out = {}
    for sid in range(n):
        try:
            buf = io.BytesIO()
            with wave.open(buf, "wb") as w:
                v.synthesize_wav(TEXT, w, SynthesisConfig(speaker_id=sid))
            buf.seek(0)
            with wave.open(buf, "rb") as w:
                sr = w.getframerate()
                pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
            f = feats(pcm, sr)
            if f: out[sid] = f
        except Exception as e:
            print(f"  sid={sid} 失敗: {e}", flush=True)
        if (sid + 1) % 50 == 0:
            print(f"  {sid+1}/{n} 済  (有効 {len(out)})", flush=True)
    json.dump(out, open("screen.json", "w"))
    print(f"完了: 有効 {len(out)}/{n} → screen.json", flush=True)

main()
