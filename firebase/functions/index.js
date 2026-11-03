/* ══ The Chess ─ 対戦回数とレシート検証 ═══════════════════════
   方針
     1. 回数の増減はすべてここを通す。Firestore のルールでクライアントの
        write は禁止してある（firestore.rules）。
     2. 日付はサーバー時刻で判定する。端末の時計は一切見ない。
     3. 購入残高の鍵は匿名UIDではなく、App Store の originalTransactionId。
        匿名UIDはアプリを消すと変わるので、それだけでは復元できない。
     4. オフラインでは無料ぶんだけ遊べる（syncOfflinePlays で後から同期）。
        購入ぶんはオンラインのときだけ。
═════════════════════════════════════════════════════════════ */
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const PLAY_MAX = 4;                       /* 無料ぶん／日 */
const PLAYS_PER_PACK = 12;                /* plays12 で足す回数 */
const BUNDLE_ID = 'jp.epg.thechess';
const P_UNLIM = 'jp.epg.thechess.unlimited';
const P_PLAYS = 'jp.epg.thechess.plays12';

/* App Store Server API の鍵。firebase functions:secrets:set で入れる */
const APPSTORE_KEY_P8    = defineSecret('APPSTORE_KEY_P8');
const APPSTORE_KEY_ID    = defineSecret('APPSTORE_KEY_ID');
const APPSTORE_ISSUER_ID = defineSecret('APPSTORE_ISSUER_ID');

/* ── サーバー時刻のJST日付。端末の時計を戻す抜け道を塞ぐ ── */
const jstDay = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const uidOf = (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'サインインしてください');
  return uid;
};

const blank = () => ({free: PLAY_MAX, buy: 0, unlim: false, day: jstDay(), lastSpend: null});

/* 読み出し時に日付をまたいでいたら無料ぶんを戻す */
function rollDay(p) {
  const d = jstDay();
  if (p.day !== d) { p.day = d; p.free = PLAY_MAX; }
  return p;
}

const pub = (p) => ({free: p.free, buy: p.buy, unlim: !!p.unlim, day: p.day});

/* ══ 1. 残高を読む（初回はここで作る）══════════════════════ */
exports.getPlays = onCall(async (req) => {
  const uid = uidOf(req);
  const ref = db.doc(`players/${uid}`);
  const p = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const cur = rollDay(s.exists ? s.data() : blank());
    tx.set(ref, cur, {merge: true});
    return cur;
  });
  return pub(p);
});

/* ══ 2. 対局開始時に1回引く ════════════════════════════════
   トランザクションにしてあるのは、通信をやり直したときに
   二重で引かれないようにするため。 */
exports.spendPlay = onCall(async (req) => {
  const uid = uidOf(req);
  const ref = db.doc(`players/${uid}`);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const p = rollDay(s.exists ? s.data() : blank());

    if (p.unlim) { p.lastSpend = 'unlim'; tx.set(ref, p, {merge: true}); return {spent: 'unlim', ...pub(p)}; }

    if (p.free > 0)      { p.free--; p.lastSpend = 'free'; }
    else if (p.buy > 0)  { p.buy--;  p.lastSpend = 'buy';  }
    else throw new HttpsError('resource-exhausted', '対戦回数が残っていません');

    tx.set(ref, p, {merge: true});
    return {spent: p.lastSpend, ...pub(p)};
  });
});

/* ══ 3. キングのHPが0になって負けたときだけ1回戻す ══════════
   投了・離脱では呼ばないこと（ゲーム側の endGame がすでにそうなっている）。 */
exports.refundPlay = onCall(async (req) => {
  const uid = uidOf(req);
  const ref = db.doc(`players/${uid}`);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('failed-precondition', '記録がありません');
    const p = rollDay(s.data());

    if (p.unlim || !p.lastSpend) return pub(p);          /* 引いていないのに増やさない */
    if (p.lastSpend === 'buy')        p.buy++;
    else if (p.free < PLAY_MAX)       p.free++;
    else                              p.buy++;           /* 無料枠が満タンなら購入ぶんへ */
    p.lastSpend = null;

    tx.set(ref, p, {merge: true});
    return pub(p);
  });
});

