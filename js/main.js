// ===== 画面・操作 =====
import * as G from './game.js';
import {
  STATS, STAT_NAMES, STAT_SHORT, TYPES, MISSIONS, SONGS, FAIL_MULT, VOTES, CARDS, ACTION_TYPES, TARGETED,
  TRAITS, HAPPS, FLAGS, TEAM_SIZE,
} from './cards.js';
import * as Store from './store.js';

const app = document.getElementById('app');
const store = (k, area = localStorage) => ({
  get() { try { return area.getItem(k); } catch { return null; } },
  set(v) { try { area.setItem(k, v); } catch { /* 無視 */ } },
  del() { try { area.removeItem(k); } catch { /* 無視 */ } },
});
const pidStore = store('dm_pid', sessionStorage);
const roomStore = store('dm_room', sessionStorage);
const nameStore = store('dm_name');
const savedCustomStore = store('dm_my_customs4');

let pid = pidStore.get() || ('p' + Math.random().toString(36).slice(2, 10));
pidStore.set(pid);

let S = null;
let roomId = null;
let unsub = null;
const ui = {
  form: { name: nameStore.get() || '', room: new URLSearchParams(location.search).get('room') || '' },
  sheet: null,
  tab: 'train',        // 手札タブ：train / act
  songSel: null,       // 選曲中の候補
  closedResult: 0,
  busy: false,
};
const seen = new Set();
const enter = key => (seen.has(key) ? '' : (seen.add(key), ' enter'));
const isNew = key => (seen.has(key) ? '' : (seen.add(key), ' new'));

// ---------- ユーティリティ ----------
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hue = str => { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
const avatar = (name, cls = '') => `<span class="avatar ${cls}" style="--h:${hue(name)}">${esc([...String(name)][0] || '?')}</span>`;
const me = () => S && S.players.find(p => p.id === pid);
const stars = d => '★'.repeat(d) + '☆'.repeat(3 - d);
const sv = v => (v > 0 ? `+${v}` : `${v}`);
const pname = id => (id === pid ? 'あなた' : esc(G.getP(S, id)?.name || ''));

function toast(msg, type = '') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 3200 : 1800);
}

async function act(fn) {
  if (!roomId) return null;
  const r = await Store.transact(roomId, st => {
    if (!st) throw new Error('部屋が見つかりません');
    return fn(st);
  });
  if (r.error) toast(r.error, 'err');
  return r;
}

// ---------- 部品 ----------
function statBar(k, v, max, need = 0) {
  const needMark = need ? `<span class="need" style="left:${Math.min(100, need / max * 100)}%"></span>` : '';
  return `<div class="sbar ${k} ${need && v < need ? 'short' : ''}"><span class="lb">${STAT_NAMES[k]}</span><span class="bar"><i style="width:${Math.min(100, v / max * 100)}%"></i>${needMark}</span><b>${v}</b></div>`;
}

function weightChips(so) {
  const mk = G.mainStat(so);
  return STATS.filter(k => so.w[k]).map(k => `<span class="w ${k}${k === mk ? ' main' : ''}">${STAT_NAMES[k]}×${so.w[k]}</span>`).join('');
}

// メンバーカード（特徴の利点・デメリット付き）
function memberCard(d, o = {}) {
  const tr = TRAITS[d.trait] || TRAITS.leader;
  const attrs = o.act ? `data-act="${o.act}" data-cid="${d.id}"` : '';
  const Tag = o.act ? 'button' : 'div';
  const flag = d.country ? `<span class="flag">${FLAGS[d.country] || '🌏'}</span>` : '';
  return `<${Tag} class="mcard${o.cls || ''}" ${attrs}>
    <div class="mc-hd">${avatar(d.name)}<span class="nm">${esc(d.name)}</span>${flag}</div>
    <div class="mc-st">${STATS.map(k => `<span class="${k}">${STAT_SHORT[k]}<b>${d[k]}</b></span>`).join('')}</div>
    <div class="mc-tr">${esc(tr.name)}</div>
    <div class="mc-pm"><span class="p">＋${esc(tr.plus)}</span><span class="m">－${esc(tr.minus)}</span></div>
    ${o.foot || ''}
  </${Tag}>`;
}
function mateFoot(cid) {
  const e = G.mateEval(S, cid);
  const total = e.v + e.team;
  return `<div class="mc-ft">この曲で <b>${total}</b>点${e.votes ? ` ＋${e.votes}万票` : ''}${e.risk ? `<small>⚠${esc(e.risk)}</small>` : ''}</div>`;
}

function cardView(c, o = {}) {
  const attrs = o.act ? `data-act="${o.act}" data-cid="${c.id}"` : '';
  const Tag = o.act ? 'button' : 'div';
  const label = c.cat === 'train' ? '練習' : ACTION_TYPES[c.type];
  const cls = c.cat === 'train' ? 'train' : `act-${c.type}`;
  return `<${Tag} class="kcard ${cls}${o.cls || ''}" ${attrs}>
    <span class="ty">${label}</span>
    <div class="ico">${c.icon}</div>
    <div class="nm">${esc(c.name)}</div>
    <div class="ef">${esc(c.eff)}</div>
  </${Tag}>`;
}

function songCard(id, o = {}) {
  const so = SONGS[id];
  const mk = G.mainStat(so);
  const need = G.needOf(so);
  return `<button class="song ${o.sel ? 'sel' : ''}" ${o.act ? `data-act="${o.act}" data-v="${id}"` : ''}>
    <div class="song-top"><span>${esc(so.genre)}</span><span class="diff d${so.diff}">${stars(so.diff)}</span></div>
    <div class="song-nm">♪ ${esc(so.name)}</div>
    <div class="wrow">${weightChips(so)}</div>
    <div class="song-need ${need ? '' : 'ok'}">${need ? `${STAT_NAMES[mk]}${need}未満はミス` : '初心者向け'}</div>
    ${o.foot || ''}
  </button>`;
}

