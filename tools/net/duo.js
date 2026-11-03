const {chromium}=require('playwright');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const U='http://127.0.0.1:8731/index.html';
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const mk=async name=>{
   const c=await b.newContext({viewport:{width:430,height:932},locale:'ja-JP'});
   await c.addInitScript(n=>{try{localStorage.setItem('nc_rank',JSON.stringify({rate:1200,name:n,unlim:true,se:false,vo:false,bgm:false}));}catch(e){}},name);
   const p=await c.newPage();const e=[];
   p.on('pageerror',x=>e.push(name+' pageerror: '+x.message));
   p.on('console',m=>{if(m.type()==='error')e.push(name+' console: '+m.text());});
   p.on('requestfailed',r=>e.push(name+' reqfail: '+r.url().slice(-40)));
   await p.goto(U,{waitUntil:'load'});await wait(4500);
   if(process.env.NODIRECT)await p.evaluate(()=>__G.noDirect(true));
   return {c,p,e,name};
 };
 const H=await mk('ホスト'), G=await mk('ゲスト');

 // ホスト：オンライン → キーを作成
 await H.p.click('#onlineBtn');await wait(700);await H.p.click('#cpuBtn');await wait(1000);
 let code=null;
 for(let i=0;i<40&&!code;i++){await wait(500);
   const t=await H.p.evaluate(()=>document.getElementById('waitCode').textContent.trim());
   if(/^\d{4}$/.test(t))code=t;}
 console.log('部屋キー:',code,' メッセージ:',JSON.stringify(await H.p.evaluate(()=>document.getElementById('lobbyMsg').textContent)));
 if(!code){console.log('errors:',H.e);await b.close();return;}

 // ゲスト：オンライン → キーを入力
 await G.p.click('#onlineBtn');await wait(700);await G.p.click('#onlineBtn');await wait(900);
 await G.p.fill('#codeIn',code);await G.p.click('#joinBtn');
 await wait(14000);

 const st=async x=>x.p.evaluate(()=>({
   board:!document.getElementById('title').classList.contains('hide')?'タイトル':'盤',
   side:(window.__G&&__G.sel!==undefined)?undefined:undefined,
   turn:__G.turn,over:__G.over,
   link:[...document.querySelectorAll('#logList li,#log div,#log p')].length}));
 console.log('ホスト:',JSON.stringify(await st(H)));
 console.log('ゲスト:',JSON.stringify(await st(G)));
 console.log('ホストのログ:',await H.p.evaluate(()=>{const l=document.getElementById('log');return l?l.textContent.trim().slice(-120):'(log無し)';}));
 console.log('ゲストのログ:',await G.p.evaluate(()=>{const l=document.getElementById('log');return l?l.textContent.trim().slice(-120):'(log無し)';}));


 const deep=async x=>x.p.evaluate(()=>({busy:__G.busy,over:__G.over,turn:__G.turn,
   sel:__G.ui().sel,mode:(typeof RM!=='undefined')?undefined:undefined}));
 console.log('ホスト通信:',JSON.stringify(await H.p.evaluate(()=>__G.net())));
 console.log('ゲスト通信:',JSON.stringify(await G.p.evaluate(()=>__G.net())));
 console.log('ホスト詳細:',JSON.stringify(await deep(H)));
 console.log('ゲスト詳細:',JSON.stringify(await deep(G)));
 // ホスト（白）が1手指す
 console.log('humanSide/mode:',JSON.stringify(await H.p.evaluate(()=>({hs:__G.ui(),movesOf:(()=>{try{const p=__G.pieces.find(q=>q.alive&&q.f===4&&q.r===2);return p?(__G.movesOfT(p)||[]).length:'駒なし';}catch(e){return 'ERR '+e.message;}})()}))));
 await H.p.evaluate(()=>__G.tapSq('e2'));await wait(800);
 console.log('e2 を押した後の sel:',JSON.stringify(await H.p.evaluate(()=>__G.ui())));
 await H.p.evaluate(()=>__G.tapSq('e4'));await wait(700);
 console.log('e4 を1回押した後:',JSON.stringify(await H.p.evaluate(()=>__G.ui())));
 await H.p.evaluate(()=>__G.tapSq('e4'));
 for(let i=0;i<25;i++){await wait(1000);
  const a=await H.p.evaluate(()=>({b:__G.busy,t:__G.turn,s:__G.ui().sel,p:__G.ui().pending}));
  const g=await G.p.evaluate(()=>({b:__G.busy,t:__G.turn}));
  console.log(' +'+(i+1)+'s ホスト',JSON.stringify(a),' ゲスト',JSON.stringify(g));
  if(a.t==='b'&&g.t==='b')break;}
 console.log('ホスト通信(後):',JSON.stringify(await H.p.evaluate(()=>__G.net())));
 console.log('ゲスト通信(後):',JSON.stringify(await G.p.evaluate(()=>__G.net())));
 console.log('--- 1手後 ---');
 console.log('ホスト turn:',await H.p.evaluate(()=>__G.turn));
 console.log('ゲスト turn:',await G.p.evaluate(()=>__G.turn));
 console.log('ゲスト盤の e4:',await G.p.evaluate(()=>{const q=__G.pieces.find(x=>x.alive&&x.f===4&&x.r===4);return q?q.side+q.t:'なし';}));
 console.log('errors:',[...H.e,...G.e].length?[...H.e,...G.e]:'none');
 await b.close();
})().catch(e=>{console.error('TEST FAILED',e.message);process.exit(1)});
