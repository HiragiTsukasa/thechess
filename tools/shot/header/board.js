const {chromium}=require('playwright');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const P=[];
const back=['R','N','B','Q','K','B','N','R'];
'abcdefgh'.split('').forEach((f,i)=>{
  P.push(['w',back[i],f+'1']); P.push(['w','P',f+'2']);
  P.push(['b','P',f+'7']);     P.push(['b',back[i],f+'8']);
});
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 const c=await b.newContext({viewport:{width:1500,height:1100},deviceScaleFactor:2,locale:'ja-JP'});
 await c.addInitScript(()=>{try{localStorage.setItem('nc_rank',JSON.stringify({rate:2180,name:'S',unlim:true,se:false,vo:false,bgm:false}));localStorage.setItem('nc_tut1','1');localStorage.setItem('nc_tut2','1');}catch(e){}});
 const pg=await c.newPage();
 await pg.goto('http://127.0.0.1:8731/index.html',{waitUntil:'load'});await wait(5000);
 await pg.evaluate(P=>__G.setPos(P,'w'),P);
 for(let i=0;i<14;i++)await pg.screenshot({path:"/tmp/b.png"});
 await wait(800);
 for(let i=0;i<4;i++)await pg.screenshot({path:"/tmp/board.png"});
 await b.close();console.log('ok');
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
