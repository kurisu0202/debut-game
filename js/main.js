// ===== 画面・操作 =====
import * as G from './game.js';
import {
  STATS, STAT_NAMES, STAT_FULL, TYPES, MISSIONS, SONGS, DIFF, FAIL_MULT, CARDS, HAPPS,
  SKILL_DESC, SKILL_LIST, SKILL_TONE, FLAGS, DEBUT, ELIM,
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
const savedCustomStore = store('dm_my_customs2');

let pid = pidStore.get() || ('p' + Math.random().toString(36).slice(2, 10));
pidStore.set(pid);

let S = null;
let roomId = null;
let unsub = null;
const ui = {
  form: { name: nameStore.get() || '', room: new URLSearchParams(location.search).get('room') || '' },
  sheet: null,
  resultStep: 0,      // 結果モーダル：0=ステージ結果 1=順位発表
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
const num = v => Number(v || 0).toLocaleString('ja-JP');
const signed = v => (v >= 0 ? '+' : '−') + num(Math.abs(v));
const me = () => S && S.players.find(p => p.id === pid);
const stars = d => '★'.repeat(d) + '☆'.repeat(3 - d);

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
function statRow(k, v, mod = 0, max = 9) {
  return `<div class="st ${k}"><span class="lb">${STAT_NAMES[k]}</span><span class="bar"><i style="width:${Math.min(100, Math.max(0, v + mod) / max * 100)}%"></i></span><span class="n">${Math.max(0, v + mod)}${mod ? `<sup class="${mod < 0 ? 'neg' : ''}">${mod > 0 ? '+' : ''}${mod}</sup>` : ''}</span></div>`;
}

// NPC練習生カード
function tcard(d, o = {}) {
  const tone = SKILL_TONE[d.skill] || 'etc';
  const mod = o.mod || {};
  const flag = d.country ? `<span class="flag">${FLAGS[d.country] || '🌏'}</span>` : '';
  const attrs = o.act ? `data-act="${o.act}" data-cid="${d.id}"` : '';
  const Tag = o.act ? 'button' : 'div';
  return `<${Tag} class="tcard tone-${tone}${o.cls || ''}" ${attrs}>
    <div class="band"><span class="face" style="--h:${hue(d.name)}">${esc([...d.name][0])}</span>${flag}${d.star ? '<span class="star">★</span>' : ''}</div>
    ${o.badge ? `<span class="badge ${o.badgeCls || ''}">${esc(o.badge)}</span>` : ''}
    <div class="nm">${esc(d.name)}</div>
    <div class="sk">${esc(d.skill)}${d.custom ? '・自作' : ''}</div>
    <div class="stats">${STATS.map(k => statRow(k, d[k], mod[k] || 0, 9)).join('')}</div>
  </${Tag}>`;
}

// 練習カード
function kcard(c, o = {}) {
  const attrs = o.act ? `data-act="${o.act}" data-cid="${c.id}"` : '';
  const Tag = o.act ? 'button' : 'div';
  return `<${Tag} class="ccard lesson${o.cls || ''}" ${attrs}>
    <span class="ty">TRAINING</span>
    <div class="ico">${c.icon}</div>
    <div class="nm">${esc(c.name)}</div>
    <div class="ef">${esc(c.eff)}</div>
  </${Tag}>`;
}

function weightChips(so) {
  const mk = G.mainStat(so);
  return STATS.filter(k => so.w[k] > 0).map(k => `<span class="wchip-s ${k}${k === mk ? ' main' : ''}">${STAT_NAMES[k]}×${so.w[k]}</span>`).join('');
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
      <div class="logo-sub">SURVIVAL AUDITION GAME</div>
      <h1>デビューまで<br><span>あと1ステージ</span></h1>
      <div class="logo-stars">★ ★ ★</div>
      <p class="hint" style="margin-top:10px">あなたはサバイバル番組の練習生。<br>5つの課題を乗り越えて、デビュー組（上位${DEBUT}人）を目指せ！</p>
    </div>
    <div class="panel">
      <label for="in-name">練習生としての名前</label>
      <input id="in-name" class="field" data-bind="name" maxlength="10" placeholder="例：くりす" value="${esc(ui.form.name)}" autocomplete="off">
      <label for="in-room">ルームID</label>
      <div class="row">
        <input id="in-room" class="field" data-bind="room" maxlength="12" placeholder="例：K7Q2" value="${esc(ui.form.room)}" autocomplete="off" autocapitalize="characters">
        <button class="btn" data-act="genRoom">🎲 作成</button>
      </div>
      <p class="hint">同じルームIDを入力した人同士で対戦します（1〜4人。1人でもNPC練習生と競えます）。部屋がなければ新しく作られます。</p>
      <button class="btn primary big" data-act="enter" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '接続中…' : '番組に参加する'}</button>
    </div>
    <button class="btn link" data-act="rules">📖 ルールを見る</button>
    <div class="mode-badge ${Store.isOnline ? '' : 'local'}">
      ${Store.isOnline ? '<b>● オンライン</b>（Firebase接続）' : '<b>● ローカルテストモード</b><br>Firebase未設定のため、同じブラウザの別タブ同士でのみ遊べます'}
    </div>
  </div>`;
}

// ===== ロビー =====
function viewLobby() {
  const host = G.isHost(S, pid);
  const my = me();
  const n = S.players.length;
  const slots = [];
  for (let i = 0; i < 4; i++) {
    const p = S.players[i];
    const t = p && TYPES[p.type];
    slots.push(p
      ? `<div class="pitem">${avatar(p.name)}<span class="nm">${esc(p.name)}<small>${t.icon} ${t.name}</small></span>
          ${p.id === S.hostId ? '<span class="tag">👑 ホスト</span>' : ''}${p.id === pid ? '<span class="tag">あなた</span>' : ''}</div>`
      : '<div class="pitem empty"><span class="avatar" style="--h:260">?</span><span class="nm">募集中…</span></div>');
  }
  const types = Object.values(TYPES).map(t => `<button class="type-opt ${my.type === t.id ? 'sel' : ''}" data-act="setType" data-v="${t.id}">
      <span class="ti">${t.icon}</span><b>${t.name}</b>
      <span class="ts">${STATS.map(k => `${STAT_NAMES[k]}${t.st[k]}`).join(' ')}</span>
      <small>${esc(t.perk)}</small></button>`).join('');
  const customs = (S.custom || []).map(c => `<div style="position:relative">
      ${(c.owner === pid || host) ? `<button class="del-x" data-act="delCustom" data-id="${c.id}" aria-label="削除">✕</button>` : ''}
      ${tcard(c, { act: 'viewNpc' })}</div>`).join('');
  const saved = savedCustoms().filter(sc => !(S.custom || []).some(c => c.name === sc.name));
  return `<div class="lobby">
    <div class="topbar"><button class="icon-btn" data-act="leave" aria-label="退出">←</button><div class="title">待機室</div><button class="icon-btn" data-act="rules" aria-label="ルール">📖</button></div>
    <div class="room-card"><div class="lbl">ROOM ID</div><div class="room-id">${esc(roomId)}</div>
      <button class="btn small" data-act="share">🔗 招待リンクを共有</button></div>
    <section><h3>あなたのタイプを選ぶ <small>最初の能力と特性が決まります</small></h3><div class="type-grid">${types}</div></section>
    <section><h3>参加プレイヤー <small>${n}/4人</small></h3><div class="plist">${slots.join('')}</div></section>
    <section><h3>オリジナル練習生 <small>番組のほかの参加者として登場（${(S.custom || []).length}/${G.MAX_CUSTOM}）</small></h3>
      ${customs ? `<div class="custom-list">${customs}</div>` : '<p class="hint">名前・能力値・特技を決めて、番組に出てくる練習生を追加できます。チームメイトやライバルとして登場します。</p>'}
      <div style="margin-top:10px"><button class="btn" style="width:100%" data-act="openCustom">＋ 練習生を作る</button></div>
      ${saved.length ? `<p class="hint" style="margin-top:12px">前に作った練習生をタップで追加：</p><div class="saved-chips">${saved.map((c, i) => `<button class="opt" data-act="addSaved" data-i="${i}">${esc(c.name)} <small>${c.vo}/${c.da}/${c.ra}/${c.vi}</small></button>`).join('')}</div>` : ''}
    </section>
    <div class="bottom-bar">${host
      ? `<button class="btn primary big" data-act="start">${n === 1 ? '1人で番組スタート！' : `${n}人で番組スタート！`}</button>`
      : '<div class="waiting">ホストの開始を待っています<span class="dots"></span></div>'}</div>
  </div>`;
}
function savedCustoms() { try { return JSON.parse(savedCustomStore.get() || '[]'); } catch { return []; } }

// ===== ゲーム =====
function rankBadge(rank, prev) {
  const diff = prev ? prev - rank : 0;
  const arrow = diff > 0 ? `<i class="up">▲${diff}</i>` : diff < 0 ? `<i class="down">▼${-diff}</i>` : '';
  return `<span class="rank-b ${rank <= DEBUT ? 'in' : ''}">${rank}<small>位</small>${arrow}</span>`;
}

function viewGame() {
  const my = me();
  if (!my) return '<div class="waiting">観戦できません</div>';
  const M = G.mission(S);
  const r = my.r;
  const total = S.ranking.length;
  const lastLog = (S.log || []).slice(-1)[0];
  const practice = S.phase === 'practice';

  const opps = S.players.filter(p => p.id !== pid).map(p => {
    let state = '';
    if (practice) state = p.r.ready ? '<span class="state ok">✓ 準備OK</span>' : '<span class="state">練習中</span>';
    else if (S.phase === 'result' && S.ready[p.id]) state = '<span class="state ok">✓ OK</span>';
    return `<button class="opp" data-act="viewOpp" data-id="${p.id}">
      ${state}<div class="top">${avatar(p.name)}<span class="nm">${esc(p.name)}</span></div>
      <div class="fans">${p.rank}<small>位</small> <span class="sm">${num(p.fans)}票</span></div>
      <div class="meta"><span>${TYPES[p.type].icon} ${TYPES[p.type].name}</span></div>
    </button>`;
  }).join('');

  const progress = MISSIONS.map(m => `<i class="${m.n < S.mission ? 'done' : m.n === S.mission ? 'now' : ''}"></i>`).join('');

  // バナー
  let banner;
  if (practice && !r.ready) {
    banner = `<div class="phase-banner mine"><span class="ic">${M.icon}</span><div><div class="t">第${S.mission}課題「${M.name}」</div><div class="s">${esc(M.desc)}</div></div></div>`;
  } else if (practice) {
    const cnt = S.players.filter(p => p.r.ready).length;
    banner = `<div class="phase-banner"><span class="ic">⏳</span><div><div class="t">準備完了！ ステージ待機中<span class="dots"></span></div><div class="s">ほかの練習生を待っています（${cnt}/${S.players.length}）</div></div></div>`;
  } else if (S.phase === 'result') {
    banner = `<div class="phase-banner"><span class="ic">📺</span><div><div class="t">第${S.mission}課題の結果発表！</div><div class="s">全員がOKすると次の課題へ進みます</div></div></div>`;
  } else {
    banner = '<div class="phase-banner"><span class="ic">🏁</span><div><div class="t">最終順位発表！</div></div></div>';
  }

  // 自分
  const tmp = r ? r.tmpSt : {};
  const meCard = `<div class="me-card">
    <div class="me-top">${avatar(my.name, 'lg')}
      <div class="nm">${esc(my.name)}<small>${TYPES[my.type].icon} ${TYPES[my.type].name}${my.grade ? `・<b class="grade g${my.grade}">${my.grade}</b>クラス` : ''}</small></div>
      <div class="me-rank">${rankBadge(my.rank, my.prevRank)}<small>${num(my.fans)}票 / ${total}人中</small></div>
    </div>
    <div class="me-stats">${STATS.map(k => statRow(k, my.st[k], tmp[k] || 0, 15)).join('')}</div>
    <div class="perk">✦ ${esc(TYPES[my.type].perk)}</div>
  </div>`;

  let missionHtml = '';
  if (r && S.status === 'playing') {
    const h = HAPPS[r.hap];
    const hap = `<div class="hap-card${enter('hap:' + S.mission)}"><span class="hi">${h.icon}</span><div><div class="hk">HAPPENING</div><b>${esc(h.name)}</b><div class="he">${esc(h.eff)}${r.hapDetail ? `<br><span>→ ${esc(r.hapDetail)}</span>` : ''}</div></div></div>`;
    const notes = r.notes.length ? `<div class="hint" style="margin:-4px 2px 10px">${r.notes.map(esc).join(' / ')}</div>` : '';
    const canEdit = practice && !r.ready;
    const songs = r.songs.map(id => {
      const so = SONGS[id];
      const ps = G.personalScore(S, my, id);
      const ok = !ps.fail;
      return `<button class="song ${r.song === id ? 'sel' : ''} ${canEdit ? '' : 'locked'}" data-act="song" data-v="${id}">
        <div class="song-top"><span class="sg">${esc(so.genre)}</span><span class="diff d${so.diff}">${stars(so.diff)}</span></div>
        <div class="song-nm">${so.pos ? '' : '♪ '}${esc(so.name)}</div>
        <div class="wrow">${weightChips(so)}</div>
        <div class="song-ft"><span class="${ok ? 'ok' : 'ng'}">${DIFF[so.diff].need ? `${STAT_FULL[ps.main]}${DIFF[so.diff].need}以上 ${ok ? '✓' : '✗ ミスしそう'}` : '初心者向け'}</span><b>${ps.score}<small>点</small></b></div>
      </button>`;
    }).join('');
    const so = r.song ? SONGS[r.song] : null;
    let team = '';
    if (r.mates.length) {
      const ts = so ? G.teamScore(S, my) : null;
      team = `<h3 class="sec">チームメイト <small>ランダムで決定</small></h3>
        <div class="mates">${r.mates.map((m, i) => {
          const d = G.npcDef(S, m.cid);
          const sc = ts ? ts.mates[i] : null;
          const hasMod = Object.values(m.mod).some(v => v);
          return tcard(d, { act: 'viewNpc', mod: m.mod, cls: isNew('mate:' + S.mission + m.cid), badge: sc ? `${sc.score}点` : '', badgeCls: hasMod ? 'warn' : 'ok' });
        }).join('')}</div>`;
    }
    let pred = '';
    if (so) {
      const ps = G.personalScore(S, my);
      const ts = r.mates.length ? G.teamScore(S, my) : null;
      pred = `<div class="est"><div><small>個人ステージ予想</small><b>${ps.score}</b><span class="hint">${ps.notes.map(esc).join('・')}</span></div>
        ${ts ? `<div style="text-align:right"><small>チーム合計予想</small><b>${ts.total}</b>${r.tmp.team ? `<span class="hint">チーム補正${r.tmp.team > 0 ? '+' : ''}${r.tmp.team}</span>` : ''}</div>` : ''}</div>`;
    }
    missionHtml = `${hap}${notes}
      <h3 class="sec">${M.pos ? 'ポジションを選ぶ' : '課題曲を選ぶ'} <small>${M.pos ? '得意な能力で勝負！' : '★が多い曲は高得点。でもメイン能力が足りないとミス連発…'}</small></h3>
      <div class="songs ${M.pos ? 'four' : ''}">${songs}</div>
      ${team || '<h3 class="sec">ソロステージ <small>この課題はひとりで挑戦</small></h3>'}
      ${pred}`;
  }

  // 手札
  const hand = my.hand.map(cid => kcard(CARDS[cid], { act: 'openCard', cls: isNew('hand:' + cid) })).join('') || '<div class="empty">練習カードがありません</div>';

  let actions = '';
  const host = G.isHost(S, pid);
  if (practice) {
    actions = r.ready
      ? `<span class="msg">ステージ待機中…</span>${host ? '<button class="btn small" data-act="forceReady">全員を待たずに開始</button>' : ''}<button class="btn small" data-act="cancelReady">取り消す</button>`
      : `<span class="msg">${r.song ? '練習が終わったらステージへ' : '課題曲を選んでください'}</span><button class="btn primary" data-act="ready" ${r.song ? '' : 'disabled'}>準備完了 🎤</button>`;
  } else if (S.phase === 'result') {
    actions = `<span class="msg">${S.ready[pid] ? 'ほかの人を待っています…' : ''}</span><button class="btn primary" data-act="openResult">結果を見る</button>`;
  } else {
    actions = '<span class="msg"></span><button class="btn gold" data-act="openResult">最終結果</button>';
  }

  return `<div class="game">
    <div class="g-head">
      <div class="week"><small>MISSION</small><b>${S.mission}</b><i>/${MISSIONS.length}</i></div>
      <button class="wchip" data-act="info"><span class="k">第${S.mission}課題</span><span class="v">${M.icon} ${esc(M.name)}</span><span class="prog">${progress}</span></button>
      <button class="icon-btn" data-act="ranking" aria-label="順位">🏆</button>
      <button class="icon-btn" data-act="menu" aria-label="メニュー">☰</button>
    </div>
    <div class="ticker" data-act="menu">${lastLog ? `<b>LOG</b>${esc(lastLog.m)}` : ''}</div>
    ${opps ? `<div class="opps">${opps}</div>` : ''}
    <main class="g-main" data-keep="main">
      ${banner}
      ${meCard}
      ${missionHtml}
    </main>
    <div class="dock">
      <div class="hand-head"><span>練習カード <b>${my.hand.length}</b>枚</span>
        ${practice && !r.ready ? `<span class="plays">使用できる残り ${'<i class="on"></i>'.repeat(G.USES - r.used)}${'<i></i>'.repeat(r.used)}</span>` : ''}</div>
      <div class="hand" data-keep="hand">${hand}</div>
      <div class="actions">${actions}</div>
    </div>
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
    case 'npc': {
      const d = G.npcDef(S, sh.cid);
      if (!d) return null;
      const n = S.npc && S.npc[sh.cid];
      return `<div class="sheet-card">${tcard(d, { cls: ' big' })}</div>
        <div class="desc"><b>特技：${esc(d.skill)}</b><br>${esc(SKILL_DESC[d.skill] || '')}${n ? `<br>現在 <b>${n.rank}位</b>（${num(n.fans)}票）${n.out ? '・<span style="color:var(--ng)">脱落</span>' : ''}` : ''}</div>${closeBtn}`;
    }
    case 'opp': return sheetOpp(sh);
    case 'info': return sheetInfo();
    case 'ranking': return `<h2>🏆 現在の順位</h2><p class="hint">上位${DEBUT}人がデビュー組。${ELIM[2]}位・${ELIM[4]}位の脱落ラインにも注意！</p>${rankingList(S.ranking, { all: true })}${closeBtn}`;
    case 'custom': return sheetCustom(sh);
    case 'menu': return sheetMenu();
    case 'rules': return `<h2>📖 ルール</h2>${rulesHtml()}${closeBtn}`;
  }
  return null;
}

