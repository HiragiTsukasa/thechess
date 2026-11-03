"""生成した技名ボイス33本を index.html の const VO={...} 行に埋め込む。
  python3 embed.py <mp3のディレクトリ> [index.htmlのパス]
キーはゲーム側の表記、ファイル名は空白をアンダースコアにしたもの。
33個そろっていなければ何も書かずに中断する。
"""
import sys, os, base64, io

NAMES = [
    "Castling", "En Passant", "Promotion", "Check", "Double Check", "Fork",
    "Royal Fork", "Pin", "Discovered Attack", "Battery", "Outpost", "Desperado",
    "Command", "Checkmate", "Back Rank Mate", "Smothered Mate", "Laser", "Sanctuary",
    "Homecoming", "Phalanx", "Death March", "Tempest", "Stampede", "Skewer",
    "Rampart", "Chain", "Dread", "Awakening", "Bare King", "Spoils",
    "Ascension", "Overkill", "Sudden Death",
]

SRC = sys.argv[1]
HTML = sys.argv[2] if len(sys.argv) > 2 else "/home/user/thechess/thechess-app/www/index.html"

parts, total = [], 0
missing = []
for n in NAMES:
    p = os.path.join(SRC, n.replace(" ", "_") + ".mp3")
    if not os.path.exists(p):
        missing.append(p); continue
    b = open(p, "rb").read()
    total += len(b)
    parts.append('"%s": "%s"' % (n, base64.b64encode(b).decode("ascii")))
if missing:
    sys.exit("足りないファイル:\n  " + "\n  ".join(missing))
assert len(parts) == 33, len(parts)

line = "const VO={" + ",".join(parts) + "};"

src = io.open(HTML, encoding="utf-8").read()
lines = src.split("\n")
idx = [i for i, l in enumerate(lines) if l.startswith("const VO={")]
if len(idx) != 1:
    sys.exit(f"const VO= の行が {len(idx)} 件見つかった（1件であるべき）")
old = len(lines[idx[0]])
lines[idx[0]] = line
io.open(HTML, "w", encoding="utf-8").write("\n".join(lines))
print(f"置換: 行 {idx[0]+1}")
print(f"  mp3 合計      {total/1024:.0f}KB （33本）")
print(f"  VO行  {old/1024:.0f}KB → {len(line)/1024:.0f}KB  （{(len(line)-old)/1024:+.0f}KB）")
print(f"  index.html    {len(src)/1024:.0f}KB → {os.path.getsize(HTML)/1024:.0f}KB")
