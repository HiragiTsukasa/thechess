/* ══ Apple IAP とゲームを繋ぐ層 ═══════════════════════════════
   売り物は非消耗型ひとつだけ。
     com.shuji.thechess.unlimited … 製品版（ふつう／つよい／ランクマッチを開放）

   消耗型をやめたので、残高を数える必要がなく、サーバーも要らない。
   非消耗型は Apple が購入履歴を持っているので、機種変でもアプリを消しても
   「購入を復元」で戻せる。

   ゲーム側が見ているのは次の2つ。
     window.__IAP.buy('unl') / window.__IAP.restore()
     window.__IAP_APPLY({unlim:true})   … 結果をゲームへ返す（ゲーム側が定義済み）

   ★ deviceready を待つこと。cordova のプラグインは DOMContentLoaded 以降に
     clobber されるので、読み込み時に CdvPurchase を見て即 return すると
     アプリ内でも window.__IAP が作られないまま終わる。
═════════════════════════════════════════════════════════════ */
(function(){
  var UNLIM='com.shuji.thechess.unlimited';

  function setup(){
    if(!(window.CdvPurchase && window.CdvPurchase.store)) return false;
    var store=window.CdvPurchase.store, P=window.CdvPurchase;

    store.register([
      {id:UNLIM, type:P.ProductType.NON_CONSUMABLE, platform:P.Platform.APPLE_APPSTORE}
    ]);

    store.when()
      .approved(function(tr){ tr.verify(); })
      .verified(function(receipt){
        try{
          var ours=(receipt.sourceReceipt.transactions||[]).some(function(t){
            return (t.products||[]).some(function(p){ return p.id===UNLIM; });
          });
          /* 非消耗型なので何度来ても同じ結果。重複排除は要らない */
          if(ours) window.__IAP_APPLY({unlim:true});
        }catch(e){}
        receipt.finish();
      });

    store.error(function(err){
      try{
        if(err && err.code===P.ErrorCode.PAYMENT_CANCELLED) return;   /* 自分で閉じたときは黙る */
        if(window.__IAP_ERR) window.__IAP_ERR(err && err.message);
      }catch(e){}
    });

    store.initialize([P.Platform.APPLE_APPSTORE]);

    window.__IAP={
      restore:function(){ store.restorePurchases(); },
      buy:function(){
        var pr=store.get(UNLIM, P.Platform.APPLE_APPSTORE);
        var off=pr&&pr.getOffer();
        if(off) off.order();
        else if(window.__IAP_ERR) window.__IAP_ERR('商品を取得できませんでした');
      }
    };
    return true;
  }

  if(!setup()){
    document.addEventListener('deviceready', function(){ setup(); }, {once:true});
  }
})();