// ---------- 描画 ----------
function render() {
  const keep = {};
  app.querySelectorAll('[data-keep]').forEach(el => { keep[el.dataset.keep] = [el.scrollLeft, el.scrollTop]; });
  let html;
  if (!roomId || !S) html = viewEntry();
  else if (S.status === 'lobby') html = viewLobby();
  else html = viewGame();
  app.innerHTML = html + viewOverlays();
  app.querySelectorAll('[data-keep]').forEach(el => {
    const k = keep[el.dataset.keep];
    if (k) { el.scrollLeft = k[0]; el.scrollTop = k[1]; }
  });
}

// ===== 入室画面 =====
function viewEntry() {
  return `<div class="entry">
    <div class="logo">
      <div class="logo-sub">サバイバルオーディション</div>
      <h1>デビューまで<br><span>あと1ステージ</span></h1>
      <div class="logo-stars">★ ★ ★</div>
      <p class="hint">練習生になって、ライバルと同じ課題曲で勝負。<br>5つの課題で一番票を集めた人がデビュー！</p>
    </div>
    <div class="panel">
      <label for="in-name">あなたの名前</label>
      <input id="in-name" class="field" data-bind="name" maxlength="10" placeholder="例：くりす" value="${esc(ui.form.name)}" autocomplete="off">
      <label for="in-room">ルームID</label>
      <div class="row">
        <input id="in-room" class="field" data-bind="room" maxlength="12" placeholder="例：K7Q2" value="${esc(ui.form.room)}" autocomplete="off" autocapitalize="characters">
        <button class="btn" data-act="genRoom">🎲 作成</button>
      </div>
      <p class="hint">同じルームIDを入力した人同士で対戦します（2〜4人）。部屋がなければ新しく作られます。</p>
      <button class="btn primary big" data-act="enter" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '接続中…' : '番組に参加する'}</button>
    </div>
    <button class="btn link" data-act="rules">📖 遊び方を見る</button>
    <div class="mode-badge ${Store.isOnline ? '' : 'local'}">
      ${Store.isOnline ? '<b>● オンライン</b>（Firebase接続中）' : '<b>● ローカルテストモード</b><br>同じブラウザの別タブ同士でのみ遊べます'}
    </div>
  </div>`;
}

// ===== 待機室 =====
function viewLobby() {
  const host = G.isHost(S, pid);
  const my = me();
  const n = S.players.length;
  const list = S.players.map(p => {
    const t = TYPES[p.type];
    return `<div class="pitem">${avatar(p.name)}<span class="nm">${esc(p.name)}<small>${t.icon} ${t.name}</small></span>
      ${p.id === S.hostId ? '<span class="tag">👑 ホスト</span>' : ''}${p.id === pid ? '<span class="tag me">あなた</span>' : ''}</div>`;
  }).join('');
  const types = Object.values(TYPES).map(t => `<button class="type-opt ${my.type === t.id ? 'sel' : ''}" data-act="setType" data-v="${t.id}">
      <span class="ti">${t.icon}</span><b>${t.name}</b>
      <span class="ts">${STATS.map(k => `${STAT_SHORT[k]}${t.st[k]}`).join(' ')}</span></button>`).join('');
  const customs = (S.custom || []).map(c => `<div class="custom-item">${memberCard(c)}${(c.owner === pid || host) ? `<button class="del-x" data-act="delCustom" data-id="${c.id}" aria-label="削除">✕</button>` : ''}</div>`).join('');
  const saved = savedCustoms().filter(sc => !(S.custom || []).some(c => c.name === sc.name));
  return `<div class="lobby">
    <div class="topbar"><button class="icon-btn" data-act="leave" aria-label="退出">←</button><div class="title">待機室</div><button class="icon-btn" data-act="rules" aria-label="遊び方">📖</button></div>
    <div class="room-card"><div class="lbl">ルームID</div><div class="room-id">${esc(roomId)}</div>
      <button class="btn small" data-act="share">🔗 招待リンクを送る</button></div>
    <section><h3>参加者 <small>${n}/4人</small></h3><div class="plist">${list}</div>
      ${n < 2 ? '<p class="hint" style="margin-top:8px">招待リンクを送って、友だちを呼びましょう（2人から遊べます）。</p>' : ''}</section>
    <section><h3>あなたのタイプ <small>最初の能力が決まります</small></h3><div class="type-grid">${types}</div></section>
    <section><h3>オリジナル練習生 <small>ステージメンバーの候補に登場</small></h3>
      ${customs ? `<div class="m-grid two">${customs}</div>` : ''}
      <button class="btn small" data-act="openCustom">＋ 練習生を作る</button>
      ${saved.length ? `<div class="saved-chips">${saved.map((c, i) => `<button class="chip" data-act="addSaved" data-i="${i}">＋ ${esc(c.name)}</button>`).join('')}</div>` : ''}
    </section>
    <div class="bottom-bar">${host
      ? `<button class="btn primary big" data-act="start" ${n < 2 ? 'disabled' : ''}>${n < 2 ? 'あと1人以上必要です' : `${n}人で番組スタート！`}</button>`
      : '<div class="waiting">ホストの開始を待っています<span class="dots"></span></div>'}</div>
  </div>`;
}
function savedCustoms() { try { return JSON.parse(savedCustomStore.get() || '[]'); } catch { return []; } }

