#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ライブ更新の配信物を作る。

  python3 tools/live/build.py              manifest 方式（既定・これを使う）
  python3 tools/live/build.py --zip        zip 方式（予備。mp3 が公開ウェブに乗る）

出すのは  cd firebase && firebase deploy --only hosting

── なぜ manifest 方式なのか ──────────────────────────────
zip 方式は www を丸ごと公開ウェブに置く。BGM の mp3 は素のまま置けない
（OpenTracks：コンバートせず容易にアクセスできる状態での配布が禁止）。

プラグインの manifest 方式は、ファイルごとに
    ビルトイン（アプリに同梱された元の www）→ キャッシュ → ダウンロード
の順で解決する（CapgoUpdater.swift の downloadManifest）。
**ビルトインとハッシュが一致するファイルは download_url を見に行かない。**
だから mp3 は URL を書かずに済み、公開ウェブに一切置かれない。
ついでに、変わっていないファイルは毎回落とさないので更新が軽い。

── 実装から確認した取り決め（8.54.2）────────────────────
  * version は厳密な SemVer 3要素
  * manifest があるとき bundle 全体の checksum は不要
    （downloadBundle: `if manifestEntries == nil && checksum.isEmpty` で初めて弾く）
  * ただし `url` は形式として必須。manifest 時は使われないが、無いと reject される
  * file_hash は sha256 の小文字16進（64桁）
  * ビルトインの一致判定は ios/App/App/public/ota-builtin-hashes.json を使う。
    同じ sha256 なので、こちらの計算と突き合わせられる
