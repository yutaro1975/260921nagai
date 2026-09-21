'use strict';

/* =====================================================
   ネットワークトラブル診断ゲーム - script.js

   【ファイルの構成】
   1. 設定
   2. ネットワークの形（場所ごとの機器の並び） ← 先生が図を変えるときはここ
   3. 問題データ                              ← 先生が問題や解説を書き換えるときはここ
   4. 故障の計算
   5. ネットワーク図の描画
   6. 問題画面の処理
   7. 結果画面・振り返りの処理
   8. 起動処理
   ===================================================== */


/* =====================================================
   1. 設定
   ===================================================== */

// 振り返りの文字数（最小・最大）
const REFLECTION_MIN = 100;
const REFLECTION_MAX = 300;

// 何回まちがえたら「答えを見る」ボタンを出すか
const MISS_BEFORE_REVEAL = 2;

// 振り返りの模範例（結果画面で「提出」後に表示。1行が1段落）
const MODEL_REFLECTION = [
  '通信できる機器と通信できない機器を比較した。',
  'たとえば、タブレットだけ通信できないときは、有線のPCが使えているので、ルーターやスイッチは正常だと考えた。',
  'そこで、Wi-Fiだけに関係するアクセスポイントの故障だと判断した。'
];


/* =====================================================
   2. ネットワークの形
   ・1つの機器を { … } で書く。
       id        : 機器の名前（半角英数字。他と重ならないように）
       name      : 図に表示する名前
       x, y      : 図の中の位置（図の大きさは 420 × 540）
       parent    : 上流でつながっている機器のid（線は自動で引かれる。一番上は null）
       kind      : 'end' = 端末（PC・スマホなど） / 'infra' = ネットワーク機器
       hub       : 端末だけに書く。「この機器までの経路が無事なら通信できる」という機器のid
       choiceLabel: 選択ボタンに出す名前（省略すると name が出る）
   ===================================================== */

// 学校
const SCHOOL_NET = [
  { id: 'internet', name: 'インターネット',   x: 210, y: 45,  parent: null,       kind: 'infra', choiceLabel: 'インターネット回線' },
  { id: 'router',   name: 'ルーター',         x: 210, y: 150, parent: 'internet', kind: 'infra' },
  { id: 'switch',   name: 'スイッチ',         x: 210, y: 255, parent: 'router',   kind: 'infra' },
  { id: 'pc1',      name: 'PC1',              x: 70,  y: 365, parent: 'switch',   kind: 'end', hub: 'switch' },
  { id: 'pc2',      name: 'PC2',              x: 210, y: 365, parent: 'switch',   kind: 'end', hub: 'switch' },
  { id: 'ap',       name: 'アクセスポイント', x: 350, y: 365, parent: 'switch',   kind: 'infra' },
  { id: 'tablet',   name: 'タブレット',       x: 350, y: 485, parent: 'ap',       kind: 'end', hub: 'switch' }
];

// 家庭（Wi-Fiルーターが、ルーター・スイッチ・アクセスポイントの役割をまとめて持っている）
const HOME_NET = [
  { id: 'internet', name: 'インターネット', x: 210, y: 50,  parent: null,       kind: 'infra', choiceLabel: 'インターネット回線' },
  { id: 'router',   name: 'Wi-Fiルーター',  x: 210, y: 190, parent: 'internet', kind: 'infra' },
  { id: 'pc',       name: 'パソコン(有線)', x: 70,  y: 340, parent: 'router',   kind: 'end', hub: 'router', choiceLabel: 'パソコン' },
  { id: 'phone',    name: 'スマホ(Wi-Fi)',  x: 210, y: 340, parent: 'router',   kind: 'end', hub: 'router', choiceLabel: 'スマホ' },
  { id: 'printer',  name: 'プリンター',     x: 350, y: 340, parent: 'router',   kind: 'end', hub: 'router' }
];

