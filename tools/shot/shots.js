/* カットインを止めたまま、攻撃エフェクトが最高潮のコマを撮る。
   ヘッドレスは描画を強く間引くので、連写してフレームを進めながら撮る。 */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const JOB=require('./pos.js');
const OUT=process.env.OUT||(__dirname+'/out/');
const TMP=OUT+'tmp/';
fs.mkdirSync(TMP,{recursive:true});

const INIT=()=>{
  try{localStorage.setItem('nc_rank',JSON.stringify({rate:2180,name:'Shuji',unlim:true,se:false,vo:false,bgm:false}));
      localStorage.setItem('nc_tut1','1');localStorage.setItem('nc_tut2','1');}catch(e){}
  window.__WANT=null;window.__FROZE=0;
  const fix=el=>{
    if(el.__fx&&!el.classList.contains('push'))return;
    el.__fx=1;el.classList.remove('push');
    el.querySelectorAll('.ttxt,.tlines2 i').forEach(e=>{e.style.animationDelay='-0.70s';e.style.animationPlayState='paused';});
    el.querySelectorAll('.tin').forEach(e=>{e.style.animation='none';e.style.opacity='1';e.style.filter='none';});
    el.querySelectorAll('.tflash').forEach(e=>{e.style.animation='none';e.style.opacity='0';});
    if(!el.__nr){el.__nr=1;el.remove=function(){};}
    window.__FROZE++;
  };
  const scan=()=>{
    if(!window.__WANT)return;
    document.querySelectorAll('.tbn2').forEach(el=>{
      if(el.__hid)return;
      if((el.textContent||'').indexOf(window.__WANT)>=0)fix(el);
      else if(!el.__fx){el.__hid=1;el.style.display='none';}
    });
  };
  const st=()=>{if(!document.documentElement)return setTimeout(st,0);
    new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});};
  st();
  window.__clear=()=>{window.__WANT=null;
    document.querySelectorAll('.tbn2').forEach(e=>{e.__nr=0;e.remove=Element.prototype.remove;e.remove();});};
};

const play=(pg,j)=>pg.evaluate(j=>{
  const F=s=>'abcdefgh'.indexOf(s[0]), R=s=>+s[1];
  const p=__G.pieces.find(q=>q.alive&&q.side==='w'&&q.f===F(j.from)&&q.r===R(j.from));
  if(!p)return 'no piece';
  let m;
  if(j.kind==='fork')m=__G.forkMove(p);
  else if(j.kind==='cannon')m=(__G.skillMoves(p)||[]).find(x=>x.cannon);
  else m=(__G.movesOfT(p)||[]).find(x=>x.f===F(j.to)&&x.r===R(j.to));
  if(!m)return 'no move';
  __G.playerMove(p,m);return 'ok';
},j);

const N=30;
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',
   '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 for(const [sz,w,h] of [['6.7',430,932],['6.5',414,896]])
 for(const [lg,loc] of [['ja','ja-JP'],['en','en-US']]){
  const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:3,locale:loc});
  await c.addInitScript(INIT);
  const pg=await c.newPage();
  await pg.goto('http://127.0.0.1:8731/index.html',{waitUntil:'load'});await wait(4000);
  for(const name of Object.keys(JOB)){
   const j=JOB[name];
   if(fs.existsSync(`${OUT}${sz}-${lg}-${name}.png`)){console.log(sz,lg,name,'skip');continue;}
   let done=false;
   for(let t=0;t<6&&!done;t++){
    for(const f of fs.readdirSync(TMP))fs.unlinkSync(TMP+f);
    await pg.evaluate(w=>{window.__WANT=w||'\u0000';window.__FROZE=0;},j.want);
    await pg.evaluate(j=>__G.setPos(j.pos,'w'),j);
    for(let i=0;i<10;i++){await pg.screenshot({path:TMP+'w.png'});}   /* 盤が落ち着くまでフレームを回す */
    const msg=await play(pg,j);
    if(msg!=='ok'){console.log(sz,lg,name,msg);break;}
    const fxN=[];
    for(let i=1;i<=N;i++){const nm=String(i).padStart(3,'0');
      await pg.screenshot({path:TMP+nm+'.png'});
      fxN.push(Object.assign({f:nm+'.png'},await pg.evaluate(()=>({n:__G.fx(),card:(window.__FROZE|0)>0}))));}
    const froze=await pg.evaluate(()=>window.__FROZE|0);
    if(j.want&&!froze){await pg.evaluate(()=>window.__clear());await wait(200);continue;}
    let pool=j.want?fxN.filter(x=>x.card):fxN;
    if(!pool.length)pool=fxN;
    const files=pool.slice().sort((a,b)=>b.n-a.n);
    fs.copyFileSync(TMP+files[0].f,`${OUT}${sz}-${lg}-${name}.png`);
    /* 2番手も残しておく（選び直し用） */
    fs.copyFileSync(TMP+files[1].f,`${OUT}${sz}-${lg}-${name}-alt.png`);
    console.log(sz,lg,name,'OK',files[0].f,'parts='+files[0].n);
    done=true;
    await pg.evaluate(()=>window.__clear());await wait(200);
   }
   if(!done)console.log(sz,lg,name,'MISS');
  }
  await c.close();
 }
 await b.close();console.log('done');
})().catch(e=>{console.error('FAILED',e.message,e.stack);process.exit(1)});