// ===== ゲーム =====
function playerState(p) {
  if (S.phase === 'song') return S.songPick.by === p.id ? '<span class="pst on">選曲中</span>' : '';
  if (S.phase === 'draft') return G.drafter(S) === p.id ? '<span class="pst on">指名中</span>' : `<span class="pst">${p.r.mates.length}/${TEAM_SIZE}人</span>`;
  if (S.phase === 'practice') return p.r.ready ? '<span class="pst ok">準備OK</span>' : '<span class="pst">練習中</span>';
  if (S.phase === 'result') return S.ready[p.id] ? '<span class="pst ok">OK</span>' : '';
  return '';
}

function scoreboard() {
  const sorted = [...S.players].sort((a, b) => a.rank - b.rank || b.votes - a.votes);
  const max = Math.max(1, ...sorted.map(p => p.votes));
  return `<div class="board">${sorted.map(p => `<button class="brow ${p.id === pid ? 'me' : ''}" data-act="viewPlayer" data-id="${p.id}">
      <span class="brk r${p.rank}">${p.rank}</span>${avatar(p.name)}
      <span class="bnm">${esc(p.name)}${p.id === pid ? '<small>あなた</small>' : ''}</span>
      <span class="bvbar"><i style="width:${p.votes / max * 100}%"></i></span>
      <span class="bv">${p.votes}<small>万票</small></span>${playerState(p)}
    </button>`).join('')}</div>`;
}

function songPanel() {
  const so = G.curSong(S);
  return `<div class="songp${enter('song:' + S.mission)}">
    <div class="songp-k">今回の課題曲 <span class="diff d${so.diff}">${stars(so.diff)}</span></div>
    <div class="songp-nm">♪ ${esc(so.name)}</div>
    <div class="wrow">${weightChips(so)}</div>
  </div>`;
}

