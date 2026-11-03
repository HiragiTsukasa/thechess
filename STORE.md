# App Store のリスティング草案

そのままコピーして貼れる形にしてある。文字数は実測値。

**プライマリ言語は英語（U.S.）**にして、日本語をローカリゼーションとして足す。
そうしないと、英語圏以外の国で日本語のページが出る。

---

## 英語（U.S.）

### App Name（30文字以内）

```
The Chess: Groundbreaking
```
25文字

### Subtitle（30文字以内）

```
Chess where distance is power
```
29文字

### Promotional Text（170文字以内・審査なしで差し替え可）

```
Pieces have HP. The further one travels, the harder it hits. Twenty-two techniques fire on a 3D board, and a lone king fights back twice as hard.
```
144文字

### Keywords（100文字以内・カンマ区切り・スペースを入れない）

```
chess,hp,rpg,tactics,board,strategy,puzzle,turn,offline,rating,duel,king,3d,solo
```
79文字

### Description

```
Chess, but every piece has HP, and the distance it travels becomes the force of its blow.

A rook that crosses four squares hits for 340. The same rook moving one square barely scratches. You are no longer choosing where a piece should stand. You are choosing how far it should run before it lands.

Checkmate is gone. You win by taking the enemy king's HP to zero.

TWENTY-TWO TECHNIQUES
Pins, forks, skewers, discovered attacks and double checks are not notation here. Each one fires on the board, with its name called out. A knight that lands on two targets at once splits its charge between them and returns. A rook with a clear file fires straight down it.

THE BARE KING
Strip an opponent down to the king alone and it does not surrender. It heals, it doubles its power, it strikes back at anyone who touches it, and for eight turns it is the most dangerous piece on the board. Many games are decided after that moment, not before it.

WHAT IS IN IT
- Offline matches against three strengths of opponent
- Ranked play with a ladder from Pawn to Grandmaster, scored on how you won rather than whether you won
- Room matches: send a friend a four-digit key and play
- 25 puzzles, each built around one technique
- A rulebook where all 22 techniques play out on a 3D board

NO ADS. NO SUBSCRIPTION.
Easy offline, the puzzles and the rulebook are free forever, with no daily limit. One purchase unlocks the other difficulties, ranked play and hosting rooms. That is the only purchase in the app.

Ranked runs 09:00-23:00 Japan time.
```

---

## 日本語

### App Name

```
The Chess: Groundbreaking
```

### Subtitle（30文字以内）

```
走った距離が、そのまま攻撃力になる
```
17文字

### Promotional Text（170文字以内）

```
駒にHPがある。遠くまで走った駒ほど強く殴る。22の技が3Dの盤の上で発動し、裸の王は倍の力で殴り返してくる。
```
56文字

### Keywords（100文字以内）

```
チェス,HP,RPG,戦略,ボード,パズル,ターン制,オフライン,レート,対戦,詰将棋,頭脳
```
45文字

### Description

```
チェス。ただし駒にはHPがあり、走った距離がそのまま一撃の重さになる。

4マス走ったルークは340ダメージ。同じルークが1マスしか動かなければ、かすり傷にしかならない。「どこに置くか」ではなく「どこから走らせるか」を選ぶゲームになる。

チェックメイトは無い。相手のキングのHPを0にした方が勝ち。

■ 22の技
ピン、フォーク、スキュア、ディスカバードアタック、ダブルチェック。ここでは記譜ではなく、盤の上で技名とともに発動する。2体同時に狙えるナイトは突進を分け、元のマスへ戻ってくる。列が通ったルークは、その列をまっすぐ撃ち抜く。

■ ベアキング
相手を王ひとつまで削っても、終わらない。回復し、力が倍になり、触れた者に殴り返し、8ターンのあいだ盤上で最も危険な駒になる。勝負はこの瞬間の「あと」に決まることが多い。

■ 入っているもの
・オフライン対戦（3段階の強さ）
・ランクマッチ。ポーンからグランドマスターまでの階級。「勝ったか」ではなく「どう勝ったか」で点が付く
・部屋対戦。4桁のキーを友だちに渡すだけ
・パズル25問。1問につき1つの技
・ルールブック。22の技すべてが3Dの盤の上で動く

■ 広告なし。サブスクなし。
オフラインの「やさしい」、パズル、ルールブックは、回数制限なく無料のまま遊べる。買い切り1回で、他の難易度とランクマッチ、部屋の作成が開く。アプリ内の購入はそれ1つだけ。

ランクマッチの開催は日本時間 9:00〜23:00。
```

---

## 審査メモ（App Review Information の「メモ」）

```
Ranked play runs 09:00-23:00 Japan time and is closed outside those
hours by design. Everything else (Offline, puzzles, the rulebook, room
matches) is available at any time.

Ranked pairs players of a similar rating through our own Firestore; the
match itself runs peer to peer. When no opponent is available the CPU
stands in, so the mode is always playable for review.

Room matches need two devices: one taps "Create a key", the other
enters the four-digit key shown.

The in-app purchase unlocks Normal, Hard, Ranked and hosting rooms:
Offline -> Normal, or the pill at the bottom of the title screen.
Restore is in the menu at the top right.
```

---

## 入れないと決めた表現

- 「世界中のプレイヤーと対戦」… 相手が見つからないときはCPU。断定しない
- 「リアルタイム対戦」… ターン制
- 「AIが学習」… していない

---

## スクリーンショット

`store/` に、UIだけで成り立つ2枚を各サイズ・各言語で置いた（6.7インチ 1290×2796 / 6.5インチ 1242×2208）。

| | |
|---|---|
| `1-title` | タイトル。ロゴと3つのボタン |
| `2-mechanic` | ルールブックの「走った距離が、そのまま力になる」。**4マス走ると340ダメージ**がそのまま出ている。このゲームが何なのかを1枚で説明できる唯一の画面 |

### 盤の写真は実機で撮ること

ここで生成した盤のスクリーンショットは**使い物にならない**。理由は2つ。

1. ソフトウェア描画なので、影も光沢も実機と違って平たい
2. 技の演出はアニメーションの一瞬で、自動では狙った瞬間を止められない

**実機のテスト中に、自分で撮ってください。** 欲しい瞬間はこの3つ。

| | 撮るタイミング |
|---|---|
| 技の発動 | 技名が大きく出て、ダメージ数字が飛んでいる瞬間 |
| ベアキング | 王が1体になって光り、HPバーが伸びた直後 |
| リザルト | 「勝利」と戦績が並んだ画面 |

Appleは**6.7インチと6.5インチで各3枚以上**を求める。上の2枚＋実機の3枚で足りる。