// 部活動の会場（他校の体育館など。会場のルーターとアクセスポイントを借りる）
const CLUB_NET = [
  { id: 'internet', name: 'インターネット',   x: 210, y: 45,  parent: null,       kind: 'infra', choiceLabel: 'インターネット回線' },
  { id: 'router',   name: 'ルーター',         x: 210, y: 150, parent: 'internet', kind: 'infra' },
  { id: 'ap',       name: 'アクセスポイント', x: 210, y: 255, parent: 'router',   kind: 'infra' },
  { id: 'tablet',   name: 'タブレット',       x: 70,  y: 365, parent: 'ap',       kind: 'end', hub: 'ap' },
  { id: 'phone',    name: '顧問のスマホ',     x: 210, y: 365, parent: 'ap',       kind: 'end', hub: 'ap' },
  { id: 'laptop',   name: 'ノートPC',         x: 350, y: 365, parent: 'ap',       kind: 'end', hub: 'ap' }
];

// 外出先（テーマパークなど。スマホは「基地局」か「園内Wi-Fi」のどちらかでつながる）
const OUTING_NET = [
  { id: 'internet', name: 'インターネット',   x: 210, y: 45,  parent: null,       kind: 'infra', choiceLabel: 'インターネット回線' },
  { id: 'kbase',    name: '基地局',           x: 100, y: 165, parent: 'internet', kind: 'infra' },
  { id: 'phoneA',   name: 'スマホ(モバイル)', x: 100, y: 300, parent: 'kbase',    kind: 'end', hub: 'kbase' },
  { id: 'router',   name: 'ルーター',         x: 320, y: 165, parent: 'internet', kind: 'infra' },
  { id: 'ap',       name: 'アクセスポイント', x: 320, y: 270, parent: 'router',   kind: 'infra' },
  { id: 'phoneB',   name: 'スマホ(Wi-Fi)',    x: 320, y: 380, parent: 'ap',       kind: 'end', hub: 'ap' }
];


/* =====================================================
   3. 問題データ
   ケースを増やすときは、下の {…} を1つコピーして書き換える。

   place       : 場所（画面に表示）
   title       : 問題タイトル
   devices     : 使うネットワークの形（上の SCHOOL_NET など）
   story       : 問題文（1行ずつ配列に入れる）
   observations: 観察結果の表。
                 label = 表の左側の名前 / ok = true(○) か false(×)
                 nodes = 図の中で色をつける機器のid（色をつけない行は [] にする）
   choices     : 選択ボタンに出す機器のid
   answer      : 正解の機器id
   broken      : 正解後に図で故障として表示する機器id（配列）
   hint        : まちがえたときに出す共通のヒント
   wrongHints  : 選んだ機器ごとのヒント
   explanation : 正解後の解説（1行ずつ配列に入れる）
   point       : 学習ポイント
   ===================================================== */