"""
import hashlib, json, os, re, shutil, sys, zipfile
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC  = os.path.join(ROOT, 'thechess-app', 'www')
OUT  = os.path.join(ROOT, 'firebase', 'hosting', 'public', 'live')
HTML = os.path.join(SRC, 'index.html')
TABLE = os.path.join(ROOT, 'thechess-app', 'ios', 'App', 'App', 'public', 'ota-builtin-hashes.json')

SEMVER = re.compile(r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$')
BUILTIN_ONLY = re.compile(r'\.mp3$', re.I)   # 公開ウェブに置けないもの

def die(msg):
    sys.stderr.write('✗ ' + msg + '\n'); sys.exit(1)

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def vtuple(v): return tuple(int(x) for x in v.split('.'))

def collect():
    out = []
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames.sort()
        for fn in sorted(filenames):
            if fn == '.DS_Store': continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, SRC).replace(os.sep, '/')
            out.append((rel, full))
    return out

def read_version():
    src = open(HTML, encoding='utf-8').read()
    m = re.search(r"const APP_VER='([^']+)'", src)
    if not m: die("index.html に APP_VER が無い")
    ver = m.group(1)
    if not SEMVER.match(ver):
        die("APP_VER が SemVer ではない: %r\n"
            "  数字.数字.数字 のちょうど3つ。頭0は不可。\n"
            "  形の間違いは実機では「版が変わらない」としか見えない。" % ver)
    m2 = re.search(r"const LIVE_URL='([^']+)'", src)
    if not m2: die("index.html に LIVE_URL が無い")
    u = urlsplit(m2.group(1))
    base = '%s://%s%s' % (u.scheme, u.netloc, os.path.dirname(u.path))
    return ver, base

def check_not_older(ver):
    latest = os.path.join(OUT, 'latest.json')
    if not os.path.exists(latest): return
    try:
        old = json.load(open(latest, encoding='utf-8')).get('version')
    except Exception:
        return
    if old and SEMVER.match(old) and vtuple(old) >= vtuple(ver):
        die("いま置いてある版 %s より APP_VER %s が新しくない。\n"
            "  この状態で出しても端末は取りに来ない。APP_VER を上げること。" % (old, ver))

def builtin_table():
    if not os.path.exists(TABLE):
        return None
    try:
        return json.load(open(TABLE, encoding='utf-8')).get('files') or {}
    except Exception:
        return None

def build_manifest(ver, base):
    files = collect()
    if not any(r == 'index.html' for r, _ in files):
        die("www に index.html が無い")

    table = builtin_table()
    hashes = {rel: sha256(full) for rel, full in files}

    # ビルトイン頼みのファイルは、端末が持っているものと同じでなければならない
    onlys = [r for r in hashes if BUILTIN_ONLY.search(r)]
    if table is None:
        die("ビルトインのハッシュ表が無い:\n  %s\n"
            "  thechess-app で `npx cap sync ios` を一度通すと作られる。\n"
            "  これが無いと、mp3 が端末のものと同じかを確かめられない。" % TABLE)
    bad = [r for r in onlys if table.get(r, {}).get('sha256') != hashes[r]]
    if bad:
        die("端末のビルトインと中身が違うファイルがある:\n"
            "    %s\n"
            "  これらは公開ウェブに置けないので download_url を書かない＝\n"
            "  端末は自分の中のものを使う。中身が変わっているなら、ライブでは配れない。\n"
            "  ストアの更新として出すこと（出したあと `npx cap sync ios` で表が更新される）。"
            % '\n    '.join(bad))

    verdir = os.path.join(OUT, ver)
    if os.path.isdir(verdir): shutil.rmtree(verdir)
    os.makedirs(verdir, exist_ok=True)

    manifest, published, kept = [], 0, 0
    for rel, full in files:
        e = {'file_name': rel, 'file_hash': hashes[rel]}
        if BUILTIN_ONLY.search(rel):
            e['download_url'] = None           # 端末のビルトインから取る
            kept += 1
        else:
            dst = os.path.join(verdir, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(full, dst)
            e['download_url'] = '%s/%s/%s' % (base, ver, rel)
            published += 1
        manifest.append(e)

    # url は manifest 方式では使われないが、無いとプラグインが reject する
    latest = {'version': ver, 'url': '%s/%s/' % (base, ver), 'manifest': manifest}
    json.dump(latest, open(os.path.join(OUT, 'latest.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    size = sum(os.path.getsize(os.path.join(verdir, r))
               for r, _ in files if not BUILTIN_ONLY.search(r))
    print('方式    : manifest')
    print('版      : %s' % ver)
    print('配る    : %d 本  %.0f KB' % (published, size / 1024.0))
    print('端末内  : %d 本（mp3。公開ウェブには置かれない）' % kept)
    print('置き場  : %s' % os.path.relpath(verdir, ROOT))
    print('')
    print('出す  : cd firebase && firebase deploy --only hosting')
    print('※ 審査中は出さないこと。審査する人の端末にも降りる。')

def build_zip(ver, base, with_mp3):
    files = collect()
    mp3 = [r for r, _ in files if BUILTIN_ONLY.search(r)]
    if mp3 and not with_mp3:
        die("zip 方式は www を丸ごと公開ウェブに置くので、mp3 が %d 本そのまま乗る。\n"
            "  既定の manifest 方式なら mp3 は端末のものを使うので置かずに済む。\n"
            "  それでも zip で出すなら --with-mp3 を付ける。" % len(mp3))
    os.makedirs(OUT, exist_ok=True)
    zp = os.path.join(OUT, ver + '.zip')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel, full in files:                       # 中身が同じなら同じ zip になる
            zi = zipfile.ZipInfo(rel, date_time=(1980, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, open(full, 'rb').read())
    sm = sha256(zp)
    json.dump({'version': ver, 'url': '%s/%s.zip' % (base, ver), 'checksum': sm},
              open(os.path.join(OUT, 'latest.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('方式    : zip（予備）')
    print('版      : %s' % ver)
    print('zip     : %s  %.0f KB' % (os.path.relpath(zp, ROOT), os.path.getsize(zp) / 1024.0))
    print('sha256  : %s' % sm)

def main():
    ver, base = read_version()
    check_not_older(ver)
    if '--zip' in sys.argv:
        build_zip(ver, base, '--with-mp3' in sys.argv)
    else:
        build_manifest(ver, base)

if __name__ == '__main__':
    main()