function viewGame() {
  const my = me();
  if (!my) return '<div class="waiting">観戦できません</div>';
  const M = G.mission(S);
  const progress = MISSIONS.map(m => `<i class="${m.n < S.mission ? 'done' : m.n === S.mission ? 'now' : ''}"></i>`).join('');
  const host = G.isHost(S, pid);
  let main = '';
  let dock = '';

  if (S.phase === 'song') {
    const mine = S.songPick.by === pid;
    const by = G.getP(S, S.songPick.by);
    const cards = S.songPick.choices.map(id => {
      const so = SONGS[id];
      const est = Math.round(STATS.reduce((t, k) => t + so.w[k] * my.st[k], 0));
      return songCard(id, { act: mine ? 'pickSong' : '', sel: ui.songSel === id, foot: `<div class="song-ft">今のあなたなら <b>${est}</b>点</div>` });
    }).join('');
    main = `<div class="banner ${mine ? 'mine' : ''}">${mine ? '🎲 あなたが選曲担当！ 自分に有利な曲を選ぼう' : `⏳ ${esc(by.name)} が課題曲を選んでいます<span class="dots"></span>`}</div>
      <h3 class="sec">課題曲の候補 <small>全員がこの中の1曲で勝負します</small></h3>
      <div class="songs">${cards}</div>`;
    dock = `<div class="dock slim"><div class="actions">${mine
      ? `<span class="msg">${ui.songSel ? `「${esc(SONGS[ui.songSel].name)}」` : '曲をタップして選んでください'}</span><button class="btn primary" data-act="confirmSong" ${ui.songSel ? '' : 'disabled'}>この曲に決定</button>`
      : `<span class="msg">選曲を待っています…</span>${host ? '<button class="btn small" data-act="force">代わりに決める</button>' : ''}`}</div></div>`;
  } else if (S.phase === 'draft') {
    const d = S.draft;
    const myTurn = G.drafter(S) === pid;
    const who = G.getP(S, G.drafter(S));
    const teams = S.players.map(p => `<div class="tslot ${p.id === pid ? 'me' : ''}"><span class="tn">${p.id === pid ? 'あなた' : esc(p.name)}</span>
      ${Array.from({ length: TEAM_SIZE }, (_, i) => { const c = p.r.mates[i]; return c ? `<span class="tm">${avatar(G.npcDef(S, c).name)}${esc(G.npcDef(S, c).name)}</span>` : '<span class="tm empty">空き</span>'; }).join('')}</div>`).join('');
    const pool = d.pool.filter(c => !d.taken[c]).map(cid => memberCard(G.npcDef(S, cid), {
      act: myTurn ? 'openMember' : 'viewMember', foot: mateFoot(cid), cls: (myTurn ? ' pickable' : '') + isNew('pool:' + S.mission + cid),
    })).join('');
    main = `${songPanel()}
      <div class="banner ${myTurn ? 'mine' : ''}">${myTurn ? '👉 あなたの指名の番！ メンバーをタップして「自分のチームへ」か「ライバルに押し付け」' : `⏳ ${esc(who.name)} が指名中<span class="dots"></span>`}</div>
      <h3 class="sec">各チームの状況</h3><div class="teams">${teams}</div>
      <h3 class="sec">メンバー候補 <small>＋は利点、－はデメリット</small></h3>
      <div class="m-grid">${pool}</div>`;
    dock = `<div class="dock slim"><div class="actions"><span class="msg">指名順：${d.order.map(id => (id === G.drafter(S) ? `<b>${pname(id)}</b>` : pname(id))).join(' → ')}（くり返し）</span>${host && !myTurn ? '<button class="btn small" data-act="force">飛ばす</button>' : ''}</div></div>`;
  } else {
    const r = my.r;
    const so = G.curSong(S);
    const need = G.needOf(so);
    const mk = G.mainStat(so);
    const pr = G.predict(S, my);
    const max = Math.max(14, ...STATS.map(k => my.st[k]));
    const mates = r.mates.map(cid => memberCard(G.npcDef(S, cid), { foot: mateFoot(cid), cls: isNew('mate:' + S.mission + cid) })).join('');
    const practice = S.phase === 'practice';
    const setSlots = practice ? Array.from({ length: G.ACTION_SETS }, (_, i) => {
      const x = r.set[i];
      if (!x) return '<div class="aslot empty">アクション未セット</div>';
      const c = CARDS[x.cid];
      return `<div class="aslot act-${c.type}">${c.icon} <b>${esc(c.name)}</b>${x.opp ? `<small>→ ${pname(x.opp)}</small>` : ''}${r.ready ? '' : `<button data-act="unset" data-i="${i}" aria-label="外す">✕</button>`}</div>`;
    }).join('') : '';
    main = `${songPanel()}
      <div class="mepanel">
        <div class="me-hd"><span>あなたの能力</span>${pr.fail ? `<span class="warn-chip">⚠ ${STAT_NAMES[mk]}${need}未満でミスしそう</span>` : need ? '<span class="ok-chip">✓ ミスなし</span>' : ''}</div>
        ${STATS.map(k => statBar(k, my.st[k], max, k === mk ? need : 0)).join('')}
        <div class="pred"><div><small>予想ステージ点</small><b>${pr.total}</b></div>
          <div class="pred-break">自分 ${pr.score}${pr.fail ? `（ミス×${FAIL_MULT}）` : ''}<br>＋ メンバー ${pr.team}<br><small>※アクションと本番ハプニングで変わります</small></div></div>
      </div>
      ${practice ? `<h3 class="sec">セットしたアクション <small>本番まで相手には見えません</small></h3><div class="aslots">${setSlots}</div>` : ''}
      <h3 class="sec">あなたのステージメンバー</h3><div class="m-grid two">${mates}</div>`;
    if (practice) {
      const trainLeft = G.TRAIN_USES - r.used;
      const actLeft = G.ACTION_SETS - r.set.length;
      const list = ui.tab === 'train' ? my.train : my.act;
      const can = !r.ready && (ui.tab === 'train' ? trainLeft > 0 : actLeft > 0);
      const hand = list.map(cid => cardView(CARDS[cid], { act: 'openCard', cls: isNew('hand:' + cid) + (can ? '' : ' off') })).join('') || '<div class="empty">カードがありません</div>';
      dock = `<div class="dock">
        <div class="tabs">
          <button class="tab ${ui.tab === 'train' ? 'on' : ''}" data-act="tab" data-v="train">💪 練習カード<small>あと${trainLeft}枚使える</small></button>
          <button class="tab ${ui.tab === 'act' ? 'on' : ''}" data-act="tab" data-v="act">🃏 アクション<small>あと${actLeft}枚セットできる</small></button>
        </div>
        <div class="hand" data-keep="hand-${ui.tab}">${hand}</div>
        <div class="actions">${r.ready
          ? `<span class="msg">ライバルを待っています<span class="dots"></span></span>${host ? '<button class="btn small" data-act="force">全員待たずに開始</button>' : ''}<button class="btn small" data-act="cancelReady">取り消す</button>`
          : '<span class="msg">練習とアクションが終わったら本番へ</span><button class="btn primary" data-act="ready">準備完了 🎤</button>'}</div>
      </div>`;
    } else {
      dock = `<div class="dock slim"><div class="actions"><span class="msg"></span><button class="btn ${S.status === 'ended' ? 'gold' : 'primary'}" data-act="openResult">${S.status === 'ended' ? '最終結果を見る' : '結果を見る'}</button></div></div>`;
    }
  }

  return `<div class="game">
    <div class="g-head">
      <div class="mtitle"><small>第${S.mission}課題（全${MISSIONS.length}課題）${M.mult > 1 ? `・<b>得票${M.mult}倍！</b>` : ''}</small><b>${M.icon} ${esc(M.name)}</b><span class="prog">${progress}</span></div>
      <button class="icon-btn" data-act="menu" aria-label="メニュー">☰</button>
    </div>
    <main class="g-main" data-keep="main">${scoreboard()}${main}</main>
    ${dock}
  </div>`;
}

// ===== オーバーレイ =====
function viewOverlays() {
  let html = '';
  if (S && S.status !== 'lobby' && me()) {
    if (S.phase === 'result' && ui.closedResult !== S.results.mission) html += viewResult();
    if (S.status === 'ended' && ui.closedResult !== 'end') html += viewEnd();
  }
  if (ui.sheet) {
    const body = sheetBody();
    if (body) html += `<div class="overlay${enter('ov:' + ui.sheet.key)}" data-act="closeSheet"></div><div class="sheet${enter('sh:' + ui.sheet.key)}" data-keep="sheet"><div class="grip"></div>${body}</div>`;
  }
  return html;
}

function openSheet(type, extra = {}) {
  ui.sheet = { type, key: type + ':' + Date.now(), prm: {}, ...extra };
  render();
}
function closeSheet() { ui.sheet = null; render(); }
const closeBtn = '<div class="sheet-actions"><button class="btn wide" data-act="closeSheet">閉じる</button></div>';

