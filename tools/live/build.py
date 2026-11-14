#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ライブ更新の zip と latest.json を作る。

  python3 tools/live/build.py            作る
  python3 tools/live/build.py --with-mp3 BGM も入れる（下の「BGMの壁」を読んでから）

作ったものは firebase/hosting/public/live/ に置かれる。出すのは

  cd firebase && firebase deploy --only hosting

確定している仕様（@capgo/capacitor-updater 8.54 の実装を読んで確認した）:

  * checksum は zip 全体の SHA-256（小文字16進）で、**必須**。
    空だと resolveExpectedBundleChecksum が "Checksum required" を投げる。
  * version は**厳密な SemVer の3要素**。4つ区切りも頭0も受け取らない。
  * zip は**新しい web ルートそのもの**（setServerBasePath で丸ごと差し替え）。
    入れなかったファイルは 404 になる。だから常に全部入りにする。
  * zip のルートに index.html が要る。
"""
import hashlib, json, os, re, sys, zipfile
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC  = os.path.join(ROOT, 'thechess-app', 'www')
OUT  = os.path.join(ROOT, 'firebase', 'hosting', 'public', 'live')
HTML = os.path.join(SRC, 'index.html')

SEMVER = re.compile(r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$')

def die(msg):
    sys.stderr.write('✗ ' + msg + '\n'); sys.exit(1)

def vtuple(v):
    return tuple(int(x) for x in v.split('.'))

def main():
    with_mp3 = '--with-mp3' in sys.argv
    src = open(HTML, encoding='utf-8').read()

    m = re.search(r"const APP_VER='([^']+)'", src)
    if not m: die("index.html に APP_VER が無い")
    ver = m.group(1)
    if not SEMVER.match(ver):
        die("APP_VER が SemVer ではない: %r\n"
            "  数字.数字.数字 のちょうど3つ。頭に0の付く数字は不可。\n"
            "  形の間違いは実機では「版が変わらない」としか見えない。" % ver)

    m = re.search(r"const LIVE_URL='([^']+)'", src)
    if not m: die("index.html に LIVE_URL が無い")
    u = urlsplit(m.group(1))
    base = '%s://%s%s' % (u.scheme, u.netloc, os.path.dirname(u.path))

    # 集める
    files = []
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames.sort()
        for fn in sorted(filenames):
            if fn == '.DS_Store': continue
            full = os.path.join(dirpath, fn)
            rel  = os.path.relpath(full, SRC).replace(os.sep, '/')
            files.append((rel, full))
    if not any(rel == 'index.html' for rel, _ in files):
        die("www に index.html が無い")

    mp3 = [rel for rel, _ in files if rel.lower().endswith('.mp3')]
    if mp3 and not with_mp3:
        die("BGM の mp3 が %d 本ある。\n"
            "  zip は URL を知れば誰でも取れる公開ウェブに置かれる。OpenTracks の\n"
            "  素材は「コンバート等を行わず容易にアクセスできる状態」での配布が禁止\n"
            "  なので、素の mp3 を入れるとそこを踏む。\n"
            "  どれかを決めてから作り直すこと:\n"
            "    1. mp3 を index.html へ埋め込む形に変える（zip の大きさは変わらない）\n"
            "    2. CC0 など、ウェブ配置を許す曲に差し替える\n"
            "    3. 権利者に確認が取れている → --with-mp3 を付ける\n"
            "  ※ zip から外すだけ、は選べない。web ルートごと差し替わるので曲が 404 になる。"
            % len(mp3))

    os.makedirs(OUT, exist_ok=True)
    zp = os.path.join(OUT, ver + '.zip')

    # 中身が同じなら同じ zip になるように、時刻と順序を固定する
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel, full in files:
            zi = zipfile.ZipInfo(rel, date_time=(1980, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            with open(full, 'rb') as f:
                z.writestr(zi, f.read())

    sha = hashlib.sha256(open(zp, 'rb').read()).hexdigest()
    url = '%s/%s.zip' % (base, ver)

    latest = os.path.join(OUT, 'latest.json')
    if os.path.exists(latest):
        try:
            old = json.load(open(latest, encoding='utf-8')).get('version')
            if old and SEMVER.match(old) and vtuple(old) >= vtuple(ver):
                die("いま置いてある版 %s より APP_VER %s が新しくない。\n"
                    "  この状態で出しても、端末は取りに来ない。APP_VER を上げること。" % (old, ver))
        except SystemExit: raise
        except Exception: pass

    json.dump({'version': ver, 'url': url, 'checksum': sha},
              open(latest, 'w', encoding='utf-8'), ensure_ascii=False)

    kb = os.path.getsize(zp) / 1024.0
    print('版      : %s' % ver)
    print('ファイル: %d 本%s' % (len(files), '（mp3 込み）' if mp3 else ''))
    print('zip     : %s  %.0f KB' % (os.path.relpath(zp, ROOT), kb))
    print('sha256  : %s' % sha)
    print('url     : %s' % url)
    print('')
    print('出す  : cd firebase && firebase deploy --only hosting')
    print('※ 審査中は出さないこと。審査する人の端末にも降りる。')

if __name__ == '__main__':
    main()
