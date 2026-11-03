"""BGM のループ点を探す。

考え方
  1. 曲を 11025Hz モノラルに落とし、短時間フレームのスペクトル特徴（対数メルっぽい帯域энергии）を作る
  2. その特徴列の自己相関で「繰り返しの周期 L」を見つける（イントロを除いた区間で）
  3. L が決まったら、末尾付近に loopEnd を置き、loopStart = loopEnd - L とする
  4. 最後にサンプル単位で微調整する（loopEnd 直前の波形と loopStart 直前の波形を相互相関）

出力は {name, loopStart, loopEnd} の秒数。ゲーム側は AudioBuffer の
loopStart / loopEnd に入れるだけで、MP3 のパディングに関係なく継ぎ目なく回る。
"""
import subprocess, sys, json, wave, io
import numpy as np

SR = 11025          # 構造解析用
HOP = 512
NFFT = 1024

def decode(path, sr=SR, mono=True):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "wav",
                        "-ac", "1" if mono else "2", "-ar", str(sr), "-"],
                       capture_output=True)
    with wave.open(io.BytesIO(p.stdout)) as w:
        n = w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768
        if not mono:
            x = x.reshape(-1, 2)
    return x

def features(x):
    """フレームごとの対数帯域エネルギー。音量変化と音色変化の両方を拾う。"""
    win = np.hanning(NFFT)
    nf = max(1, (len(x) - NFFT) // HOP)
    F = np.zeros((nf, 24))
    edges = np.unique(np.round(np.logspace(np.log10(2), np.log10(NFFT // 2), 25)).astype(int))
    edges = np.pad(edges, (0, 25 - len(edges)), mode='edge')
    for i in range(nf):
        s = x[i * HOP: i * HOP + NFFT] * win
        sp = np.abs(np.fft.rfft(s))
        for b in range(24):
            a, bb = edges[b], max(edges[b] + 1, edges[b + 1])
            F[i, b] = sp[a:bb].mean()
    F = np.log1p(F * 50)
    F -= F.mean(axis=0, keepdims=True)
    sd = F.std(axis=0, keepdims=True); sd[sd == 0] = 1
    return F / sd

def best_period(F, fps, lo=6.0, hi=None):
    """自己相関で繰り返し周期を探す。lo/hi は秒。"""
    n = len(F)
    if hi is None:
        hi = n / fps * 0.75
    lags = range(int(lo * fps), int(min(hi * fps, n - int(4 * fps))))
    best, bl = -2, None
    scores = []
    for L in lags:
        a = F[:n - L]; b = F[L:]
        m = min(len(a), len(b))
        if m < fps * 4: continue
        a = a[:m].ravel(); b = b[:m].ravel()
        c = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
        scores.append((c, L))
        if c > best: best, bl = c, L
    scores.sort(reverse=True)
    return bl, best, scores[:8]

def refine(xs, sr, start, end, win=0.25, search=0.06):
    """サンプル単位の微調整。loopEnd の直前 win 秒と、loopStart の直前 win 秒を合わせる。"""
    w = int(win * sr); s = int(search * sr)
    e0 = int(end * sr); s0 = int(start * sr)
    if e0 - w < 0 or s0 - w < 0: return start, end
    ref = xs[e0 - w:e0]
    best, bo = -2, 0
    for off in range(-s, s + 1, 4):
        a = s0 + off
        if a - w < 0 or a + w > len(xs): continue
        seg = xs[a - w:a]
        c = float(np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9))
        if c > best: best, bo = c, off
    return start + bo / sr, end

def analyse(path, name):
    x = decode(path)
    dur = len(x) / SR
    fps = SR / HOP
    F = features(x)
    L, score, top = best_period(F, fps)
    period = L / fps
    # 末尾の無音・フェードを避けるため、実質の終わりを求める
    env = np.abs(x)
    env = np.convolve(env, np.ones(int(SR * .05)) / (SR * .05), 'same')
    thr = env.max() * 0.06
    nz = np.flatnonzero(env > thr)
    audio_end = nz[-1] / SR if len(nz) else dur
    # loopEnd は実質の終わりの少し手前、loopStart = loopEnd - 周期
    loop_end = audio_end
    loop_start = loop_end - period
    while loop_start < 0.5 and period > 0:
        loop_end += period
        loop_start = loop_end - period
        if loop_end > audio_end: loop_end = audio_end; break
    xs = decode(path, sr=44100)
    ls, le = refine(xs, 44100, loop_start, loop_end)
    return dict(name=name, file=path, duration=round(dur, 3),
                audioEnd=round(audio_end, 3), period=round(period, 3),
                corr=round(score, 4), loopStart=round(max(0, ls), 3), loopEnd=round(le, 3),
                top=[(round(c, 3), round(l / fps, 2)) for c, l in top])

if __name__ == "__main__":
    out = []
    for path, name in [("battle.mp3", "battle"), ("bare.mp3", "bare"),
                       ("ranked.mp3", "ranked"), ("home.mp3", "home")]:
        r = analyse(path, name)
        out.append(r)
        print(f"{name:8s} 長さ{r['duration']:7.2f}s  実質の終わり{r['audioEnd']:7.2f}s  "
              f"周期{r['period']:6.2f}s  相関{r['corr']:.3f}  "
              f"→ loop {r['loopStart']:.3f} 〜 {r['loopEnd']:.3f}", flush=True)
        print(f"         候補(相関,周期s): {r['top'][:5]}", flush=True)
    json.dump(out, open("loops.json", "w"), indent=1)