function sheetCard(sh) {
  const my = me();
  if (!my || !my.hand.includes(sh.cid)) return null;
  const c = CARDS[sh.cid];
  const r = my.r;
  const canUse = S.phase === 'practice' && r && !r.ready && r.used < G.USES;
  const prm = sh.prm;
  let warn = '';
  let ready = canUse;
  let steps = '';
  if (c.kind === 'night') {
    steps = `<h4>上げる能力（+3）</h4><div class="opts">${STATS.map(k => `<button class="opt ${prm.stat === k ? 'sel' : ''}" data-act="param" data-k="stat" data-v="${k}">${STAT_FULL[k]} ${my.st[k]}→${my.st[k] + 3}</button>`).join('')}</div>`;
    if (!prm.stat) ready = false;
  }
  if (c.kind === 'devil') {
    const others = S.players.filter(p => p.id !== pid);
    if (!others.length) { warn = '相手のプレイヤーがいません'; ready = false; }
    steps = `<h4>だれの得票を減らす？</h4><div class="opts">${others.map(p => `<button class="opt ${prm.opp === p.id ? 'sel' : ''}" data-act="param" data-k="opp" data-v="${p.id}">${avatar(p.name)}${esc(p.name)}<small>${p.rank}位</small></button>`).join('')}</div>`;
    if (!prm.opp) ready = false;
  }
  if (c.kind === 'study') {
    if (!r?.song) { warn = '先に課題曲を選んでください'; ready = false; }
    else warn = `「${SONGS[r.song].name}」のメインは${STAT_FULL[G.mainStat(SONGS[r.song])]}`;
  }
  if (['teamprac', 'swap'].includes(c.kind) && r && !r.mates.length) { warn = 'この課題はソロステージなので使えません'; ready = false; }
  if (c.kind === 'reroll' && G.mission(S).pos) { warn = 'ポジション評価では使えません'; ready = false; }
  if (c.kind === 'low') {
    const k = STATS.reduce((a, b) => (my.st[b] < my.st[a] ? b : a));
    warn = `今使うと ${STAT_FULL[k]} ${my.st[k]}→${my.st[k] + 3}`;
  }
  if (!canUse) warn = S.phase !== 'practice' ? '練習期間に使えます' : r.ready ? '準備完了後は使えません（取り消すと使えます）' : `この課題ではもう${G.USES}枚使いました`;
  return `<div class="sheet-card">${kcard(c, { cls: ' big' })}</div>
    <div class="desc">${esc(c.eff)}${warn ? `<span class="warn">${warn}</span>` : ''}</div>
    ${canUse ? steps : ''}
    <div class="sheet-actions"><button class="btn" data-act="closeSheet">閉じる</button>
      ${canUse ? `<button class="btn primary wide" data-act="play" ${ready ? '' : 'disabled'}>このカードを使う</button>` : ''}</div>`;
}

