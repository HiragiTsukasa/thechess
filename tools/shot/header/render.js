const {chromium}=require('playwright');const fs=require('fs');
const OUT='/home/user/thechess/store/header/';fs.mkdirSync(OUT,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SZ=[['5244x2950',5244,2950],['3840x1646',3840,1646]];
const LG={ja:{tag:'チェスであり、チェスとは別の戦略がある。<br>HPと、駒ごとのスキル。',font:'Mincho,serif'},
          en:{tag:'Chess, and a strategy chess never had.<br>HP, and a skill on every piece.',font:'system-ui,sans-serif'}};
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 for(const [nm,w,h] of SZ) for(const lg of ['ja','en']){
  const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});
  const pg=await c.newPage();
  await pg.goto('http://127.0.0.1:8731/_hdr.html',{waitUntil:'load'});
  await pg.evaluate(({h,lg,tag,font})=>{
    const s=h/2950;                       // 5244x2950 を基準に文字を拡大縮小
    document.getElementById('t').style.fontSize=(300*s)+'px';
    document.getElementById('s').style.fontSize=(64*s)+'px';
    document.querySelector('.rule').style.marginTop=(60*s)+'px';
    document.getElementById('art').src='_hdr-art-'+lg+'.png';
    const g=document.getElementById('g');
    g.style.fontSize=(74*s)+'px';g.style.fontFamily=font;g.innerHTML=tag;
  },{h,lg,...LG[lg]});
  await pg.evaluate(()=>document.fonts.ready);
  await wait(1200);
  await pg.screenshot({path:`${OUT}header-${lg}-${nm}.png`});
  console.log(lg,nm,'ok');
  await c.close();
 }
 await b.close();console.log('done');
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