const CASES = [
  {
    place: '学校',
    title: 'ケース1：タブレットだけつながらない',
    devices: SCHOOL_NET,
    story: [
      '職員室のPCはインターネットを利用できる。',
      'しかし授業用タブレットはインターネットに接続できない。'
    ],
    observations: [
      { label: 'PC1',        ok: true,  nodes: ['pc1'] },
      { label: 'PC2',        ok: true,  nodes: ['pc2'] },
      { label: 'タブレット', ok: false, nodes: ['tablet'] }
    ],
    choices: ['router', 'switch', 'ap', 'internet'],
    answer: 'ap',
    broken: ['ap'],
    hint: 'PCは正常に通信できています。故障している機器は、タブレットだけに影響しているようです。',
    wrongHints: {
      router:   'ルーターが壊れると、有線のPCもインターネットに出られなくなるはずです。',
      switch:   'スイッチが壊れると、PC1・PC2も通信できなくなるはずです。',
      internet: '回線が切れると、PCもインターネットを使えなくなるはずです。'
    },
    explanation: [
      'アクセスポイントはWi-Fi接続を提供する機器です。',
      'そのため故障すると、タブレットは通信できません。',
      '一方で有線接続のPCには影響しません。'
    ],
    point: 'アクセスポイントはWi-Fi接続を担当する'
  },
  {
    place: '学校',
    title: 'ケース2：どの端末もつながらない',
    devices: SCHOOL_NET,
    story: [
      'PC1もPC2もタブレットも、通信できない。',
      '校内のPC同士でファイルを共有することもできない。',
      'ただし、ルーターの電源ランプは点灯している。'
    ],
    observations: [
      { label: 'PC1',                 ok: false, nodes: ['pc1'] },
      { label: 'PC2',                 ok: false, nodes: ['pc2'] },
      { label: 'タブレット',           ok: false, nodes: ['tablet'] },
      { label: 'ルーターの電源ランプ', ok: true,  nodes: ['router'] }
    ],
    choices: ['router', 'switch', 'ap', 'internet'],
    answer: 'switch',
    broken: ['switch'],
    hint: '有線のPCも、Wi-Fiのタブレットも通信できません。全員がつながる「中心」の機器を考えてみましょう。',
    wrongHints: {
      router:   'ルーターが壊れても、校内のPC同士の通信はできるはずです。しかもルーターのランプは点灯しています。',
      ap:       'アクセスポイントの故障で困るのはWi-Fiのタブレットだけです。有線のPCまで通信できない理由を説明できません。',
      internet: '回線が切れても、校内のPC同士は通信できるはずです。'
    },
    explanation: [
      'スイッチはLAN内の機器をつなぐ中心の機器です。',
      '故障すると、PC1・PC2・アクセスポイント（タブレット）のすべてが通信できなくなります。'
    ],
    point: 'スイッチはLAN内の通信を支える'
  },
  {
    place: '家庭',
    title: 'ケース3：家じゅうの機器がつながらない',
    devices: HOME_NET,
    story: [
      '自宅で、パソコンもスマホもプリンターも、インターネットにつながらない。',
      'スマホからプリンターに印刷することもできない。',
      'Wi-Fiルーターの電源ランプが消えている。'
    ],
    observations: [
      { label: 'パソコン（有線）',          ok: false, nodes: ['pc'] },
      { label: 'スマホ（Wi-Fi）',           ok: false, nodes: ['phone'] },
      { label: 'プリンター',                ok: false, nodes: ['printer'] },
      { label: 'スマホからプリンターへ印刷', ok: false, nodes: [] }
    ],
    choices: ['router', 'internet', 'pc', 'phone'],
    answer: 'router',
    broken: ['router'],
    hint: 'パソコン・スマホ・プリンターのすべてがつながりません。全部に共通して使っている機器はどれでしょう？',
    wrongHints: {
      internet: '回線が切れても、家の中のスマホからプリンターに印刷することはできるはずです。今は印刷もできません。',
      pc:       'パソコンだけが壊れても、スマホやプリンターまでつながらなくなる理由を説明できません。',
      phone:    'スマホだけが壊れても、有線のパソコンやプリンターがつながらない理由を説明できません。'
    },
    explanation: [
      '家庭のWi-Fiルーターは、ルーター・スイッチ・アクセスポイントの役割を1台でまとめて持っていることが多い機器です。',
      'そのため故障すると、有線のパソコンもWi-Fiのスマホも、家の中の通信もインターネットへの接続も、すべて使えなくなります。'
    ],
    point: '家庭のルーターは、家の中の通信と外への接続の両方を担当する'
  },
  {
    place: '部活動の会場',
    title: 'ケース4：Webサイトだけ見られない',
    devices: CLUB_NET,
    story: [
      '他校の体育館で練習試合。会場のWi-Fiを借りて、タブレットで試合を記録している。',
      'Wi-Fiには接続でき、タブレット・スマホ・PCの間でデータを共有することもできる。',
      'しかしWebサイトは開けない。',
      '会場のルーターは電源ランプが点灯していて、設定画面も開ける。'
    ],
    observations: [
      { label: '会場内の機器どうしのデータ共有',   ok: true,  nodes: ['tablet', 'phone'] },
      { label: 'Wi-Fiへの接続',                    ok: true,  nodes: ['ap'] },
      { label: 'ルーターのランプ・設定画面',        ok: true,  nodes: ['router'] },
      { label: 'Webサイトの閲覧',                  ok: false, nodes: [] }
    ],
    choices: ['router', 'ap', 'internet'],
    answer: 'internet',
    broken: ['internet'],
    hint: '会場の中の通信はできています。会場の機器を1つずつ確かめると、どの機器が動いていると言えるでしょう？',
    wrongHints: {
      router: 'ルーターの電源ランプは点灯し、設定画面も開けます。ルーターは動いていると考えられます。',
      ap:     'Wi-Fiには接続でき、機器どうしのデータ共有もできています。アクセスポイントは動いています。'
    },
    explanation: [
      'インターネット回線は、会場のルーターと外のインターネットをつなぐ道です。',
      'ここが切れると、会場の中（LAN内）の通信はできても、Webサイトには出られません。',
      'ルーターやアクセスポイントが動いていることを確かめられたのが、手がかりでした。'
    ],
    point: 'インターネット回線が切れても、LAN内の通信は続けられる'
  },
  {
    place: '外出先',
    title: 'ケース5：テーマパークでスマホが圏外',
    devices: OUTING_NET,
    story: [
      'テーマパーク（ディズニーランドなど）で遊んでいる。',
      'スマホのモバイル通信では、アプリもWebも使えない。まわりの友だちも同じ状態だ。',
      '一方、園内Wi-Fiにつないだスマホは、ふつうにWebを見られる。'
    ],
    observations: [
      { label: '自分のスマホ（モバイル通信）',       ok: false, nodes: ['phoneA'] },
      { label: 'まわりの人のスマホ（モバイル通信）', ok: false, nodes: [] },
      { label: '園内Wi-Fiにつないだスマホ',          ok: true,  nodes: ['phoneB'] }
    ],
    choices: ['kbase', 'router', 'ap', 'internet'],
    answer: 'kbase',
    broken: ['kbase'],
    hint: 'Wi-Fi経由のスマホは使えて、モバイル通信のスマホだけが使えません。モバイル通信だけが通る場所を考えてみましょう。',
    wrongHints: {
      router:   '園内Wi-Fiのルーターが壊れたら、Wi-Fi経由のスマホも使えなくなるはずです。Wi-Fiは使えています。',
      ap:       'アクセスポイントが壊れたら、Wi-Fiにつながらないはずです。使えないのはモバイル通信のほうです。',
      internet: 'インターネット全体が切れたら、Wi-Fi経由のスマホでもWebを見られないはずです。'
    },
    explanation: [
      'スマホのモバイル通信は、近くの基地局（電波を送受信する設備）を通してインターネットにつながります。',
      '基地局が故障すると、その周辺のスマホは圏外になります。',
      'Wi-Fiは別の経路（ルーターとアクセスポイント）を使うので、影響を受けません。'
    ],
    point: '外出先のモバイル通信は、基地局を経由してつながる'
  }
];


