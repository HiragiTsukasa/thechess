const {chromium}=require('playwright');
const fs=require('fs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const JOB=require('./pos.js');
/* 事前に www/ を http://127.0.0.1:8731 で配ってから node tools/shot/shots.js */
const OUT=process.env.OUT||(__dirname+'/out/');
fs.mkdirSync(OUT,{recursive:true});

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

const play=(pg,j)=>pg.evaluate(async j=>{
  const F=s=>'abcdefgh'.indexOf(s[0]), R=s=>+s[1];
  __G.setPos(j.pos,'w');
  await new Promise(r=>setTimeout(r,1400));
  const p=__G.pieces.find(q=>q.alive&&q.side==='w'&&q.f===F(j.from)&&q.r===R(j.from));
  if(!p)return 'no piece '+j.from;
  let m;
  if(j.kind==='fork')m=__G.forkMove(p);
  else if(j.kind==='cannon')m=(__G.skillMoves(p)||[]).find(x=>x.cannon);
  else m=(__G.movesOfT(p)||[]).find(x=>x.f===F(j.to)&&x.r===R(j.to));
  if(!m)return 'no move';
  __G.playerMove(p,m);
  return 'ok';
},j);

(async()=>{
 const b=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 for(const [sz,w,h] of [['6.7',430,932],['6.5',414,896]])
 for(const [lg,loc] of [['ja','ja-JP'],['en','en-US']]){
  const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:3,locale:loc});
  await c.addInitScript(INIT);
  const pg=await c.newPage();
  await pg.goto('http://127.0.0.1:8731/index.html',{waitUntil:'load'});await wait(5000);
  for(const name of Object.keys(JOB)){
   const j=JOB[name];
   if(j.want){
    let ok=0,msg='';
    for(let t=0;t<8&&!ok;t++){
     await pg.evaluate(w=>{window.__WANT=w;window.__FROZE=0;},j.want);
     msg=await play(pg,j);
     await wait(2600);
     ok=await pg.evaluate(()=>window.__FROZE|0);
     if(ok)await pg.screenshot({path:`${OUT}${sz}-${lg}-${name}.png`});
     await pg.evaluate(()=>window.__clear());
     await wait(300);
    }
    console.log(sz,lg,name,ok?'OK':'MISS '+msg);
   }else{
    await pg.evaluate(()=>{window.__WANT='\u0000';window.__FROZE=0;});
    const msg=await play(pg,j);
    for(let t=1;t<=14;t++){await wait(150);
      await pg.screenshot({path:`${OUT}${sz}-${lg}-${name}-${String(t*150).padStart(4,'0')}.png`});}
    await pg.evaluate(()=>window.__clear());
    console.log(sz,lg,name,'burst',msg);
   }
  }
  await c.close();
 }
 await b.close();console.log('done');
})().catch(e=>{console.error('FAILED',e.message,e.stack);process.exit(1)});
