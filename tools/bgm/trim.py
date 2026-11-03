"""末尾→先頭で繋ぐループ用に、前後の無音を精密に測る。

MP3 はエンコード時に先頭と末尾へ無音のパディングが入る。これをそのまま
ループさせると、1周ごとに数十ミリ秒の空白ができて「タンッ…タンッ」と途切れる。
デコード後の波形から実際に音が鳴り始める／鳴り終わる位置を求め、
AudioBuffer の loopStart / loopEnd に渡せば継ぎ目なく回る。

ついでに、末尾→先頭の繋ぎがどれくらい自然かを数字で出す。
  junction : 末尾直前の帯域バランスと先頭直後の帯域バランスの相関
             （1 に近いほど音色が連続している）
  dcGap    : 継ぎ目での波形の段差（大きいとプチッと鳴る）
"""
import subprocess, io, wave, json
import numpy as np

def decode(path, sr, mono=True):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "wav",
                        "-ac", "1" if mono else "2", "-ar", str(sr), "-"],
                       capture_output=True)
    with wave.open(io.BytesIO(p.stdout)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    return x

def edges(x, sr, floor_db=-60):
    """実際に音が出ている範囲。閾値はピークからの相対。"""
    w = max(1, int(sr * 0.005))
    env = np.sqrt(np.convolve(x * x, np.ones(w) / w, 'same'))
    thr = env.max() * (10 ** (floor_db / 20))
    nz = np.flatnonzero(env > thr)
    if not len(nz): return 0.0, len(x) / sr
    return nz[0] / sr, (nz[-1] + 1) / sr

def band(x):
    sp = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    e = np.array([sp[a:b].sum() for a, b in
                  [(1,4),(4,8),(8,16),(16,32),(32,64),(64,128),(128,256),(256,512)]])
    return e / (e.sum() + 1e-12)

def analyse(path, name):
    SR = 44100
    x = decode(path, SR)
    dur = len(x) / SR
    s, e = edges(x, SR)
    # 繋ぎの自然さ: 末尾 0.5s と 先頭 0.5s の帯域バランスを比べる
    W = int(0.5 * SR)
    a = x[max(0, int(e * SR) - W):int(e * SR)]
    b = x[int(s * SR):int(s * SR) + W]
    m = min(len(a), len(b))
    j = 0.0
    if m > 1000:
        ba, bb = band(a[-m:]), band(b[:m])
        j = float(1 - np.abs(ba - bb).sum() / 2)      # 0..1
    # 継ぎ目の段差（末尾の最後のサンプル と 先頭の最初のサンプル）
    i0, i1 = int(s * SR), int(e * SR) - 1
    gap = float(abs(x[i1] - x[i0])) if 0 <= i0 < len(x) and 0 <= i1 < len(x) else 0.0
    # 先頭と末尾の音量（フェードの有無を見る）
    head = float(np.sqrt((x[i0:i0 + int(SR)] ** 2).mean())) if i0 + SR < len(x) else 0
    tail = float(np.sqrt((x[max(0, i1 - int(SR)):i1] ** 2).mean()))
    return dict(name=name, file=path, duration=round(dur, 4),
                audioStart=round(s, 4), audioEnd=round(e, 4),
                leadSilence=round(s * 1000, 1), tailSilence=round((dur - e) * 1000, 1),
                junction=round(j, 3), seamGap=round(gap, 4),
                headRMS=round(head, 4), tailRMS=round(tail, 4),
                tailVsHead=round(tail / (head + 1e-9), 2))

if __name__ == "__main__":
    out = []
    print(f"{'曲':8s} {'長さ':>8s} {'先頭無音':>9s} {'末尾無音':>9s} {'繋ぎ':>6s} {'段差':>7s} {'末尾/先頭音量':>12s}")
    for p, n in [("battle.mp3","battle"),("bare.mp3","bare"),("ranked.mp3","ranked"),("home.mp3","home")]:
        r = analyse(p, n); out.append(r)
        print(f"{n:8s} {r['duration']:8.2f}s {r['leadSilence']:8.1f}ms {r['tailSilence']:8.1f}ms "
              f"{r['junction']:6.3f} {r['seamGap']:7.4f} {r['tailVsHead']:12.2f}", flush=True)
    json.dump(out, open("trim.json", "w"), indent=1)