/* =====================================================
   4. 故障の計算
   ===================================================== */

let DEV = {};   // 今のケースの機器を id で引くための辞書（renderCase で作る）

/* 自分から上流へたどって、途中に故障機器がないか調べる。
   stopId まで（stopIdも含む）調べる。stopId が無ければ一番上まで調べる。 */
function pathClear(id, stopId, broken) {
  let cur = id;
  while (cur) {
    if (broken.includes(cur)) return false;
    if (cur === stopId) return true;
    cur = DEV[cur].parent;
  }
  return true;
}

/* 故障している機器のリスト broken から、図の色を計算する。
   戻り値：
     nodeStatus … 機器ごとの 'ok' / 'ng'
     edgeStatus … 通信線ごとの 'ok' / 'ng'（キーは線の下側の機器id） */
function simulate(devices, broken) {
  const nodeStatus = {};
  const edgeStatus = {};

  devices.forEach(function (d) {
    // 端末は、hub（中心の機器）までの経路が切れていたら「通信できない」
    const linkOk = d.kind === 'end' ? pathClear(d.id, d.hub, broken) : true;

    nodeStatus[d.id] = (broken.includes(d.id) || !linkOk) ? 'ng' : 'ok';

    if (d.parent) {
      const bad = broken.includes(d.id) || broken.includes(d.parent) || !linkOk;
      edgeStatus[d.id] = bad ? 'ng' : 'ok';
    }
  });

  return { nodeStatus: nodeStatus, edgeStatus: edgeStatus };
}