function sheetBody() {
  const sh = ui.sheet;
  switch (sh.type) {
    case 'card': return sheetCard(sh);
    case 'member': {
      const d = G.npcDef(S, sh.cid);
      if (!d) return null;
      const canPick = sh.pick && S.phase === 'draft' && G.drafter(S) === pid && !S.draft.taken[sh.cid];
      const my = me();
      const btns = canPick ? `
        <button class="btn primary big" data-act="pickTo" data-to="${pid}" ${G.hasSlot(my) ? '' : 'disabled'}>${G.hasSlot(my) ? '自分のチームに入れる' : '自分のチームは満員'}</button>
        ${S.players.filter(p => p.id !== pid).map(p => `<button class="btn push" data-act="pickTo" data-to="${p.id}" ${G.hasSlot(p) ? '' : 'disabled'}>😈 ${esc(p.name)} に押し付ける${G.hasSlot(p) ? '' : '（満員）'}</button>`).join('')}` : '';
      return `<div class="sheet-card">${memberCard(d, { cls: ' big', foot: S.song ? mateFoot(sh.cid) : '' })}</div>
        ${canPick ? `<div class="pick-btns">${btns}</div>` : ''}${closeBtn}`;
    }
    case 'player': {
      const p = G.getP(S, sh.pid);
      if (!p) return null;
      const so = G.curSong(S);
      return `<div class="row" style="gap:12px;margin-bottom:12px">${avatar(p.name, 'lg')}<div style="flex:1"><h2 style="margin:0">${esc(p.name)}</h2>
          <div class="hint">${TYPES[p.type].icon} ${TYPES[p.type].name}・${p.rank}位・${p.votes}万票</div></div></div>
        ${STATS.map(k => statBar(k, p.st[k], 14, so && k === G.mainStat(so) ? G.needOf(so) : 0)).join('')}
        ${p.r?.mates.length ? `<h4>ステージメンバー</h4><div class="m-grid two">${p.r.mates.map(c => memberCard(G.npcDef(S, c))).join('')}</div>` : ''}
        <p class="hint">練習カード ${p.train.length}枚・アクション ${p.act.length}枚${S.phase === 'practice' ? `・セット済み ${p.r.set.length}枚` : ''}</p>${closeBtn}`;
    }
    case 'custom': return sheetCustom(sh);
    case 'menu': return sheetMenu();
    case 'rules': return `<h2>📖 遊び方</h2>${rulesHtml()}${closeBtn}`;
  }
  return null;
}

function sheetCard(sh) {
  const my = me();
  const c = CARDS[sh.cid];
  const isTrain = c.cat === 'train';
  if (!my || !(isTrain ? my.train : my.act).includes(sh.cid)) return null;
  const r = my.r;
  const left = isTrain ? G.TRAIN_USES - r.used : G.ACTION_SETS - r.set.length;
  const canUse = S.phase === 'practice' && !r.ready && left > 0;
  const prm = sh.prm;
  let ready = canUse;
  let steps = '';
  if (c.kind === 'any') {
    steps = `<h4>どの能力を上げる？</h4><div class="opts">${STATS.map(k => `<button class="opt ${prm.stat === k ? 'sel' : ''}" data-act="param" data-k="stat" data-v="${k}">${STAT_NAMES[k]} ${my.st[k]}→${my.st[k] + 3}</button>`).join('')}</div>`;
    if (!prm.stat) ready = false;
  }
  if (TARGETED.includes(c.kind)) {
    steps = `<h4>だれに仕掛ける？</h4><div class="opts">${S.players.filter(p => p.id !== pid).map(p => `<button class="opt ${prm.opp === p.id ? 'sel' : ''}" data-act="param" data-k="opp" data-v="${p.id}">${avatar(p.name)}${esc(p.name)}<small>${p.rank}位</small></button>`).join('')}</div>`;
    if (!prm.opp) ready = false;
  }
  let note = '';
  if (STATS.includes(c.kind)) note = `${STAT_NAMES[c.kind]} ${my.st[c.kind]} → ${my.st[c.kind] + 2}`;
  if (!isTrain) note = c.type === 'def' ? '妨害されたときに自動で発動します' : 'セットしたカードは本番で公開されます';
  if (!canUse) note = S.phase !== 'practice' ? '練習期間に使えます' : r.ready ? '準備完了を取り消すと使えます' : (isTrain ? `練習カードはもう${G.TRAIN_USES}枚使いました` : `アクションはもう${G.ACTION_SETS}枚セットしました`);
  return `<div class="sheet-card">${cardView(c, { cls: ' big' })}</div>
    <div class="desc">${esc(c.eff)}${note ? `<span class="warn">${note}</span>` : ''}</div>
    ${canUse ? steps : ''}
    <div class="sheet-actions"><button class="btn" data-act="closeSheet">閉じる</button>
      ${canUse ? `<button class="btn primary wide" data-act="play" ${ready ? '' : 'disabled'}>${isTrain ? '使う' : '伏せてセット'}</button>` : ''}</div>`;
}

function sheetMenu() {
  const log = [...(S.log || [])].reverse().map(l => `<div class="${l.m.startsWith('──') ? 'wk' : ''}">${esc(l.m)}</div>`).join('');
  return `<h2>メニュー</h2>
    <div class="row" style="flex-wrap:wrap"><button class="btn small" data-act="rules">📖 遊び方</button><button class="btn small" data-act="share">🔗 招待リンク</button><button class="btn small" data-act="quit">🚪 退出</button></div>
    <h4>これまでの流れ</h4><div class="log-list">${log}</div>${closeBtn}`;
}