function sheetOpp(sh) {
  const p = G.getP(S, sh.pid);
  if (!p) return null;
  const r = p.r;
  return `<div class="row" style="gap:12px;margin-bottom:12px">${avatar(p.name, 'lg')}<div style="flex:1"><h2 style="margin:0">${esc(p.name)}</h2>
      <div class="hint">${TYPES[p.type].icon} ${TYPES[p.type].name}${p.grade ? `・${p.grade}クラス` : ''}・練習カード ${p.hand.length}枚</div></div>
      <div class="me-rank">${rankBadge(p.rank, p.prevRank)}<small>${num(p.fans)}票</small></div></div>
    <div class="me-stats">${STATS.map(k => statRow(k, p.st[k], 0, 15)).join('')}</div>
    ${r && S.status === 'playing' ? `<h4>今回のハプニング</h4><div class="desc">${HAPPS[r.hap].icon} ${esc(HAPPS[r.hap].name)}</div>
      <h4>課題曲</h4><div class="desc">${r.song ? `♪ ${esc(SONGS[r.song].name)}（${stars(SONGS[r.song].diff)}）` : '選曲中…'}</div>
      ${r.mates.length ? `<h4>チームメイト</h4><div class="grp-row">${r.mates.map(m => tcard(G.npcDef(S, m.cid), { mod: m.mod })).join('')}</div>` : ''}` : ''}
    ${closeBtn}`;
}