/* =====================================================
   5. ネットワーク図の描画（SVGをJavaScriptで作る）
   ===================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_W = 124;   // 機器カードの幅
const NODE_H = 54;    // 機器カードの高さ
let nodeEls = {};     // 機器id → <g>要素
let edgeEls = {};     // 機器id → <line>要素
let statusEls = {};   // 機器id → 状態表示の<text>要素

// 状態に応じて、カードに書く文字（色だけに頼らないため）
const LABEL_INFRA = { ok: '正常', ng: '故障', unknown: '未確認' };
const LABEL_END   = { ok: '通信できる', ng: '通信できない', unknown: '未確認' };

function svgEl(name, attrs) {
  const e = document.createElementNS(SVG_NS, name);
  Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  return e;
}

// 図を作る（ケースが変わるたびに作り直す）
function buildDiagram(devices) {
  nodeEls = {}; edgeEls = {}; statusEls = {};
  const svg = svgEl('svg', { viewBox: '0 0 420 540', role: 'img', 'aria-label': 'ネットワーク図' });

  // 通信線（先に描いてカードの後ろに回す）
  devices.forEach(function (d) {
    if (!d.parent) return;
    const p = DEV[d.parent];
    const line = svgEl('line', {
      x1: p.x, y1: p.y + NODE_H / 2,
      x2: d.x, y2: d.y - NODE_H / 2,
      'class': 'edge unknown'
    });
    svg.appendChild(line);
    edgeEls[d.id] = line;
  });

  // 機器カード
  devices.forEach(function (d) {
    const g = svgEl('g', { 'class': 'node unknown' });
    g.appendChild(svgEl('rect', {
      x: d.x - NODE_W / 2, y: d.y - NODE_H / 2,
      width: NODE_W, height: NODE_H, rx: 12
    }));
    const name = svgEl('text', { x: d.x, y: d.y - 4, 'class': 'node-name' });
    name.textContent = d.name;
    const st = svgEl('text', { x: d.x, y: d.y + 15, 'class': 'node-status' });
    g.appendChild(name);
    g.appendChild(st);
    svg.appendChild(g);
    nodeEls[d.id] = g;
    statusEls[d.id] = st;
  });

  const wrap = document.getElementById('diagram-wrap');
  wrap.textContent = '';
  wrap.appendChild(svg);
}

/* 図に色をつける。
   nodeStatus / edgeStatus : { 機器id: 'ok' | 'ng' }（無い機器は 'unknown'＝灰色）
   selectedId : 選択中の機器id（なければ null） */
function paintDiagram(nodeStatus, edgeStatus, selectedId) {
  state.devices.forEach(function (d) {
    const s = nodeStatus[d.id] || 'unknown';
    const labels = d.kind === 'end' ? LABEL_END : LABEL_INFRA;
    nodeEls[d.id].setAttribute('class', 'node ' + s + (d.id === selectedId ? ' selected' : ''));
    statusEls[d.id].textContent = labels[s];
    if (d.parent) {
      edgeEls[d.id].setAttribute('class', 'edge ' + (edgeStatus[d.id] || 'unknown'));
    }
  });
}

// 故障機器 broken を反映した図を表示する（[] なら全部正常）
function paintScenario(broken) {
  const r = simulate(state.devices, broken);
  paintDiagram(r.nodeStatus, r.edgeStatus, null);
}

// 問題を解いている最中の図（観察できた端末だけ色がつき、他は灰色）
function paintQuestion() {
  const c = CASES[state.caseIndex];
  const nodeStatus = {};
  c.observations.forEach(function (o) {
    o.nodes.forEach(function (id) { nodeStatus[id] = o.ok ? 'ok' : 'ng'; });
  });
  paintDiagram(nodeStatus, {}, state.selected);
}


/* =====================================================
   6. 問題画面の処理
   ===================================================== */

// アプリ全体の状態
const state = {
  caseIndex: 0,      // 今のケース番号（0始まり）
  devices: [],       // 今のケースの機器一覧
  selected: null,    // 選んでいる機器id
  attempts: 0,       // 今のケースで診断した回数
  solved: false,     // 今のケースが終わったか
  results: []        // ケースごとの結果 { place, title, firstTry }
};

