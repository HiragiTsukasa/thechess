/* ══ Apple IAP とゲームを繋ぐ層（修正版）═══════════════════════
   元版からの変更点
     1. deviceready を待つ。元版は読み込み時に CdvPurchase を見て、
        まだ無ければ即 return していた。cordova のプラグインは
        DOMContentLoaded 以降に clobber されるので、元版は
        アプリ内でも window.__IAP が作られないまま終わる可能性が高い。
     2. 同じ取引を二度反映しない（transactionId で重複排除）。
        元版は verified が再発火するたびに plays を +12 していたため、
        「購入を復元」を連打すれば回数を増やせてしまう。
     3. 失敗・キャンセルをユーザーに伝える（store.error）。
   商品ID
     com.shuji.thechess.unlimited … 非消耗型（無制限版）
     com.shuji.thechess.plays12   … 消耗型（12回追加）
   ※ 消耗型の残高は Apple が持たない。本番では必ずサーバー側で数えること。
═════════════════════════════════════════════════════════════ */
(function(){
  var UNLIM='com.shuji.thechess.unlimited', PLAYS='com.shuji.thechess.plays12';
  var SEEN_KEY='nc_iap_seen';           /* 反映済み transactionId */

  function seen(){ try{ return JSON.parse(localStorage.getItem(SEEN_KEY)||'[]'); }catch(e){ return []; } }
  function markSeen(id){ try{ var a=seen(); if(a.indexOf(id)<0){ a.push(id); if(a.length>200) a=a.slice(-200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(a)); } }catch(e){} }
  function isNew(id){ return !id || seen().indexOf(id)<0; }

  function setup(){
    if(!(window.CdvPurchase && window.CdvPurchase.store)) return false;
    var store=window.CdvPurchase.store, P=window.CdvPurchase;

    store.register([
      {id:UNLIM, type:P.ProductType.NON_CONSUMABLE, platform:P.Platform.APPLE_APPSTORE},
      {id:PLAYS, type:P.ProductType.CONSUMABLE,     platform:P.Platform.APPLE_APPSTORE}
    ]);

    store.when()
      .approved(function(tr){ tr.verify(); })
      .verified(function(receipt){
        /* 数えるのは Firebase 側。ここは取引IDを渡すだけ。
           二重付与は purchases/{originalTransactionId} で止めている。 */
        try{
          (receipt.sourceReceipt.transactions||[]).forEach(function(t){
            var ours=(t.products||[]).some(function(p){ return p.id===UNLIM||p.id===PLAYS; });
            if(ours && t.transactionId) window.__IAP_APPLY({transactionId:t.transactionId});
          });
        }catch(e){}
        receipt.finish();
      });

    store.error(function(err){
      try{
        /* ユーザーが自分で閉じた場合は黙る */
        if(err && (err.code===P.ErrorCode.PAYMENT_CANCELLED)) return;
        if(window.__IAP_ERR) window.__IAP_ERR(err && err.message);
      }catch(e){}
    });

    store.initialize([P.Platform.APPLE_APPSTORE]);

    window.__IAP={
      restore:function(){ store.restorePurchases(); },
      buy:function(kind){
        var pr=store.get(kind==='unl'?UNLIM:PLAYS, P.Platform.APPLE_APPSTORE);
        var off=pr&&pr.getOffer();
        if(off) off.order();
        else if(window.__IAP_ERR) window.__IAP_ERR('商品を取得できませんでした');
      }
    };
    return true;
  }

  /* cordova のプラグインは deviceready までに clobber される。
     すでに用意できていれば即、まだなら deviceready を待つ。 */
  if(!setup()){
    document.addEventListener('deviceready', function(){ setup(); }, {once:true});
  }
})();
