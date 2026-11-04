#!/usr/bin/env python3
"""www/fonts/*.woff2 を作り直す。

文面を足すと、同梱しているサブセットに無い字が出て、そこだけ別の書体で
表示される（「対局履歴」の履と歴がそうだった）。日本語を足したら流すこと。

  pip install fonttools brotli
  python3 tools/fonts/build.py

index.html と dict.json に出てくる仮名・漢字・記号を全部集めて、
Google Fonts の原本から woff2 を切り直す。
"""
import json,os,re,subprocess,sys,urllib.request

ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WWW=os.path.join(ROOT,'thechess-app','www')
OUT=os.path.join(WWW,'fonts')
TMP='/tmp/fontsrc'

FAM={  # 出力名 : Google Fonts の family 指定
 'dela400':'Dela+Gothic+One',
 'mincho400':'Zen+Old+Mincho:wght@400;700',
 'mincho700':'Zen+Old+Mincho:wght@400;700',
}
PICK={'dela400':0,'mincho400':0,'mincho700':1}   # css に並ぶ ttf の何番目か
UA='Mozilla/5.0 (X11; Linux x86_64)'

def charset():
    s=open(os.path.join(WWW,'index.html'),encoding='utf-8').read()
    d=json.load(open(os.path.join(ROOT,'tools','i18n','dict.json'),encoding='utf-8'))
    txt=s+''.join(d.keys())+''.join(str(v) for v in d.values())
    def keep(ch):
        o=ord(ch)
        return (0x3000<=o<=0x30ff or 0x4e00<=o<=0x9fff or 0xff00<=o<=0xffef
                or 0x2010<=o<=0x2027 or 0x2160<=o<=0x217f
                or o in (0x2026,0x2190,0x2192,0x25b3,0x25bd,0x2605,0x2606))
    cjk=sorted({c for c in txt if keep(c)})
    return ''.join(sorted(set([chr(i) for i in range(0x20,0x7f)]+cjk+list('×÷±°–—‘’“”…※→←↑↓♪✦✓■□●○▲▼'))))

def fetch(name):
    os.makedirs(TMP,exist_ok=True)
    ttf=os.path.join(TMP,name+'.ttf')
    if os.path.exists(ttf):return ttf
    req=urllib.request.Request('https://fonts.googleapis.com/css2?family='+FAM[name],headers={'User-Agent':UA})
    css=urllib.request.urlopen(req).read().decode()
    urls=re.findall(r'https://[^)]*\.ttf',css)
    urllib.request.urlretrieve(urls[PICK[name]],ttf)
    return ttf

def main():
    cs=charset()
    p=os.path.join(TMP,'charset.txt');os.makedirs(TMP,exist_ok=True)
    open(p,'w',encoding='utf-8').write(cs)
    print('文字数',len(cs))
    for name in FAM:
        ttf=fetch(name)
        dst=os.path.join(OUT,name+'.woff2')
        subprocess.run([sys.executable,'-m','fontTools.subset',ttf,'--text-file='+p,
            '--output-file='+dst,'--flavor=woff2','--layout-features=*',
            '--no-hinting','--desubroutinize'],check=True)
        print(f'{name}: {os.path.getsize(dst)/1024:.1f} KB')

if __name__=='__main__':main()