const $ = function (id) { return document.getElementById(id); };

// 要素を作る小さな道具（textContentを使うので、問題文に < > があっても安全）
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// 右エリアの表示を切り替える（'game' か 'result'）
function showView(name) {
  $('view-game').hidden = name !== 'game';
  $('view-result').hidden = name !== 'result';
}

// ケースを画面に表示する
function renderCase() {
  const c = CASES[state.caseIndex];
  state.devices = c.devices;
  state.selected = null;
  state.attempts = 0;
  state.solved = false;

  DEV = {};
  c.devices.forEach(function (d) { DEV[d.id] = d; });
  buildDiagram(c.devices);

  $('diagram-title').textContent = 'ネットワーク図（' + c.place + '）';
  $('case-progress').textContent = 'ケース ' + (state.caseIndex + 1) + ' / ' + CASES.length + '　場所：' + c.place;
  $('case-title').textContent = c.title;

  const story = $('story');
  story.textContent = '';
  c.story.forEach(function (line) { story.appendChild(el('p', '', line)); });

  const body = $('obs-body');
  body.textContent = '';
  c.observations.forEach(function (o) {
    const tr = el('tr');
    tr.appendChild(el('td', '', o.label));
    tr.appendChild(el('td', 'mark ' + (o.ok ? 'ok' : 'ng'), o.ok ? '○' : '×'));
    body.appendChild(tr);
  });

  // 選択ボタンを、このケースの候補で作り直す
  const box = $('choices');
  box.textContent = '';
  c.choices.forEach(function (id) {
    const d = DEV[id];
    const b = el('button', 'choice-btn', d.choiceLabel || d.name);
    b.type = 'button';
    b.dataset.id = id;
    b.addEventListener('click', function () { onChoose(id); });
    box.appendChild(b);
  });

  $('feedback').hidden = true;
  $('next-btn').hidden = true;
  $('reveal-btn').hidden = true;
  $('diagnose-btn').hidden = false;
  updateChoiceButtons();
  paintQuestion();
  window.scrollTo(0, 0);
}

// 選択ボタンの見た目と「診断する」の有効・無効を更新
function updateChoiceButtons() {
  document.querySelectorAll('.choice-btn').forEach(function (b) {
    b.classList.toggle('selected', b.dataset.id === state.selected);
    b.disabled = state.solved;
  });
  $('diagnose-btn').disabled = state.solved || !state.selected;
}

// 機器を選んだとき
function onChoose(id) {
  if (state.solved) return;
  state.selected = id;
  updateChoiceButtons();
  paintQuestion();   // 選んだ機器に枠をつける
}

// 判定メッセージを表示する
function showFeedback(kind, title, paragraphs, point, think) {
  const fb = $('feedback');
  fb.textContent = '';
  fb.className = 'feedback ' + kind;
  fb.appendChild(el('h3', '', title));
  paragraphs.forEach(function (t) { fb.appendChild(el('p', '', t)); });
  if (point) fb.appendChild(el('p', 'point', '学習ポイント：' + point));
  if (think) fb.appendChild(el('p', 'think', think));
  fb.hidden = false;
}

// 「診断する」を押したとき
function onDiagnose() {
  if (!state.selected || state.solved) return;
  const c = CASES[state.caseIndex];
  const chosen = DEV[state.selected];
  state.attempts += 1;

  if (state.selected === c.answer) {
    // ---- 正解 ----
    finishCase(false);
    showFeedback('ok', '正解！',
      [(chosen.choiceLabel || chosen.name) + 'が故障しています。'].concat(c.explanation),
      c.point,
      '考えてみよう：観察結果のどこを比べて、この機器だと判断できた？　隣の人に説明してみよう。');
  } else {
    // ---- 不正解 ----
    const hints = [];
    if (c.wrongHints[state.selected]) hints.push(c.wrongHints[state.selected]);
    hints.push(c.hint);
    showFeedback('ng', 'もう一度考えてみましょう', hints, null,
      '考えてみよう：「通信できる機器」と「通信できない機器」の違いはどこにある？');
    if (state.attempts >= MISS_BEFORE_REVEAL) $('reveal-btn').hidden = false;
  }
}