function sheetInfo() {
  const M = G.mission(S);
  return `<h2>${M.icon} 第${S.mission}課題「${esc(M.name)}」</h2>
    <div class="desc">${esc(M.desc)}<br>得票倍率 ×${M.mult}${ELIM[S.mission] ? `<span class="warn">この課題のあと順位発表式！ ${ELIM[S.mission]}位より下の練習生は脱落</span>` : ''}</div>
    <h4>課題の流れ</h4>
    <div class="mission-list">${MISSIONS.map(m => `<div class="${m.n === S.mission ? 'now' : m.n < S.mission ? 'done' : ''}"><span>${m.icon}</span><b>${m.n}. ${esc(m.name)}</b><small>${m.team ? `${m.team + 1}人チーム` : 'ソロ'}・×${m.mult}${ELIM[m.n] ? `・${ELIM[m.n]}位以下脱落` : ''}${m.n === MISSIONS.length ? `・上位${DEBUT}人デビュー` : ''}</small></div>`).join('')}</div>
    ${closeBtn}`;
}

function sheetMenu() {
  const log = [...(S.log || [])].reverse().map(l => `<div class="${l.m.startsWith('──') ? 'wk' : ''}">${esc(l.m)}</div>`).join('');
  return `<h2>メニュー</h2>
    <div class="row" style="flex-wrap:wrap"><button class="btn small" data-act="rules">📖 ルール</button><button class="btn small" data-act="ranking">🏆 順位</button><button class="btn small" data-act="share">🔗 招待リンク</button><button class="btn small" data-act="quit">🚪 退出</button></div>
    <h4>ログ</h4><div class="log-list">${log}</div>${closeBtn}`;
}

