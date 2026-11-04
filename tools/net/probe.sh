K=AIzaSyDvpl3Bdk7IKEg8HXVjkaUb2x4JiDqWwiA
B="https://firestore.googleapis.com/v1/projects/the-chess-33d12/databases/(default)/documents"
mk(){ curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$K" \
      -H "Content-Type: application/json" -d '{"returnSecureToken":true}'; }
A=$(mk); AT=$(echo "$A"|python3 -c "import sys,json;print(json.load(sys.stdin)['idToken'])"); AU=$(echo "$A"|python3 -c "import sys,json;print(json.load(sys.stdin)['localId'])")
C=$(mk); CT=$(echo "$C"|python3 -c "import sys,json;print(json.load(sys.stdin)['idToken'])"); CU=$(echo "$C"|python3 -c "import sys,json;print(json.load(sys.stdin)['localId'])")
NOW=$(( $(date +%s) * 1000 ))
code=7731
hit(){ printf "%-46s" "$1"; shift; curl -s -o /tmp/pb -w "HTTP %{http_code}" "$@"; 
       grep -o '"status": *"[A-Z_]*"' /tmp/pb | head -1 | sed 's/^/  /'; echo; }

hit "1) 無い部屋を1件読む（期待 404）" "$B/rooms/0000" -H "Authorization: Bearer $AT"
hit "2) 一覧を取る（期待 403）" "$B/rooms?pageSize=1" -H "Authorization: Bearer $AT"
hit "3) 自分がホストの部屋を作る（期待 200）" -X PATCH "$B/rooms/$code?currentDocument.exists=false" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"h\":{\"stringValue\":\"$AU\"},\"hd\":{\"stringValue\":\"offer\"},\"hn\":{\"stringValue\":\"A\"},\"hr\":{\"integerValue\":\"1200\"},\"hi\":{\"stringValue\":\"\"},\"hu\":{\"integerValue\":\"0\"},\"gi\":{\"stringValue\":\"\"},\"gu\":{\"integerValue\":\"0\"},\"st\":{\"stringValue\":\"wait\"},\"t\":{\"integerValue\":\"$NOW\"}}}"
hit "4) 同じ番号をもう一度作る（期待 400＝既にある）" -X PATCH "$B/rooms/$code?currentDocument.exists=false" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"h\":{\"stringValue\":\"$AU\"},\"t\":{\"integerValue\":\"$NOW\"}}}"
hit "5) 他人がホストの欄に書く（期待 403）" -X PATCH "$B/rooms/$code?updateMask.fieldPaths=hi&updateMask.fieldPaths=hu" \
  -H "Authorization: Bearer $CT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"hi\":{\"stringValue\":\"のっとり\"},\"hu\":{\"integerValue\":\"1\"}}}"
hit "6) 他人がゲストとして入る（期待 200）" -X PATCH "$B/rooms/$code?updateMask.fieldPaths=g&updateMask.fieldPaths=gd&updateMask.fieldPaths=gn&updateMask.fieldPaths=gr&updateMask.fieldPaths=t" \
  -H "Authorization: Bearer $CT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"g\":{\"stringValue\":\"$CU\"},\"gd\":{\"stringValue\":\"answer\"},\"gn\":{\"stringValue\":\"C\"},\"gr\":{\"integerValue\":\"1250\"},\"t\":{\"integerValue\":\"$NOW\"}}}"
hit "7) ゲストが自分の手を書く（期待 200）" -X PATCH "$B/rooms/$code?updateMask.fieldPaths=gi&updateMask.fieldPaths=gu&updateMask.fieldPaths=t" \
  -H "Authorization: Bearer $CT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"gi\":{\"stringValue\":\"{}\"},\"gu\":{\"integerValue\":\"1\"},\"t\":{\"integerValue\":\"$NOW\"}}}"
hit "8) ホストが自分の手を書く（期待 200）" -X PATCH "$B/rooms/$code?updateMask.fieldPaths=hi&updateMask.fieldPaths=hu&updateMask.fieldPaths=t" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"hi\":{\"stringValue\":\"{}\"},\"hu\":{\"integerValue\":\"1\"},\"t\":{\"integerValue\":\"$NOW\"}}}"
hit "9) 他人が新しい部屋を消す（期待 403）" -X DELETE "$B/rooms/$code" -H "Authorization: Bearer $CT"
hit "10) ホストが自分の部屋を消す（期待 200）" -X DELETE "$B/rooms/$code" -H "Authorization: Bearer $AT"

echo
echo "── 順位表・引き継ぎ・通報 ──"
RID=$(date +%s)
hit "11) 自分の順位行を作る（期待 200）" -X PATCH "$B/rank/$AU?currentDocument.exists=false" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"name\":{\"stringValue\":\"A\"},\"rate\":{\"integerValue\":\"1200\"},\"upd\":{\"integerValue\":\"$NOW\"}}}"
hit "12) 他人の順位行に書く（期待 403）" -X PATCH "$B/rank/$AU?updateMask.fieldPaths=rate" \
  -H "Authorization: Bearer $CT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"rate\":{\"integerValue\":\"3600\"}}}"
hit "13) レート3601を書く（期待 403）" -X PATCH "$B/rank/$CU?currentDocument.exists=false" \
  -H "Authorization: Bearer $CT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"name\":{\"stringValue\":\"C\"},\"rate\":{\"integerValue\":\"3601\"},\"upd\":{\"integerValue\":\"$NOW\"}}}"
hit "14) 2分あけずに更新（期待 403）" -X PATCH "$B/rank/$AU" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"name\":{\"stringValue\":\"A\"},\"rate\":{\"integerValue\":\"1210\"},\"upd\":{\"integerValue\":\"$NOW\"}}}"
hit "15) 順位表の一覧を取る（期待 200）" "$B/rank?pageSize=3" -H "Authorization: Bearer $AT"
hit "16) 通報を投げる（期待 200）" -X PATCH "$B/reports/t$RID?currentDocument.exists=false" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"by\":{\"stringValue\":\"$AU\"},\"name\":{\"stringValue\":\"X\"},\"kind\":{\"stringValue\":\"name\"},\"text\":{\"stringValue\":\"test\"},\"t\":{\"integerValue\":\"$NOW\"}}}"
hit "17) 通報を読む（期待 403）" "$B/reports/t$RID" -H "Authorization: Bearer $AT"
hit "18) 引き継ぎを保存する（期待 200）" -X PATCH "$B/p/T$RID?currentDocument.exists=false" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"name\":{\"stringValue\":\"A\"},\"rate\":{\"integerValue\":\"1200\"},\"upd\":{\"integerValue\":\"$NOW\"}}}"
hit "19) 引き継ぎを読む（期待 200）" "$B/p/T$RID" -H "Authorization: Bearer $CT"
hit "20) 引き継ぎの一覧を取る（期待 403）" "$B/p?pageSize=1" -H "Authorization: Bearer $AT"
hit "21) 引き継ぎを消す（期待 403）" -X DELETE "$B/p/T$RID" -H "Authorization: Bearer $AT"