// 「答えを見る」を押したとき（この場合は不正解扱い）
function onReveal() {
  const c = CASES[state.caseIndex];
  const ans = DEV[c.answer];
  finishCase(true);
  showFeedback('ok', '答えは「' + (ans.choiceLabel || ans.name) + '」です',
    c.explanation, c.point,
    '考えてみよう：どの観察結果に注目すれば、この答えにたどりつけたかな？');
}

// ケースを終える共通処理（revealed = 答えを見た場合 true）
function finishCase(revealed) {
  const c = CASES[state.caseIndex];
  state.solved = true;
  state.results.push({ place: c.place, title: c.title, firstTry: !revealed && state.attempts === 1 });

  paintScenario(c.broken);   // 故障機器と影響を受ける通信線を赤くする
  updateChoiceButtons();
  $('diagnose-btn').hidden = true;
  $('reveal-btn').hidden = true;

  const isLast = state.caseIndex === CASES.length - 1;
  $('next-btn').textContent = isLast ? '結果を見る' : '次のケースへ';
  $('next-btn').hidden = false;
}

// 「次のケースへ」を押したとき
function onNext() {
  if (state.caseIndex < CASES.length - 1) {
    state.caseIndex += 1;
    renderCase();
  } else {
    showResult();
  }
}


/* =====================================================
   7. 結果画面・振り返りの処理
   ===================================================== */

function showResult() {
  const total = state.results.length;
  const correct = state.results.filter(function (r) { return r.firstTry; }).length;
  const rate = total === 0 ? 0 : Math.round(correct / total * 100);

  $('res-summary').textContent = total + '問中' + correct + '問正解';
  $('res-rate').textContent = '正答率 ' + rate + '%（挑戦した問題数：' + total + '問）';

  const list = $('res-list');
  list.textContent = '';
  state.results.forEach(function (r) {
    list.appendChild(el('li', '', '【' + r.place + '】' + r.title + '　' +
      (r.firstTry ? '○ 最初の回答で正解' : '△ 何度か考えて解決')));
  });

  // 振り返り欄を初期状態に戻す
  const ta = $('reflection');
  ta.value = '';
  ta.disabled = false;
  $('model-box').hidden = true;
  $('restart-btn').hidden = true;
  $('submit-btn').hidden = false;
  updateCharCount();

  showView('result');
  paintScenario([]);   // 図は「全正常」の状態にしておく
  window.scrollTo(0, 0);
}

// 文字数の表示と、提出ボタンの有効・無効
function updateCharCount() {
  const len = $('reflection').value.length;
  $('char-count').textContent = len + ' / ' + REFLECTION_MAX + '文字（' + REFLECTION_MIN + '文字以上で提出できます）';
  $('submit-btn').disabled = len < REFLECTION_MIN;
}

// 「提出」を押したとき：模範例を表示
function onSubmit() {
  $('reflection').disabled = true;
  $('submit-btn').hidden = true;

  const box = $('model-text');
  box.textContent = '';
  MODEL_REFLECTION.forEach(function (line) { box.appendChild(el('p', '', line)); });
  $('model-box').hidden = false;
  $('restart-btn').hidden = false;
}

// 「もう一度挑戦する」
function onRestart() {
  state.caseIndex = 0;
  state.results = [];
  showView('game');
  renderCase();
}


/* =====================================================
   8. 起動処理
   ===================================================== */

function init() {
  $('diagnose-btn').addEventListener('click', onDiagnose);
  $('reveal-btn').addEventListener('click', onReveal);
  $('next-btn').addEventListener('click', onNext);
  $('reflection').maxLength = REFLECTION_MAX;
  $('reflection').addEventListener('input', updateCharCount);
  $('submit-btn').addEventListener('click', onSubmit);
  $('restart-btn').addEventListener('click', onRestart);

  renderCase();
}

document.addEventListener('DOMContentLoaded', init);