function sheetCustom(sh) {
  const f = sh.form;
  const preview = { id: 'preview', name: f.name || 'なまえ', vo: f.vo, da: f.da, ra: f.ra, vi: f.vi, skill: f.skill, country: f.country.trim(), custom: true };
  const stepper = k => `<div class="stepper"><span class="lb ${k}">${STAT_NAMES[k]}</span>
    <button data-act="cstep" data-k="${k}" data-v="-1">−</button><span class="v">${f[k]}</span><button data-act="cstep" data-k="${k}" data-v="1">＋</button>
    <span class="bar"><i style="width:${f[k] / 9 * 100}%;background:var(--${k})"></i></span></div>`;
  const total = STATS.reduce((t, k) => t + f[k], 0);
  return `<h2>✨ 練習生を作る</h2>
    <div class="sheet-card" id="custom-preview">${tcard(preview, { cls: ' big' })}</div>
    <div class="form-grid">
      <label class="hint" for="c-name">名前（10文字まで）</label>
      <input id="c-name" class="field" data-bind="c.name" maxlength="10" value="${esc(f.name)}" placeholder="例：ミナ" autocomplete="off">
      <label class="hint">能力値（0〜9）　合計 <b style="color:${total > 14 ? 'var(--gold)' : '#fff'}">${total}</b> <small>※標準の練習生は合計8〜13程度</small></label>
      ${STATS.map(stepper).join('')}
      <label class="hint">特技</label>
      <div class="skill-grid">${SKILL_LIST.map(s => `<button class="opt ${f.skill === s ? 'sel' : ''}" data-act="cskill" data-v="${s}">${esc(s)}<small>${esc(SKILL_DESC[s])}</small></button>`).join('')}</div>
      <label class="hint" for="c-country">出身国（空欄でOK）</label>
      <input id="c-country" class="field" data-bind="c.country" maxlength="8" value="${esc(f.country)}" placeholder="例：日本" autocomplete="off">
    </div>
    <div class="sheet-actions"><button class="btn" data-act="closeSheet">やめる</button><button class="btn primary wide" data-act="saveCustom">番組に追加する</button></div>`;
}

