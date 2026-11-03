/* マッチングの取り合いを実物と同じ手順で回す。
   1ティック＝クライアントのループ1周。順序は毎回混ぜる。
     手順1: 自分のドキュメントを読む（掴まれていれば host として確定）
     手順2: 待っている人を読む
     手順3: 掴む（相手の updateTime が条件。原子化版は自分の updateTime も条件）
   手順1で読んだ自分のバージョンを手順3で使う＝実物と同じ往復のずれが入る。 */
const BAND0=150;

function run(n,oneWay,atomic,seed){
  let rnd=seed||1; const rand=()=>(rnd=(rnd*1103515245+12345)&0x7fffffff)/0x7fffffff;
  const store=new Map(), players=[];
  for(let i=0;i<n;i++){
    const uid=String.fromCharCode(97+i%26)+i.toString(36).padStart(4,'0');
    players.push({uid,rate:1200+Math.floor(rand()*600),peer:'p'+i,done:null,seenVer:0});
    store.set(uid,{state:'waiting',rate:players[i].rate,peer:'p'+i,ts:0,ver:0});
  }
  const claim=(target,tVer,by,byPeer,myVer)=>{
    const d=store.get(target); if(!d||d.ver!==tVer||d.state!=='waiting')return false;
    if(atomic){const me=store.get(by); if(!me||me.ver!==myVer)return false; store.delete(by);}
    d.state='matched'; d.with=by; d.opPeer=byPeer; d.ver++; return true;
  };
  for(let tick=0;tick<10;tick++){
    const order=players.slice().sort(()=>rand()-.5);
    for(const p of order){                       // 手順1
      if(p.done)continue;
      const mine=store.get(p.uid);
      if(!mine){p.done=p.done||{stranded:true};continue;}
      p.seenVer=mine.ver;
      if(mine.state==='matched'){p.done={host:true,with:mine.with};store.delete(p.uid);}
    }
    const snap=[...store.entries()].map(([uid,d])=>({uid,...d}));   // 手順2
    for(const p of order){                       // 手順3
      if(p.done)continue;
      const band=BAND0+tick*200;
      const cands=snap
        .filter(d=>d.state==='waiting'&&d.uid!==p.uid&&Math.abs(d.rate-p.rate)<=band)
        .filter(d=>oneWay?d.uid>p.uid:true)
        .sort((a,b)=>a.ts-b.ts);
      for(const c of cands){
        if(claim(c.uid,c.ver,p.uid,p.peer,p.seenVer)){
          p.done={host:false,with:c.uid}; store.delete(p.uid); break;}
      }
    }
  }
  let pairs=0,deadlock=0,stranded=0,none=0;
  const by=new Map(players.map(p=>[p.uid,p]));
  for(const p of players){
    if(!p.done||p.done.stranded){none++;continue;}
    const o=by.get(p.done.with);
    if(!o||!o.done||o.done.with!==p.uid){stranded++;continue;}
    if(o.done.host===p.done.host){deadlock++;continue;}
    pairs++;
  }
  return {pairs:pairs/2,deadlock,stranded,none};
}
const NAME=['何もなし        ','向き固定だけ    ','向き固定＋原子化'];
const CFG=[[false,false],[true,false],[true,true]];
for(const n of [2,4,8,20,50]){
  const acc=CFG.map(()=>({pairs:0,deadlock:0,stranded:0,none:0}));
  for(let s=1;s<=300;s++)CFG.forEach(([o,a],i)=>{
    const r=run(n,o,a,s);for(const k in r)acc[i][k]+=r[k];});
  console.log(`${n}人 ×300回　（延べ${n*300}人）`);
  acc.forEach((a,i)=>console.log(
    `  ${NAME[i]} : 成立${String(a.pairs).padStart(5)}組  両者が同じ役${String(a.deadlock).padStart(5)}人  片側取り残し${String(a.stranded).padStart(5)}人  相手なし${String(a.none).padStart(4)}人`));
}