function sheetCustom(sh) {
  const f = sh.form;
  const stepper = k => `<div class="stepper"><span class="lb ${k}">${STAT_NAMES[k]}</span>
    <button data-act="cstep" data-k="${k}" data-v="-1">−</button><span class="v">${f[k]}</span><button data-act="cstep" data-k="${k}" data-v="1">＋</button>
    <span class="bar"><i style="width:${f[k] / 9 * 100}%;background:var(--${k})"></i></span></div>`;
  return `<h2>✨ 練習生を作る</h2>
    <p class="hint">ステージメンバーの候補として登場します。</p>
    <div class="form-grid">
      <label class="hint" for="c-name">名前（10文字まで）</label>
      <input id="c-name" class="field" data-bind="c.name" maxlength="10" value="${esc(f.name)}" placeholder="例：ミナ" autocomplete="off">
      <label class="hint">能力（0〜9）<small>　標準の練習生は1〜5くらい</small></label>
      ${STATS.map(stepper).join('')}
      <label class="hint">特徴</label>
      <div class="trait-grid">${Object.entries(TRAITS).map(([k, t]) => `<button class="opt trait ${f.trait === k ? 'sel' : ''}" data-act="ctrait" data-v="${k}"><b>${esc(t.name)}</b><span class="p">＋${esc(t.plus)}</span><span class="m">－${esc(t.minus)}</span></button>`).join('')}</div>
      <label class="hint" for="c-country">出身国（空欄でOK）</label>
      <input id="c-country" class="field" data-bind="c.country" maxlength="8" value="${esc(f.country)}" placeholder="例：日本" autocomplete="off">
    </div>
    <div class="sheet-actions"><button class="btn" data-act="closeSheet">やめる</button><button class="btn primary wide" data-act="saveCustom">追加する</button></div>`;
}

// --- 結果 ---
function viewResult() {
  const R = S.results;
  const M = MISSIONS[R.mission - 1];
  const so = SONGS[R.song];
  const rows = R.rows.map((row, i) => `<div class="rrow ${row.pid === pid ? 'me' : ''}${enter(`rr:${R.mission}:${row.pid}`)}" style="--i:${R.rows.length - 1 - i}">
      <div class="hd"><div class="rank r${row.rank}">${row.rank}位</div>${avatar(row.name)}
        <div class="nm">${esc(row.name)}<div class="gain">得票 ${sv(row.gain)}万</div></div>
        <div class="sc"><b>${row.total}</b><small>ステージ点</small></div></div>
      <div class="rbrk">自分 ${row.self}${row.fail ? '（ミス連発…）' : ''}　メンバー ${row.team}（${row.mates.map(m => esc(G.npcDef(S, m.cid).name)).join('・')}）</div>
      ${row.ev.length ? `<div class="evs">${row.ev.map(e => `<span class="${e.bad ? 'bad' : e.good ? 'good' : ''}">${esc(e.t)}${e.v ? ` <b>${sv(e.v)}点</b>` : ''}${e.votes ? ` <b>${sv(e.votes)}万票</b>` : ''}</span>`).join('')}</div>` : ''}
    </div>`).join('');
  const readyCnt = S.players.filter(p => S.ready[p.id]).length;
  const host = G.isHost(S, pid);
  const standings = [...S.players].sort((a, b) => a.rank - b.rank).map(p => `<span class="${p.id === pid ? 'me' : ''}">${p.rank}位 ${esc(p.name)} <b>${p.votes}万</b></span>`).join('');
  return `<div class="overlay${enter('ovr:' + R.mission)}"></div><div class="modal${enter('mr:' + R.mission)}" data-keep="modal">
    <h2>${M.icon} 第${R.mission}課題 結果発表</h2>
    <div class="sub">♪ ${esc(so.name)}（${stars(so.diff)}）・順位の得票 ${(VOTES[S.players.length] || VOTES[4]).map(v => v * M.mult).join('／')}万</div>
    ${rows}
    <div class="standings"><small>現在の順位</small>${standings}</div>
    <div class="modal-actions">
      ${S.ready[pid]
        ? `<div class="waiting">ほかの人を待っています（${readyCnt}/${S.players.length}）<span class="dots"></span></div>`
        : `<button class="btn primary big" data-act="ready2">${R.mission >= MISSIONS.length ? '最終結果へ ▶' : '次の課題へ ▶'}</button>`}
      ${host && S.ready[pid] ? '<button class="btn small" data-act="force">全員待たずに進める</button>' : ''}
      <button class="btn ghost small" data-act="closeResult">画面に戻る</button>
    </div></div>`;
}