function rankingList(list, o = {}) {
  const myIds = new Set(S.players.map(p => p.id));
  let rows = list;
  if (!o.all) {
    // 上位 + プレイヤー周辺のみ
    rows = list.filter(e => e.rank <= DEBUT || myIds.has(e.id));
  }
  let html = '';
  let prevRank = 0;
  rows.forEach(e => {
    if (prevRank && e.rank > prevRank + 1) html += '<div class="rk-gap">⋮</div>';
    if (prevRank <= DEBUT && e.rank > DEBUT && prevRank) html += `<div class="rk-line">─── デビューライン（${DEBUT}位）───</div>`;
    const isP = e.kind === 'p';
    const diff = e.prev ? e.prev - e.rank : 0;
    const arrow = e.out ? '' : diff > 0 ? `<i class="up">▲${diff}</i>` : diff < 0 ? `<i class="down">▼${-diff}</i>` : '<i class="eq">−</i>';
    html += `<div class="rk ${isP ? 'player' : ''} ${e.id === pid ? 'me' : ''} ${e.out ? 'out' : ''}" ${isP ? '' : `data-act="viewNpc" data-cid="${e.id}"`}>
      <span class="no">${e.rank}</span>${avatar(e.name)}<span class="nm">${esc(e.name)}${isP ? '<small>PLAYER</small>' : ''}${e.out ? '<small class="o">脱落</small>' : ''}</span>
      <span class="ar">${arrow}</span><span class="fv">${num(e.fans)}<small>票</small></span></div>`;
    prevRank = e.rank;
  });
  return `<div class="rk-list">${html}</div>`;
}

