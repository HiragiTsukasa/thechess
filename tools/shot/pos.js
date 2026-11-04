/* 実戦らしい中盤の盤面。[side,type,square,opts] */
const W=(t,s,o)=>['w',t,s,o], B=(t,s,o)=>['b',t,s,o];
const base=(ww,bb)=>[...ww,...bb];

/* ① ナイトが敵を踏み越えて e6 へ跳ぶ（Stampede + Tempest） */
const STAMP=base(
 [W('K','g1'),W('Q','d1'),W('R','a1'),W('R','f1'),W('B','c4'),W('B','g5'),W('N','d4'),W('N','c3'),
  W('P','a2'),W('P','b2'),W('P','e4'),W('P','f2'),W('P','g2'),W('P','h2')],
 [B('K','g8'),B('Q','d7'),B('R','a8'),B('R','f8'),B('B','f5'),B('B','e7'),B('N','e5'),B('N','f6'),
  B('P','a7'),B('P','b7'),B('P','c7'),B('P','d5'),B('P','f7'),B('P','g7'),B('P','h7')]);

/* ② ルークが e 列を撃ち抜く（Laser） */
const LASER=base(
 [W('K','g1'),W('Q','d2'),W('R','a1'),W('R','e1'),W('B','b2'),W('N','f3'),
  W('P','a2'),W('P','b3'),W('P','c2'),W('P','f2'),W('P','g2'),W('P','h2')],
 [B('K','g8'),B('Q','d8'),B('R','e8'),B('R','a8'),B('B','b7'),B('N','f6'),
  B('P','a7'),B('P','b6'),B('P','c7'),B('P','f7'),B('P','g7'),B('P','h7')]);

/* ③ f7 のナイトがキングとクイーンを同時に狙う（Royal Fork） */
const FORK=base(
 [W('K','g1'),W('N','f7'),W('Q','d1'),W('R','a1'),W('R','f1'),W('B','c4'),
  W('P','a2'),W('P','b2'),W('P','c2'),W('P','f2'),W('P','g2'),W('P','h2')],
 [B('K','h8'),B('Q','d8'),B('R','a8'),B('R','f8'),B('B','b7'),B('N','c6'),
  B('P','a7'),B('P','b6'),B('P','c7'),B('P','g7'),B('P','h7')]);

/* ④ 瀕死のポーンをクイーンが粉砕する（Overkill） */
const OVER=base(
 [W('K','g1'),W('Q','h1'),W('R','a1'),W('R','f1'),W('B','c4'),W('B','c1'),W('N','f3'),W('N','c3'),
  W('P','a2'),W('P','b2'),W('P','c2'),W('P','d4'),W('P','e4'),W('P','f2'),W('P','g2')],
 [B('K','g8'),B('Q','d8'),B('R','a8'),B('R','f8'),B('B','c8'),B('B','e7'),B('N','c6'),B('N','f6'),
  B('P','a7'),B('P','b7'),B('P','c7'),B('P','d6'),B('P','e5'),B('P','f7'),B('P','g7'),
  B('P','h7',{hp:12})]);

/* ⑤ 傷ついたビショップが倒して回復する（Spoils） */
const SPOIL=base(
 [W('K','g1'),W('Q','d1'),W('R','a1'),W('R','f1'),W('B','c4'),W('B','g5'),W('N','e4',{hp:300}),W('N','c3'),
  W('P','a2'),W('P','b2'),W('P','c2'),W('P','d4'),W('P','f2'),W('P','g2'),W('P','h2')],
 [B('K','g8'),B('Q','d8'),B('R','a8'),B('R','f8'),B('B','c8'),B('B','e7'),B('N','c6'),
  B('N','f6',{hp:70}),
  B('P','a7'),B('P','b7'),B('P','c7'),B('P','d6'),B('P','e5'),B('P','f7'),B('P','g7'),B('P','h7')]);

/* ⑥ ナイトが敵ナイトを撃破する */
const KILL=base(
 [W('K','g1'),W('Q','d1'),W('R','a1'),W('R','f1'),W('B','c4'),W('B','g5'),W('N','e4'),W('N','c3'),
  W('P','a2'),W('P','b2'),W('P','c2'),W('P','d4'),W('P','f2'),W('P','g2'),W('P','h2')],
 [B('K','g8'),B('Q','d8'),B('R','a8'),B('R','f8'),B('B','c8'),B('B','e7'),B('N','c6'),
  B('N','f6',{hp:70}),
  B('P','a7'),B('P','b7'),B('P','c7'),B('P','d6'),B('P','e5'),B('P','f7'),B('P','g7'),B('P','h7')]);

module.exports={
 stampede:{pos:STAMP,from:'d4',to:'e6',kind:'move',want:'Stampede'},
 tempest :{pos:STAMP,from:'d4',to:'e6',kind:'move',want:'Tempest'},
 laser   :{pos:LASER,from:'e1',kind:'cannon',want:'Laser'},
 royalfork:{pos:FORK ,from:'f7',kind:'fork' ,want:'Royal Fork'},
 overkill:{pos:OVER ,from:'h1',to:'h7',kind:'move',want:'Overkill'},
 spoils  :{pos:SPOIL,from:'e4',to:'f6',kind:'move',want:'Spoils'},
 kill    :{pos:KILL ,from:'e4',to:'f6',kind:'move',want:null}
};