function viewEnd() {
  const winners = S.final.filter(f => f.rank === 1);
  const my = S.final.find(f => f.pid === pid);
  const iWon = my.rank === 1;
  const colors = ['#ff5fa2', '#ffd166', '#9b6bff', '#4fc3ff', '#3ee0a0'];
  const confetti = iWon ? `<div class="confetti">${Array.from({ length: 40 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % 5]};animation-duration:${2.5 + Math.random() * 3}s;animation-delay:${Math.random() * 3}s"></i>`).join('')}</div>` : '';
  const rows = S.final.map(f => `<div class="rrow ${f.pid === pid ? 'me' : ''}"><div class="hd"><div class="rank r${f.rank}">${f.rank}位</div>${avatar(f.name)}<div class="nm">${esc(f.name)}<div class="gain">${f.rank === 1 ? '🎉 デビュー決定！' : '練習生として再出発…'}</div></div><div class="sc"><b>${f.votes}</b><small>万票</small></div></div></div>`).join('');
  const host = G.isHost(S, pid);
  return `<div class="overlay"></div>${confetti}<div class="modal${enter('end')}" data-keep="end">
    <div class="trophy">${iWon ? '🏆' : '🌙'}</div>
    <div class="winner"><span>${winners.map(w => esc(w.name)).join('・')}</span><br>デビュー決定！</div>
    <div class="sub">${iWon ? 'おめでとう！ あなたが一番票を集めました' : `あなたは${my.rank}位でした`}</div>
    ${rows}
    <div class="modal-actions">
      ${host ? '<button class="btn primary big" data-act="again">もう一度遊ぶ</button>' : '<div class="waiting">ホストが「もう一度遊ぶ」を押すと待機室に戻ります</div>'}
      <button class="btn ghost small" data-act="closeEnd">画面に戻る</button>
      <button class="btn ghost small" data-act="quit">退出する</button>
    </div></div>`;
}

function rulesHtml() {
  const t = VOTES[4];
  const uniq = cat => [...new Map(Object.values(CARDS).filter(c => c.cat === cat).map(c => [c.kind, c])).values()];
  return `<div class="rules">
    <p>あなたはオーディション番組の<b>練習生</b>。毎回<b>全員が同じ課題曲</b>でステージ点を競い、順位に応じて票が入ります。全5課題で<b>一番票を集めた人がデビュー</b>！</p>
    <h4>1つの課題の流れ</h4>
    <p>① <b>選曲</b>：ランダムに選ばれた「選曲担当」が3曲の候補から1曲を選ぶ（毎回ちがう曲）<br>
    ② <b>メンバー選び</b>：票が少ない人から順に、候補の練習生を1人ずつ指名。<b>自分のチームに入れる</b>か、<b>ライバルに押し付ける</b>かを選べる。全員のチームが${TEAM_SIZE}人になるまで続く<br>
    ③ <b>練習期間</b>（全員同時）：練習カードを<b>2枚まで</b>使って能力アップ ＋ アクションカードを<b>2枚まで</b>伏せてセット<br>
    ④ <b>本番</b>：アクションを公開 → ステージ点の高い順に票が入る</p>
    <h4>ステージ点</h4>
    <p>自分の点 ＝ 能力 × 曲の重み の合計<br>メンバーの点は半分＋特徴の効果<br>★★の曲はメイン能力7以上、★★★は10以上ないと<b>ミス連発（×${FAIL_MULT}）</b></p>
    <h4>順位ごとの得票</h4><p>4人なら 1位${t[0]}万／2位${t[1]}万／3位${t[2]}万／4位${t[3]}万（最終課題は2倍）</p>
    <h4>練習カード</h4><table>${uniq('train').map(c => `<tr><td>${c.icon} ${c.name}</td><td>${c.eff}</td></tr>`).join('')}</table>
    <h4>アクションカード</h4><table>${uniq('action').map(c => `<tr><td>${c.icon} ${c.name}<br><small>${ACTION_TYPES[c.type]}</small></td><td>${c.eff}</td></tr>`).join('')}</table>
    <h4>メンバーの特徴</h4><table>${Object.values(TRAITS).map(x => `<tr><td>${x.name}</td><td>＋${x.plus}<br>－${x.minus}</td></tr>`).join('')}</table>
    <h4>本番ハプニング</h4><table>${HAPPS.filter(h => h.id !== 'none').map(h => `<tr><td>${h.icon} ${h.name}</td><td>${h.v ? `ステージ点${sv(h.v)}` : ''}${h.votes ? `得票${sv(h.votes)}万` : ''}</td></tr>`).join('')}</table>
  </div>`;
}

// ---------- 操作 ----------
const handlers = {
  genRoom() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    ui.form.room = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    render();
  },
  async enter() {
    const name = ui.form.name.trim();
    const room = ui.form.room.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
    if (!name) return toast('名前を入力してください', 'err');
    if (!room) return toast('ルームIDを入力してください（「作成」で自動で作れます）', 'err');
    await joinAndListen(room, name);
  },
  rules() { openSheet('rules'); },
  menu() { openSheet('menu'); },
  closeSheet() { closeSheet(); },
  async share() {
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`;
    const text = `「デビューまであと1ステージ」で対戦しよう！ ルームID：${roomId}`;
    if (navigator.share) { try { await navigator.share({ title: 'デビューまであと1ステージ', text, url }); return; } catch { /* キャンセル */ } }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('招待リンクをコピーしました'); } catch { toast(url); }
  },
  async leave() {
    await Store.transact(roomId, st => (st ? G.leaveRoom(st, pid) : st));
    exitRoom();
  },
  quit() {
    if (S && S.status === 'playing' && !confirm('退出しますか？（同じ名前・ルームIDで戻れます）')) return;
    exitRoom();
  },
  setType(ds) { act(s => G.setType(s, pid, ds.v)); },
  start() { act(s => G.startGame(s, pid)); },
  openCustom() { openSheet('custom', { form: { name: '', vo: 3, da: 3, ra: 3, vi: 3, trait: 'leader', country: '' } }); },
  cstep(ds) {
    const f = ui.sheet.form;
    f[ds.k] = Math.max(0, Math.min(9, f[ds.k] + Number(ds.v)));
    render();
  },
  ctrait(ds) { ui.sheet.form.trait = ds.v; render(); },
  async saveCustom() {
    const f = ui.sheet.form;
    if (!f.name.trim()) return toast('名前を入力してください', 'err');
    const r = await act(s => G.addCustom(s, pid, f));
    if (r && !r.error) {
      const list = savedCustoms().filter(c => c.name !== f.name.trim());
      list.unshift({ name: f.name.trim(), vo: f.vo, da: f.da, ra: f.ra, vi: f.vi, trait: f.trait, country: f.country.trim() });
      savedCustomStore.set(JSON.stringify(list.slice(0, 12)));
      toast(`「${f.name.trim()}」を追加しました`);
      closeSheet();
    }
  },
  addSaved(ds) {
    const saved = savedCustoms().filter(sc => !(S.custom || []).some(c => c.name === sc.name));
    const c = saved[Number(ds.i)];
    if (c) act(s => G.addCustom(s, pid, c));
  },
  delCustom(ds) { act(s => G.removeCustom(s, pid, ds.id)); },
  viewPlayer(ds) { openSheet('player', { pid: ds.id }); },
  viewMember(ds) { openSheet('member', { cid: ds.cid }); },
  openMember(ds) { openSheet('member', { cid: ds.cid, pick: true }); },
  async pickTo(ds) {
    const cid = ui.sheet.cid;
    const r = await act(s => G.draftPick(s, pid, cid, ds.to));
    if (r && !r.error) {
      closeSheet();
      toast(ds.to === pid ? `${G.npcDef(S, cid).name} を指名しました` : `${G.npcDef(S, cid).name} を ${G.getP(S, ds.to).name} に押し付けた！`, 'hi');
    }
  },
  pickSong(ds) { ui.songSel = ds.v; render(); },
  confirmSong() { if (ui.songSel) act(s => G.chooseSong(s, pid, ui.songSel)); },
  tab(ds) { ui.tab = ds.v; render(); },
  openCard(ds) { openSheet('card', { cid: ds.cid }); },
  param(ds) { ui.sheet.prm[ds.k] = ds.v; render(); },
  async play() {
    const { cid, prm } = ui.sheet;
    const c = CARDS[cid];
    const r = await act(s => (c.cat === 'train' ? G.useTrain(s, pid, cid, prm) : G.setAction(s, pid, cid, prm)));
    if (r && !r.error) { ui.sheet = null; render(); toast(c.cat === 'train' ? `${c.icon} ${c.name}` : `🃏 「${c.name}」を伏せました`, 'hi'); }
  },
  unset(ds) { act(s => G.unsetAction(s, pid, Number(ds.i))); },
  ready() {
    const my = me();
    const left = [];
    if (my.r.used < G.TRAIN_USES && my.train.length) left.push(`練習カードあと${G.TRAIN_USES - my.r.used}枚`);
    if (my.r.set.length < G.ACTION_SETS && my.act.length) left.push(`アクションあと${G.ACTION_SETS - my.r.set.length}枚`);
    if (left.length && !confirm(`${left.join('・')}使えます。本番に進みますか？`)) return;
    act(s => G.setReady(s, pid));
  },
  cancelReady() { act(s => G.cancelReady(s, pid)); },
  force() { if (confirm('止まっている人の代わりに進めますか？')) act(s => G.forceAdvance(s, pid)); },
  ready2() { act(s => G.readyNext(s, pid)); },
  closeResult() { ui.closedResult = S.results.mission; render(); },
  openResult() { ui.closedResult = 0; render(); },
  closeEnd() { ui.closedResult = 'end'; render(); },
  again() { act(s => G.backToLobby(s, pid)); },
};