// --- 結果モーダル ---
function viewResult() {
  const R = S.results;
  const M = MISSIONS[R.mission - 1];
  const host = G.isHost(S, pid);
  const readyCnt = Object.keys(S.ready || {}).length;
  let body;
  if (ui.resultStep === 0) {
    body = R.rows.map((row, i) => {
      const so = SONGS[row.song];
      const h = HAPPS[row.hap];
      return `<div class="rrow ${row.pid === pid ? 'me' : ''}${enter(`rr:${R.mission}:${row.pid}`)}" style="--i:${i}">
        <div class="hd">${avatar(row.name)}<div class="nm">${esc(row.name)}${row.grade ? ` <b class="grade g${row.grade}">${row.grade}</b>` : ''}<div class="gain">${signed(row.gain)}票</div></div>
          <div class="sc"><b>${row.me.score}</b><small>個人ステージ点</small></div></div>
        <div class="items"><span>♪ ${esc(so.name)}（${stars(so.diff)}）</span><span>${h.icon} ${esc(h.name)}</span></div>
        ${row.me.notes.length ? `<div class="items">${row.me.notes.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
        ${row.mates.length ? `<div class="perf">${row.mates.map(m => `<span class="pm"><b>${esc(m.name)}</b> ${m.score}点</span>`).join('')}</div>` : ''}
        ${row.rival ? `<div class="vs ${row.win ? 'win' : 'lose'}"><span>チーム ${row.total}点</span><b>${row.win ? 'WIN' : 'LOSE'}</b><span>${row.rival.score}点 ライバル（${row.rival.names.map(esc).join('・')}）</span></div>` : ''}
        <div class="items">${row.items.map(it => `<span>${esc(it.label)} <b>${signed(it.v)}</b></span>`).join('')}</div>
      </div>`;
    }).join('');
  } else {
    body = `${R.eliminated.length ? `<div class="elim">😢 ${R.cut}位より下の練習生 ${R.eliminated.length}人が脱落しました<small>${R.eliminated.map(esc).join('・')}</small></div>` : ''}
      ${rankingList(S.ranking)}`;
  }
  const next = R.mission >= MISSIONS.length ? '最終結果へ ▶' : `OK！第${R.mission + 1}課題へ ▶`;
  return `<div class="overlay${enter('ovr:' + R.mission)}"></div><div class="modal${enter('mr:' + R.mission)}" data-keep="modal">
    <h2>${ui.resultStep === 0 ? `${M.icon} 第${R.mission}課題 ステージ結果` : `🏆 ${R.cut ? '順位発表式' : '現在の順位'}`}</h2>
    <div class="sub">${ui.resultStep === 0 ? `${esc(M.name)}・得票×${M.mult}` : `全${S.ranking.length}人中・上位${DEBUT}人がデビュー組`}</div>
    ${body}
    <div class="modal-actions">
      ${ui.resultStep === 0
        ? '<button class="btn primary big" data-act="resultNext">順位発表へ ▶</button>'
        : S.ready[pid]
          ? `<div class="waiting">ほかの人を待っています（${readyCnt}/${S.players.length}）<span class="dots"></span></div>`
          : `<button class="btn primary big" data-act="ready2">${next}</button>`}
      ${ui.resultStep === 1 ? '<button class="btn ghost small" data-act="resultBack">◀ ステージ結果に戻る</button>' : ''}
      ${host && S.ready[pid] ? '<button class="btn small" data-act="forceNext">全員を待たずに進める</button>' : ''}
      <button class="btn ghost small" data-act="closeResult">盤面を見る</button>
    </div></div>`;
}

function viewEnd() {
  const top = S.final[0];
  const iWon = top.pid === pid;
  const my = S.final.find(f => f.pid === pid);
  const colors = ['#ff5fa2', '#ffd166', '#9b6bff', '#4fc3ff', '#3ee0a0'];
  const confetti = my.debut ? `<div class="confetti">${Array.from({ length: 40 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % 5]};animation-duration:${2.5 + Math.random() * 3}s;animation-delay:${Math.random() * 3}s"></i>`).join('')}</div>` : '';
  const rows = S.final.map(f => `<div class="rrow ${f.pid === pid ? 'me' : ''}"><div class="hd"><div class="rank r${Math.min(f.rank, 4)}">${f.rank}位</div><div class="nm">${esc(f.name)}<div class="gain">${f.debut ? '🎉 デビュー決定' : 'デビューならず…'}</div></div><div class="sc"><b>${num(f.fans)}</b><small>票</small></div></div></div>`).join('');
  const debut = S.debut.map((e, i) => `<span class="db ${e.kind === 'p' ? 'p' : ''}">${i + 1}. ${esc(e.name)}</span>`).join('');
  const host = G.isHost(S, pid);
  return `<div class="overlay"></div>${confetti}<div class="modal${enter('end')}" data-keep="end">
    <div class="trophy">${my.debut ? '🏆' : '🌙'}</div>
    <div class="winner">${iWon ? '<span>あなたが最上位！</span>' : `<span>${esc(top.name)}</span> が最上位！`}<br>${my.debut ? `${my.rank}位でデビュー決定！` : `${my.rank}位…デビューならず`}</div>
    <div class="sub">プレイヤーの最終順位</div>
    ${rows}
    <h4 style="color:var(--pink2);margin:14px 0 6px">✨ デビュー組（上位${DEBUT}人）</h4>
    <div class="debut-list">${debut}</div>
    <div class="modal-actions">
      ${host ? '<button class="btn primary big" data-act="again">もう一度遊ぶ（待機室へ）</button>' : '<div class="waiting">ホストが「もう一度遊ぶ」を押すと待機室に戻ります</div>'}
      <button class="btn ghost small" data-act="closeEnd">盤面を見る</button>
      <button class="btn ghost small" data-act="quit">退出する</button>
    </div></div>`;
}

function rulesHtml() {
  return `<div class="rules">
    <p>あなたはサバイバルオーディション番組に参加した<b>練習生</b>。全5つの課題をこなしてファンの票を集め、<b>最終順位が一番高いプレイヤーの勝ち</b>。上位${DEBUT}人に入れば<b>デビュー決定</b>！ ほかの参加者（NPC練習生）も成長しながら票を集めてきます。</p>
    <h4>準備</h4><p>待機室で自分のタイプを選びます（最初の能力値と特性が決まる）。</p>
    <h4>課題の流れ（全員同時に進行）</h4>
    <p>① 課題が始まると、<b>課題曲の候補2曲</b>・<b>ランダムなチームメイト</b>・<b>ハプニング</b>が配られ、練習カードを4枚引く<br>
    ② 練習期間：練習カードを<b>最大3枚</b>使って自分の能力を上げる。課題曲を1曲選ぶ<br>
    ③ 「準備完了」を押す。全員そろったらステージ！<br>
    ④ 個人ステージ点・チームの勝敗で得票が決まり、全練習生の順位が発表される</p>
    <h4>ステージ点</h4>
    <p>個人ステージ点 ＝ 各能力 × 曲の重み の合計<br>
    難しい曲（★★・★★★）はクリアすると×${DIFF[2].mult}・×${DIFF[3].mult}。でも<b>メイン能力が足りないとミス連発で×${FAIL_MULT}</b>（★★は${DIFF[2].need}以上、★★★は${DIFF[3].need}以上必要）<br>
    得票 ≒ 個人ステージ点 × 80 × 課題の倍率 ＋ チーム勝利ベネフィット など</p>
    <h4>課題</h4><table>${MISSIONS.map(m => `<tr><td>${m.icon} ${m.name}</td><td>${m.desc}（得票×${m.mult}）${ELIM[m.n] ? `<br><b>終了後、${ELIM[m.n]}位より下のNPCは脱落</b>` : ''}</td></tr>`).join('')}</table>
    <p class="hint">※プレイヤーは脱落しません（国民プロデューサーの救済！）</p>
    <h4>タイプ</h4><table>${Object.values(TYPES).map(t => `<tr><td>${t.icon} ${t.name}</td><td>${STATS.map(k => `${STAT_NAMES[k]}${t.st[k]}`).join(' ')}<br>${t.perk}</td></tr>`).join('')}</table>
    <h4>練習カード</h4><table>${[...new Map(Object.values(CARDS).map(c => [c.kind, c])).values()].map(c => `<tr><td>${c.icon} ${c.name}</td><td>${c.eff}</td></tr>`).join('')}</table>
    <h4>ハプニング（毎課題ひとりずつ）</h4><table>${Object.values(HAPPS).map(h => `<tr><td>${h.icon} ${h.name}</td><td>${h.eff}</td></tr>`).join('')}</table>
    <h4>チームメイトの特技</h4><table>${SKILL_LIST.filter(s => s !== 'なし').map(s => `<tr><td>${s}</td><td>${SKILL_DESC[s]}</td></tr>`).join('')}</table>
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
    if (!room) return toast('ルームIDを入力してください（「作成」で自動生成できます）', 'err');
    await joinAndListen(room, name);
  },
  rules() { openSheet('rules'); },
  menu() { openSheet('menu'); },
  info() { openSheet('info'); },
  ranking() { openSheet('ranking'); },
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
    if (S && S.status === 'playing' && !confirm('退出しますか？（同じ名前・ルームIDで再入室できます）')) return;
    exitRoom();
  },
  setType(ds) { act(s => G.setType(s, pid, ds.v)); },
  start() { act(s => G.startGame(s, pid)); },
  openCustom() { openSheet('custom', { form: { name: '', vo: 2, da: 2, ra: 2, vi: 2, skill: 'なし', country: '' } }); },
  cstep(ds) {
    const f = ui.sheet.form;
    f[ds.k] = Math.max(0, Math.min(9, f[ds.k] + Number(ds.v)));
    render();
  },
  cskill(ds) { ui.sheet.form.skill = ds.v; render(); },
  async saveCustom() {
    const f = ui.sheet.form;
    if (!f.name.trim()) return toast('名前を入力してください', 'err');
    const r = await act(s => G.addCustom(s, pid, f));
    if (r && !r.error) {
      const list = savedCustoms().filter(c => c.name !== f.name.trim());
      list.unshift({ name: f.name.trim(), vo: f.vo, da: f.da, ra: f.ra, vi: f.vi, skill: f.skill, country: f.country.trim() });
      savedCustomStore.set(JSON.stringify(list.slice(0, 12)));
      toast(`「${f.name.trim()}」が番組に参加しました`);
      closeSheet();
    }
  },
  addSaved(ds) {
    const saved = savedCustoms().filter(sc => !(S.custom || []).some(c => c.name === sc.name));
    const c = saved[Number(ds.i)];
    if (c) act(s => G.addCustom(s, pid, c));
  },
  delCustom(ds) { act(s => G.removeCustom(s, pid, ds.id)); },
  viewNpc(ds) { openSheet('npc', { cid: ds.cid }); },
  viewOpp(ds) { openSheet('opp', { pid: ds.id }); },
  openCard(ds) { openSheet('card', { cid: ds.cid }); },
  param(ds) { ui.sheet.prm[ds.k] = ds.v; render(); },
  song(ds) {
    const r = me()?.r;
    if (!r || S.phase !== 'practice') return;
    if (r.ready) return toast('準備完了を取り消すと変更できます', 'err');
    act(s => G.chooseSong(s, pid, ds.v));
  },
  async play() {
    const { cid, prm } = ui.sheet;
    const c = CARDS[cid];
    const r = await act(s => G.playCard(s, pid, cid, prm));
    if (r && !r.error) { ui.sheet = null; render(); toast(`${c.icon} ${c.name}`, 'hi'); }
  },
  ready() {
    const my = me();
    if (my.r.used < G.USES && my.hand.length && !confirm(`練習カードをあと${G.USES - my.r.used}枚使えます。準備完了にしますか？`)) return;
    const ps = G.personalScore(S, my);
    if (ps.fail && !confirm(`このままだと${STAT_FULL[ps.main]}が足りずミス連発（×${FAIL_MULT}）しそうです。それでも挑戦しますか？`)) return;
    act(s => G.setReady(s, pid));
  },
  cancelReady() { act(s => G.cancelReady(s, pid)); },
  forceReady() { if (confirm('まだ準備していない人を自動で準備完了にして、ステージを始めますか？')) act(s => G.forceReady(s, pid)); },
  resultNext() { ui.resultStep = 1; render(); app.querySelector('.modal')?.scrollTo(0, 0); },
  resultBack() { ui.resultStep = 0; render(); },
  ready2() { act(s => G.readyNext(s, pid)); },
  forceNext() { if (confirm('全員を待たずに次へ進みますか？')) act(s => G.readyNext(s, pid, true)); },
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
  if (k.startsWith('c.')) {
    ui.sheet.form[k.slice(2)] = e.target.value;
    const f = ui.sheet.form;
    const prev = document.getElementById('custom-preview');
    if (prev) prev.innerHTML = tcard({ id: 'preview', name: f.name || 'なまえ', vo: f.vo, da: f.da, ra: f.ra, vi: f.vi, skill: f.skill, country: f.country.trim(), custom: true }, { cls: ' big' });
  } else ui.form[k] = e.target.value;
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
    if (st.mission !== prev.mission) {
      ui.closedResult = 0;
      toast(`${MISSIONS[st.mission - 1].icon} 第${st.mission}課題「${MISSIONS[st.mission - 1].name}」開始！`, 'hi');
      navigator.vibrate?.(100);
    }
    if (st.phase === 'result' && prev.phase !== 'result') { ui.resultStep = 0; navigator.vibrate?.(150); }
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