/* ══ 4. オフラインで使った無料ぶんを後から反映 ══════════════
   その日の無料ぶんを超えては引かれないので、
   抜け道があっても「1日4回」の枠の中に収まる。 */
exports.syncOfflinePlays = onCall(async (req) => {
  const uid = uidOf(req);
  const used = Math.max(0, Math.min(PLAY_MAX, parseInt(req.data && req.data.used, 10) || 0));
  const ref = db.doc(`players/${uid}`);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const p = rollDay(s.exists ? s.data() : blank());
    if (!p.unlim && used > 0) p.free = Math.max(0, Math.min(p.free, PLAY_MAX - used));
    tx.set(ref, p, {merge: true});
    return pub(p);
  });
});

/* ══ 5. レシート検証 ═══════════════════════════════════════
   クライアントは transactionId を渡すだけ。数えるのはここ。 */
exports.verifyPurchase = onCall(
  {secrets: [APPSTORE_KEY_P8, APPSTORE_KEY_ID, APPSTORE_ISSUER_ID]},
  async (req) => {
    const uid = uidOf(req);
    const transactionId = req.data && String(req.data.transactionId || '');
    if (!transactionId) throw new HttpsError('invalid-argument', 'transactionId がありません');

    const {AppStoreServerAPIClient, Environment} = require('@apple/app-store-server-library');

    /* Sandbox と本番でエンドポイントが違う。本番で見つからなければ Sandbox を見る */
    const mk = (env) => new AppStoreServerAPIClient(
      APPSTORE_KEY_P8.value(), APPSTORE_KEY_ID.value(), APPSTORE_ISSUER_ID.value(), BUNDLE_ID, env);

    let info = null;
    for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
      try { info = await mk(env).getTransactionInfo(transactionId); if (info) break; }
      catch (e) { /* 次の環境を試す */ }
    }
    if (!info || !info.signedTransactionInfo) throw new HttpsError('not-found', '取引が見つかりません');

    /* 署名部分のペイロードを読む。署名そのものは Apple のAPIが返した時点で担保されている */
    const tx = JSON.parse(Buffer.from(info.signedTransactionInfo.split('.')[1], 'base64url').toString('utf8'));

    /* ★ 署名鍵はアカウント共通なので、他アプリのレシートでも通ってしまう。
       bundleId と productId を必ず自分のものに限定すること。 */
    if (tx.bundleId !== BUNDLE_ID) throw new HttpsError('permission-denied', '別アプリのレシートです');
    if (tx.productId !== P_UNLIM && tx.productId !== P_PLAYS) {
      throw new HttpsError('invalid-argument', '扱っていない商品です');
    }
    if (tx.revocationDate) throw new HttpsError('failed-precondition', '取り消された取引です');

    const otid = String(tx.originalTransactionId || tx.transactionId);
    const pRef = db.doc(`players/${uid}`);
    const tRef = db.doc(`purchases/${otid}`);

    return db.runTransaction(async (t) => {
      const [ps, ts] = await t.getAll(pRef, tRef);
      const p = rollDay(ps.exists ? ps.data() : blank());

      if (tx.productId === P_UNLIM) {
        /* 非消耗型は何度反映しても同じ。復元もここを通る */
        p.unlim = true;
      } else if (!ts.exists) {
        /* 消耗型は取引ごとに一度だけ。この印が無いと
           「購入を復元」を押すたびに +12 できてしまう */
        p.buy = (p.buy || 0) + PLAYS_PER_PACK;
      }

      t.set(tRef, {uid, productId: tx.productId, transactionId: tx.transactionId,
        at: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
      t.set(pRef, p, {merge: true});
      return {applied: !ts.exists || tx.productId === P_UNLIM, productId: tx.productId, ...pub(p)};
    });
  });