app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !app.contains(el)) return;
  const fn = handlers[el.dataset.act];
  if (fn) fn(el.dataset, e);
});
app.addEventListener('input', e => {
  const k = e.target.dataset.bind;
  if (!k) return;
  if (k.startsWith('c.')) ui.sheet.form[k.slice(2)] = e.target.value;
  else ui.form[k] = e.target.value;
});
app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset.bind && !e.target.dataset.bind.startsWith('c.')) handlers.enter();
});

// ---------- 部屋の購読 ----------
async function joinAndListen(room, name) {
  ui.busy = true; render();
  const r = await Store.transact(room, st => G.joinRoom(st, pid, name, room));
  ui.busy = false;
  if (r.error) { render(); toast(r.error, 'err'); return; }
  const st = r.state;
  const mine = st.players.find(p => p.id === pid) || st.players.find(p => p.name === name.trim());
  if (mine && mine.id !== pid) { pid = mine.id; pidStore.set(pid); }
  roomId = room;
  roomStore.set(room);
  nameStore.set(name);
  history.replaceState(null, '', `?room=${encodeURIComponent(room)}`);
  if (unsub) unsub();
  S = st;
  unsub = await Store.subscribe(room, onState);
  render();
}

function exitRoom() {
  if (unsub) unsub();
  unsub = null; S = null; roomId = null; ui.sheet = null;
  roomStore.del();
  history.replaceState(null, '', location.pathname);
  render();
}

function onState(st) {
  const prev = S;
  if (!st) { if (prev) toast('部屋がなくなりました', 'err'); exitRoom(); return; }
  if (!st.players.some(p => p.id === pid)) { toast('部屋から退出しました'); exitRoom(); return; }
  S = st;
  if (prev && st.status === 'playing') {
    if (st.mission !== prev.mission) { ui.closedResult = 0; ui.songSel = null; ui.tab = 'train'; }
    if (st.phase === 'song' && prev.phase !== 'song' && st.songPick.by === pid) { toast('🎲 あなたが選曲担当です！', 'hi'); navigator.vibrate?.(120); }
    if (st.phase === 'draft' && prev.phase === 'song') toast(`♪「${SONGS[st.song].name}」に決定！`, 'hi');
    const myDraft = st.phase === 'draft' && G.drafter(st) === pid;
    const wasMyDraft = prev.phase === 'draft' && G.drafter(prev) === pid && prev.draft?.idx === st.draft?.idx;
    if (myDraft && !wasMyDraft) { toast('👉 あなたの指名の番です！', 'hi'); navigator.vibrate?.(120); }
    if (st.phase === 'practice' && prev.phase === 'draft') toast('💪 練習期間スタート！', 'hi');
    if (st.phase === 'result' && prev.phase !== 'result') navigator.vibrate?.(150);
  }
  if (prev && prev.status !== 'lobby' && st.status === 'lobby') { seen.clear(); ui.closedResult = 0; }
  render();
}

// ---------- 起動 ----------
(async () => {
  render();
  const room = roomStore.get();
  const name = nameStore.get();
  if (room && name) {
    ui.form.room = room;
    await joinAndListen(room, name);
  }
})();
