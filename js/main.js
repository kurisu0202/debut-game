// ===== 画面・操作 =====
import * as G from './game.js';
import { THEMES, HAPPS, SKILL_DESC, SKILL_LIST, SKILL_TONE, FLAGS } from './cards.js';
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
const savedCustomStore = store('dm_my_customs');

let pid = pidStore.get() || ('p' + Math.random().toString(36).slice(2, 10));
pidStore.set(pid);

let S = null;          // 部屋の状態（共有）
let roomId = null;
let unsub = null;
const ui = {
  form: { name: nameStore.get() || '', room: new URLSearchParams(location.search).get('room') || '' },
  sheet: null,          // 下から出るシート
  picks: [],            // 出演メンバー（決定前）
  closedResult: 0,      // 閉じた結果モーダルの週
  busy: false,
};
const seen = new Set(); // 登場アニメ済みのキー
const enter = key => (seen.has(key) ? '' : (seen.add(key), ' enter'));
const isNew = key => (seen.has(key) ? '' : (seen.add(key), ' new'));

// ---------- ユーティリティ ----------
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hue = str => { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
const avatar = name => `<span class="avatar" style="--h:${hue(name)}">${esc([...String(name)][0] || '?')}</span>`;
const me = () => S && S.players.find(p => p.id === pid);
const def = cid => G.cardDef(S, cid);
const STAT_NAMES = { vo: 'Vo', da: 'Da', vi: 'Vi' };

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

// ---------- カード描画 ----------
function statRow(k, base, bonus, mult) {
  const v = base + bonus;
  const cls = mult === 0 ? ' zero' : mult >= 2 ? ' x2' : '';
  return `<div class="st ${k}${cls}"><span class="lb">${STAT_NAMES[k]}</span><span class="bar"><i style="width:${Math.min(100, v / 9 * 100)}%"></i></span><span class="n">${v}${bonus ? `<sup>+${bonus}</sup>` : ''}</span></div>`;
}

// 練習生カード d: 定義, e: グループ内エントリ（ボーナス付き）
function tcard(d, e, o = {}) {
  const b = e ? e.b : { vo: 0, da: 0, vi: 0 };
  const m = o.mult || {};
  const tone = SKILL_TONE[d.skill] || 'etc';
  const flag = d.country ? `<span class="flag">${FLAGS[d.country] || '🌏'}</span>` : '';
  const attrs = o.act ? `data-act="${o.act}" data-cid="${d.id}"` : '';
  const Tag = o.act ? 'button' : 'div';
  return `<${Tag} class="tcard tone-${tone}${o.cls || ''}" ${attrs}>
    ${o.pickNo ? `<span class="pick-no">${o.pickNo}</span>` : ''}
    <div class="band"><span class="face" style="--h:${hue(d.name)}">${esc([...d.name][0])}</span>${flag}${d.star ? '<span class="star">★</span>' : ''}</div>
    ${o.badge ? `<span class="badge">${esc(o.badge)}</span>` : ''}
    <div class="nm">${esc(d.name)}</div>
    <div class="sk">${esc(d.skill)}${d.country ? `・${esc(d.country)}` : ''}${d.custom ? '・自作' : ''}</div>
    <div class="stats">${statRow('vo', d.vo, b.vo, m.vo)}${statRow('da', d.da, b.da, m.da)}${statRow('vi', d.vi, b.vi, m.vi)}</div>
  </${Tag}>`;
}

function ccard(d, o = {}) {
  const attrs = o.act ? `data-act="${o.act}" data-cid="${d.id}"` : '';
  const Tag = o.act ? 'button' : 'div';
  return `<${Tag} class="ccard ${d.type}${o.cls || ''}" ${attrs}>
    <span class="ty">${d.type === 'lesson' ? 'LESSON' : 'EVENT'}</span>
    <div class="ico">${d.icon}</div>
    <div class="nm">${esc(d.name)}</div>
    <div class="ef">${esc(d.eff)}</div>
  </${Tag}>`;
}
const anyCard = (d, o) => (d.type === 'trainee' ? tcard(d, null, o) : ccard(d, o));

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
      <div class="logo-sub">IDOL PRODUCE CARD BATTLE</div>
      <h1>デビューまで<br><span>あと1ステージ</span></h1>
      <div class="logo-stars">★ ★ ★</div>
    </div>
    <div class="panel">
      <label for="in-name">あなたの名前（事務所名）</label>
      <input id="in-name" class="field" data-bind="name" maxlength="10" placeholder="例：くりす" value="${esc(ui.form.name)}" autocomplete="off">
      <label for="in-room">ルームID</label>
      <div class="row">
        <input id="in-room" class="field" data-bind="room" maxlength="12" placeholder="例：K7Q2" value="${esc(ui.form.room)}" autocomplete="off" autocapitalize="characters">
        <button class="btn" data-act="genRoom">🎲 作成</button>
      </div>
      <p class="hint">同じルームIDを入力した人同士で対戦します（2〜4人）。<br>部屋がなければ新しく作られ、あなたがホストになります。</p>
      <button class="btn primary big" data-act="enter" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '接続中…' : '入室する'}</button>
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
  const n = S.players.length;
  const slots = [];
  for (let i = 0; i < G.MAX_PLAYERS; i++) {
    const p = S.players[i];
    slots.push(p
      ? `<div class="pitem">${avatar(p.name)}<span class="nm">${esc(p.name)}</span>
          ${p.id === S.hostId ? '<span class="tag">👑 ホスト</span>' : ''}${p.id === pid ? '<span class="tag">あなた</span>' : ''}</div>`
      : '<div class="pitem empty"><span class="avatar" style="--h:260">?</span><span class="nm">募集中…</span></div>');
  }
  const customs = (S.custom || []).map(c => `<div style="position:relative">
      ${(c.owner === pid || host) ? `<button class="del-x" data-act="delCustom" data-id="${c.id}" aria-label="削除">✕</button>` : ''}
      ${tcard(c, null, { act: 'viewCustom' })}</div>`).join('');
  const saved = savedCustoms().filter(sc => !(S.custom || []).some(c => c.name === sc.name && c.vo === sc.vo && c.da === sc.da && c.vi === sc.vi));
  return `<div class="lobby">
    <div class="topbar"><button class="icon-btn" data-act="leave" aria-label="退出">←</button><div class="title">ロビー</div><button class="icon-btn" data-act="rules" aria-label="ルール">📖</button></div>
    <div class="room-card"><div class="lbl">ROOM ID</div><div class="room-id">${esc(roomId)}</div>
      <button class="btn small" data-act="share">🔗 招待リンクを共有</button></div>
    <section><h3>プロデューサー <small>${n}/${G.MAX_PLAYERS}人</small></h3><div class="plist">${slots.join('')}</div></section>
    <section><h3>オリジナル練習生 <small>山札に追加されます（${(S.custom || []).length}/${G.MAX_CUSTOM}）</small></h3>
      ${customs ? `<div class="custom-list">${customs}</div>` : '<p class="hint">名前・能力値・特技を決めて、自分だけの練習生を作れます。</p>'}
      <div style="margin-top:10px"><button class="btn wide" style="width:100%" data-act="openCustom">＋ 練習生を作る</button></div>
      ${saved.length ? `<p class="hint" style="margin-top:12px">前に作った練習生をタップで追加：</p><div class="saved-chips">${saved.map((c, i) => `<button class="opt" data-act="addSaved" data-i="${i}">${esc(c.name)} <small>${c.vo}/${c.da}/${c.vi}</small></button>`).join('')}</div>` : ''}
    </section>
    <div class="bottom-bar">${host
      ? `<button class="btn primary big" data-act="start" ${n < 2 ? 'disabled' : ''}>${n < 2 ? 'あと1人以上集まると開始できます' : `${n}人でゲーム開始！`}</button>`
      : '<div class="waiting">ホストの開始を待っています<span class="dots"></span></div>'}</div>
  </div>`;
}
function savedCustoms() { try { return JSON.parse(savedCustomStore.get() || '[]'); } catch { return []; } }

// ===== ゲーム =====
function viewGame() {
  const my = me();
  if (!my) return '<div class="waiting">観戦できません</div>';
  const th = THEMES[S.theme], hp = HAPPS[S.happening];
  const cur = G.curPlayer(S);
  const myTurn = S.phase === 'turn' && cur.id === pid;
  const mult = G.weekMult(S);
  const lastLog = (S.log || []).slice(-1)[0];

  const opps = S.players.filter(p => p.id !== pid).map(p => {
    let state = '';
    if (S.phase === 'turn' && cur.id === p.id) state = '<span class="state">ターン中</span>';
    else if (S.phase === 'select' && S.picks[p.id]) state = '<span class="state ok">✓ 決定</span>';
    else if (S.phase === 'result' && S.ready[p.id]) state = '<span class="state ok">✓ OK</span>';
    const backs = '<i></i>'.repeat(Math.min(p.hand.length, 8));
    return `<button class="opp ${S.phase === 'turn' && cur.id === p.id ? 'turn' : ''}" data-act="viewOpp" data-id="${p.id}">
      ${state}<div class="top">${avatar(p.name)}<span class="nm">${esc(p.name)}</span></div>
      <div class="fans">${p.fans}<small> ファン</small></div>
      <div class="meta"><span class="backs">${backs}</span><span>${p.hand.length}枚・👥${p.group.length}</span></div>
    </button>`;
  }).join('');

  // フェーズ表示
  let banner;
  if (S.phase === 'turn') {
    banner = myTurn
      ? `<div class="phase-banner mine"><span class="ic">🎯</span><div><div class="t">あなたのターン！</div><div class="s">2枚引きました。手札をタップしてカードを使おう（あと${S.plays}枚）</div></div></div>`
      : `<div class="phase-banner"><span class="ic">⏳</span><div><div class="t">${esc(cur.name)} のターン<span class="dots"></span></div><div class="s">手番順：${S.players.map((p, i) => (i === S.turnIdx ? `<b>${esc(p.name)}</b>` : esc(p.name))).join(' → ')}</div></div></div>`;
  } else if (S.phase === 'select') {
    const done = !!S.picks[pid];
    const cnt = Object.keys(S.picks).length;
    banner = done
      ? `<div class="phase-banner"><span class="ic">🤫</span><div><div class="t">出演メンバー決定済み</div><div class="s">他の事務所を待っています（${cnt}/${S.players.length}）</div></div></div>`
      : `<div class="phase-banner mine"><span class="ic">🎤</span><div><div class="t">出演メンバーを${G.needPicks(S, my)}人選ぼう</div><div class="s">グループの練習生をタップ。選択は一斉公開まで秘密です</div></div></div>`;
  } else if (S.phase === 'result') {
    banner = `<div class="phase-banner"><span class="ic">📺</span><div><div class="t">第${S.week}週の結果発表！</div><div class="s">全員がOKすると次の週へ進みます</div></div></div>`;
  } else {
    banner = '<div class="phase-banner"><span class="ic">🏁</span><div><div class="t">全5週終了！</div></div></div>';
  }

  // 自分のグループ
  const selecting = S.phase === 'select' && !S.picks[pid];
  const picks = S.phase === 'select' ? (S.picks[pid] || ui.picks) : [];
  const grp = my.group.map(e => {
    const d = def(e.cid);
    const blocked = e.block === S.week;
    const pi = picks.indexOf(e.cid);
    let cls = isNew('grp:' + e.cid);
    if (blocked) cls += ' blocked';
    if (selecting && !blocked) cls += ' pickable';
    if (pi >= 0) cls += ' picked';
    else if (S.phase === 'select' && S.picks[pid]) cls += ' dim';
    return tcard(d, e, { act: selecting ? 'pick' : 'viewMember', cls, pickNo: pi >= 0 ? pi + 1 : 0, mult: S.phase !== 'ended' ? soundMult(mult, d) : null, badge: blocked ? '今週出演不可' : (e.block === S.week + 1 ? '来週出演不可' : '') });
  }).join('');
  const empties = Array.from({ length: Math.max(0, G.MAX_GROUP - my.group.length) }, () => '<div class="slot-empty">空き枠</div>').join('');

  let est = '';
  if (S.phase === 'select') {
    const sc = G.stageScore(S, my, picks);
    est = `<div class="est"><span>予想ステージ点${my.comeback ? `（カムバック×${Math.pow(1.5, my.comeback)}）` : ''}</span><b>${sc.total}</b></div>`;
  }

  const multChips = ['vo', 'da', 'vi'].map(k => {
    const v = k === 'vo' && S.happening === 'sound' ? 0 : mult[k];
    return `<span class="mult ${v === 0 ? 'zero' : v >= 2 ? 'up' : ''}">${STAT_NAMES[k]}×${v}</span>`;
  }).join('') + (G.fanMul(S) > 1 ? `<span class="mult up">ファン×${G.fanMul(S)}</span>` : '') +
    (my.comeback ? `<span class="mult up">⚡カムバック×${Math.pow(1.5, my.comeback)}</span>` : '');

  // 手札
  const hand = my.hand.map(cid => anyCard(def(cid), { act: 'openCard', cls: isNew('hand:' + cid) })).join('') || '<div class="empty">手札がありません</div>';

  // アクション
  let actions = '';
  const host = G.isHost(S, pid);
  if (S.phase === 'turn') {
    actions = myTurn
      ? `<span class="msg">カードは最大2枚まで使えます</span><button class="btn primary" data-act="endTurn">ターン終了 ▶</button>`
      : `<span class="msg">${esc(cur.name)} がプレイ中…</span>${host ? '<button class="btn small" data-act="forceEnd">スキップ</button>' : ''}`;
  } else if (S.phase === 'select') {
    if (!S.picks[pid]) {
      const need = G.needPicks(S, my);
      actions = `<span class="msg">${picks.length}/${need}人 選択中</span><button class="btn primary" data-act="submitPicks" ${picks.length !== need ? 'disabled' : ''}>出演決定 🎤</button>`;
    } else {
      actions = `<span class="msg">一斉公開を待っています<span class="dots"></span></span>${host ? '<button class="btn small" data-act="forcePicks">未決定を自動選択</button>' : ''}`;
    }
  } else if (S.phase === 'result') {
    actions = `<span class="msg">${S.ready[pid] ? '他の人を待っています…' : ''}</span><button class="btn primary" data-act="openResult">結果を見る</button>`;
  } else {
    actions = '<span class="msg"></span><button class="btn gold" data-act="openResult">最終結果</button>';
  }

  return `<div class="game">
    <div class="g-head">
      <div class="week"><small>WEEK</small><b>${S.week}</b><i>/${G.WEEKS}</i></div>
      <button class="wchip" data-act="info"><span class="k">THEME</span><span class="v">${th.icon} ${esc(th.name)}</span><span class="e">${esc(th.eff)}</span></button>
      <button class="wchip happ" data-act="info"><span class="k">HAPPENING</span><span class="v">${hp.icon} ${esc(hp.name)}</span><span class="e">${esc(hp.eff)}</span></button>
      <button class="icon-btn" data-act="menu" aria-label="メニュー">☰</button>
    </div>
    <div class="ticker" data-act="menu">${lastLog ? `<b>LOG</b>${esc(lastLog.m)}` : ''}</div>
    <div class="opps">${opps}</div>
    <main class="g-main" data-keep="main">
      ${banner}
      <div class="me-head">${avatar(my.name)}<div class="nm">${esc(my.name)}<small>あなたのグループ ${my.group.length}/${G.MAX_GROUP}人</small></div>
        <div class="fan-big"><b>${my.fans}</b><small>ファン</small></div></div>
      <div class="mult-row">${multChips}</div>
      <div class="group-grid">${grp}${empties}</div>
      ${est}
    </main>
    <div class="dock">
      <div class="hand-head"><span>手札 <b>${my.hand.length}</b>枚</span>
        ${myTurn ? `<span class="plays">プレイ残り ${'<i class="on"></i>'.repeat(S.plays)}${'<i></i>'.repeat(G.PLAYS - S.plays)}</span>` : `<span>山札 ${S.deck.length}枚</span>`}</div>
      <div class="hand" data-keep="hand">${hand}</div>
      <div class="actions">${actions}</div>
    </div>
  </div>`;
}
// 音響トラブル時の表示用倍率（ラッパーはVo有効）
function soundMult(m, d) {
  if (S.happening !== 'sound') return m;
  return { ...m, vo: d.skill === 'ラッパー' ? THEMES[S.theme].mult.vo : 0 };
}

// ===== オーバーレイ（シート・モーダル） =====
function viewOverlays() {
  let html = '';
  if (S && S.status !== 'lobby' && me()) {
    if (S.phase === 'result' && ui.closedResult !== S.results.week) html += viewResult();
    if (S.status === 'ended' && ui.closedResult !== 'end') html += viewEnd();
  }
  if (ui.sheet) {
    const body = sheetBody();
    if (body) html += `<div class="overlay${enter('ov:' + ui.sheet.key)}" data-act="closeSheet"></div><div class="sheet${enter('sh:' + ui.sheet.key)}" data-keep="sheet"><div class="grip"></div>${body}</div>`;
  }
  return html;
}

function openSheet(type, extra = {}) {
  ui.sheet = { type, key: type + ':' + (extra.cid || extra.pid || '') + ':' + Date.now(), prm: {}, ...extra };
  render();
}
function closeSheet() { ui.sheet = null; render(); }

function sheetBody() {
  const sh = ui.sheet;
  switch (sh.type) {
    case 'card': return sheetCard(sh);
    case 'opp': return sheetOpp(sh);
    case 'member': {
      const e = me()?.group.find(x => x.cid === sh.cid);
      if (!e) return null;
      const d = def(sh.cid);
      return `<div class="sheet-card">${tcard(d, e, { cls: ' big' })}</div>
        <div class="desc"><b>特技：${esc(d.skill)}</b><br>${esc(SKILL_DESC[d.skill] || '')}${d.country ? `<br>🌏 海外メンバー（${esc(d.country)}）：「ワールドツアー発表」でさらに1枚引く` : ''}
        ${e.block ? `<span class="warn">第${e.block}週は出演できません</span>` : ''}</div>
        <div class="sheet-actions"><button class="btn wide" data-act="closeSheet">閉じる</button></div>`;
    }
    case 'customView': {
      const d = (S.custom || []).find(c => c.id === sh.cid);
      if (!d) return null;
      return `<div class="sheet-card">${tcard(d, null, { cls: ' big' })}</div>
        <div class="desc"><b>特技：${esc(d.skill)}</b><br>${esc(SKILL_DESC[d.skill] || '')}</div>
        <div class="sheet-actions"><button class="btn wide" data-act="closeSheet">閉じる</button></div>`;
    }
    case 'info': return sheetInfo();
    case 'custom': return sheetCustom(sh);
    case 'menu': return sheetMenu();
    case 'rules': return `<h2>📖 ルール</h2>${rulesHtml()}<div class="sheet-actions"><button class="btn wide" data-act="closeSheet">閉じる</button></div>`;
  }
  return null;
}

// --- カード使用シート ---
function cardSteps(d) {
  if (d.type === 'trainee') return [];
  if (d.type === 'lesson') return d.kind === 'free' ? ['target', 'stat'] : ['target'];
  return { buzz: ['target'], survival: ['target'], challenge: ['opp'], poach: ['opp', 'otarget', 'give'] }[d.kind] || [];
}

function memberOpt(e, key, selected, extra = '') {
  const d = def(e.cid);
  const st = G.memberStats(S, e);
  return `<button class="opt ${selected ? 'sel' : ''}" data-act="param" data-k="${key}" data-v="${e.cid}">${avatar(d.name)}${esc(d.name)}<small>${st.vo}/${st.da}/${st.vi}${extra}</small></button>`;
}

function sheetCard(sh) {
  const my = me();
  if (!my || !my.hand.includes(sh.cid)) return null;
  const d = def(sh.cid);
  const myTurn = S.phase === 'turn' && G.curPlayer(S).id === pid;
  const canUse = myTurn && S.plays > 0;
  const prm = sh.prm;
  let desc = '';
  let warn = '';
  if (d.type === 'trainee') {
    desc = `<b>特技：${esc(d.skill)}</b><br>${esc(SKILL_DESC[d.skill] || '')}${d.country ? `<br>🌏 海外メンバー（${esc(d.country)}）` : ''}<br>使うとグループに加入します。`;
    if (my.group.length >= G.MAX_GROUP) warn = 'グループが満員（5人）のため加入できません';
  } else {
    desc = esc(d.eff) + (d.type === 'lesson' ? '<br><small>※練習生1人に永続で適用</small>' : '');
    if (d.kind === 'reverse' && !my.wasLast) warn = '前週最下位ではないため、使っても効果がありません';
    if (d.kind === 'poach' && my.group.length >= G.MAX_GROUP) warn = 'グループが満員のため引き抜けません';
    if (d.kind === 'monthly') {
      const tot = p => p.group.reduce((t, e) => { const s = G.memberStats(S, e); return t + s.vo + s.da + s.vi; }, 0);
      const best = Math.max(...S.players.map(tot));
      warn = `あなたの合計 ${tot(my)}／全事務所の最高 ${best}`;
    }
    if (d.kind === 'fansign') {
      const mk = my.group.filter(e => def(e.cid).skill === 'マンネ').length;
      warn = `今使うとファン+${my.group.length + mk * 2}`;
    }
  }
  if (!myTurn) warn = (warn ? warn + '<br>' : '') + '自分のターンに使えます';
  else if (S.plays <= 0) warn = 'このターンはもうカードを使えません';

  const steps = cardSteps(d);
  let stepHtml = '';
  let ready = canUse;
  for (const k of steps) {
    if (k === 'target') {
      if (!my.group.length) { ready = false; stepHtml += '<h4>対象の練習生</h4><p class="hint">グループに練習生がいません</p>'; continue; }
      stepHtml += `<h4>対象の練習生を選ぶ</h4><div class="opts">${my.group.map(e => memberOpt(e, 'target', prm.target === e.cid, def(e.cid).skill === 'ビジュアル' && d.kind === 'buzz' ? ' ・効果2倍!' : '')).join('')}</div>`;
      if (!prm.target) ready = false;
    }
    if (k === 'stat') {
      stepHtml += `<h4>上げる能力（+3）</h4><div class="opts">${['vo', 'da', 'vi'].map(s => `<button class="opt ${prm.stat === s ? 'sel' : ''}" data-act="param" data-k="stat" data-v="${s}">${STAT_NAMES[s]} +3</button>`).join('')}</div>`;
      if (!prm.stat) ready = false;
    }
    if (k === 'opp') {
      stepHtml += `<h4>相手の事務所を選ぶ</h4><div class="opts">${S.players.filter(p => p.id !== pid).map(p => `<button class="opt ${prm.opp === p.id ? 'sel' : ''}" data-act="param" data-k="opp" data-v="${p.id}">${avatar(p.name)}${esc(p.name)}<small>${p.fans}ファン・${p.group.length}人</small></button>`).join('')}</div>`;
      if (!prm.opp) ready = false;
    }
    if (k === 'otarget' && prm.opp) {
      const o = G.getP(S, prm.opp);
      stepHtml += `<h4>引き抜く練習生</h4>${o.group.length ? `<div class="opts">${o.group.map(e => memberOpt(e, 'otarget', prm.otarget === e.cid)).join('')}</div>` : '<p class="hint">この事務所には練習生がいません</p>'}`;
      if (!prm.otarget) ready = false;
    } else if (k === 'otarget') ready = false;
    if (k === 'give') {
      const others = my.hand.filter(c => c !== sh.cid);
      if (others.length) {
        stepHtml += `<h4>代わりに相手へ渡す手札</h4><div class="opts">${others.map(c => `<button class="opt ${prm.give === c ? 'sel' : ''}" data-act="param" data-k="give" data-v="${c}">${def(c).type === 'trainee' ? '👤' : def(c).icon} ${esc(def(c).name)}</button>`).join('')}</div>`;
        if (!prm.give) ready = false;
      }
    }
  }
  if ((d.type === 'trainee' || d.kind === 'poach') && my.group.length >= G.MAX_GROUP) ready = false;

  return `<div class="sheet-card">${anyCard(d, { cls: ' big' })}</div>
    <div class="desc">${desc}${warn ? `<span class="warn">${warn}</span>` : ''}</div>
    ${canUse ? stepHtml : ''}
    <div class="sheet-actions"><button class="btn" data-act="closeSheet">閉じる</button>
      ${canUse ? `<button class="btn primary wide" data-act="play" ${ready ? '' : 'disabled'}>${d.type === 'trainee' ? 'グループに加える' : 'このカードを使う'}</button>` : ''}</div>`;
}

function sheetOpp(sh) {
  const p = G.getP(S, sh.pid);
  if (!p) return null;
  const last = S.history?.slice(-1)[0]?.rows.find(r => r.pid === p.id);
  return `<div class="row" style="gap:12px;margin-bottom:12px">${avatar(p.name)}<div style="flex:1"><h2 style="margin:0">${esc(p.name)}</h2>
      <div class="hint">手札 ${p.hand.length}枚${last ? `・前週 ${last.rank}位（${last.total}点）` : ''}</div></div>
      <div class="fan-big"><b>${p.fans}</b><small>ファン</small></div></div>
    <h4>グループ（${p.group.length}/${G.MAX_GROUP}）</h4>
    <div class="grp-row">${p.group.map(e => tcard(def(e.cid), e, { badge: e.block === S.week ? '今週出演不可' : '' })).join('') || '<p class="hint">練習生がいません</p>'}</div>
    ${S.phase === 'select' ? `<p class="hint">${S.picks[p.id] ? '✓ 出演メンバー決定済み（公開までヒミツ）' : '出演メンバーを選択中…'}</p>` : ''}
    <div class="sheet-actions"><button class="btn wide" data-act="closeSheet">閉じる</button></div>`;
}

function sheetInfo() {
  const th = THEMES[S.theme], hp = HAPPS[S.happening];
  const m = G.weekMult(S);
  return `<h2>第${S.week}週の番組</h2>
    <h4>テーマ</h4><div class="desc"><b>${th.icon} ${esc(th.name)}</b><br>${esc(th.eff)}</div>
    <h4>ハプニング</h4><div class="desc"><b>${hp.icon} ${esc(hp.name)}</b><br>${esc(hp.eff)}</div>
    <h4>今週の倍率（掛け算で重なる）</h4>
    <div class="mult-row"><span class="mult">Vo×${S.happening === 'sound' ? '0（ラッパーは' + th.mult.vo + '）' : m.vo}</span><span class="mult">Da×${m.da}</span><span class="mult">Vi×${m.vi}</span><span class="mult">ファン獲得×${G.fanMul(S)}</span></div>
    <h4>ファン獲得</h4><div class="desc">1位 5／2位 3／3位 1／4位 0（同点は同順位）</div>
    <div class="sheet-actions"><button class="btn wide" data-act="closeSheet">閉じる</button></div>`;
}

function sheetMenu() {
  const log = [...(S.log || [])].reverse().map(l => `<div class="${l.m.startsWith('──') ? 'wk' : ''}">${esc(l.m)}</div>`).join('');
  const standings = [...S.players].sort((a, b) => b.fans - a.fans).map(p => `<div class="pitem">${avatar(p.name)}<span class="nm">${esc(p.name)}</span><b style="color:var(--gold)">${p.fans}</b><small class="hint">ファン</small></div>`).join('');
  return `<h2>メニュー</h2>
    <h4>現在の順位</h4><div class="plist">${standings}</div>
    <div class="row" style="margin-top:12px"><button class="btn small" data-act="rules">📖 ルール</button><button class="btn small" data-act="share">🔗 招待リンク</button><button class="btn small" data-act="quit">🚪 退出</button></div>
    <h4>ログ</h4><div class="log-list">${log}</div>
    <div class="sheet-actions"><button class="btn wide" data-act="closeSheet">閉じる</button></div>`;
}

function sheetCustom(sh) {
  const f = sh.form;
  const preview = { id: 'preview', type: 'trainee', name: f.name || 'なまえ', vo: f.vo, da: f.da, vi: f.vi, skill: f.skill, country: f.country.trim(), custom: true };
  const stepper = k => `<div class="stepper"><span class="lb ${k}">${STAT_NAMES[k]}</span>
    <button data-act="cstep" data-k="${k}" data-v="-1">−</button><span class="v">${f[k]}</span><button data-act="cstep" data-k="${k}" data-v="1">＋</button>
    <span class="bar"><i style="width:${f[k] / 9 * 100}%;background:var(--${k})"></i></span></div>`;
  const total = f.vo + f.da + f.vi;
  return `<h2>✨ 練習生を作る</h2>
    <div class="sheet-card">${tcard(preview, null, { cls: ' big' })}</div>
    <div class="form-grid">
      <label class="hint" for="c-name">名前（10文字まで）</label>
      <input id="c-name" class="field" data-bind="c.name" maxlength="10" value="${esc(f.name)}" placeholder="例：ミナ" autocomplete="off">
      <label class="hint">能力値（0〜9）　合計 <b style="color:${total > 12 ? 'var(--gold)' : '#fff'}">${total}</b> <small>※標準カードは合計7〜11程度</small></label>
      ${stepper('vo')}${stepper('da')}${stepper('vi')}
      <label class="hint">特技</label>
      <div class="skill-grid">${SKILL_LIST.map(s => `<button class="opt ${f.skill === s ? 'sel' : ''}" data-act="cskill" data-v="${s}">${esc(s)}<small>${esc(SKILL_DESC[s])}</small></button>`).join('')}</div>
      <label class="hint" for="c-country">出身国（入力すると海外メンバー扱い・空欄でOK）</label>
      <input id="c-country" class="field" data-bind="c.country" maxlength="8" value="${esc(f.country)}" placeholder="例：日本" autocomplete="off">
    </div>
    <div class="sheet-actions"><button class="btn" data-act="closeSheet">やめる</button><button class="btn primary wide" data-act="saveCustom">山札に追加する</button></div>`;
}

// --- 結果モーダル ---
function viewResult() {
  const r = S.results;
  const th = THEMES[r.theme], hp = HAPPS[r.happening];
  const rows = r.rows.map((row, i) => `<div class="rrow ${row.pid === pid ? 'me' : ''}${enter(`rr:${r.week}:${row.pid}`)}" style="--i:${r.rows.length - 1 - i}">
      <div class="hd"><div class="rank r${row.rank}">${row.rank}位</div>
        <div class="nm">${esc(row.name)}<div class="gain">+${row.gain} ファン</div></div>
        <div class="sc"><b>${row.total}</b><small>${row.comeback ? `${row.raw}×${Math.pow(1.5, row.comeback)}` : 'ステージ点'}</small></div></div>
      <div class="perf">${row.lines.map(l => `<span class="pm"><b>${esc(l.name)}</b> ${l.pts}点${l.notes.length ? `<small>${esc(l.notes.join('・'))}</small>` : ''}</span>`).join('') || '<span class="pm">出演者なし</span>'}</div>
      <div class="items">${row.items.map(it => `<span>${esc(it.label)} <b>+${it.v}</b></span>`).join('')}</div>
    </div>`).join('');
  const readyCnt = Object.keys(S.ready || {}).length;
  const host = G.isHost(S, pid);
  return `<div class="overlay${enter('ovr:' + r.week)}"></div><div class="modal${enter('mr:' + r.week)}">
    <h2>📺 第${r.week}週 ステージ結果</h2>
    <div class="sub">${th.icon} ${esc(th.name)}（${esc(th.eff)}）／${hp.icon} ${esc(hp.name)}</div>
    ${rows}
    <div class="modal-actions">
      ${S.ready[pid]
        ? `<div class="waiting">他の人を待っています（${readyCnt}/${S.players.length}）<span class="dots"></span></div>`
        : `<button class="btn primary big" data-act="ready">${S.week >= G.WEEKS ? '最終結果へ ▶' : `OK！第${S.week + 1}週へ ▶`}</button>`}
      ${host && S.ready[pid] ? '<button class="btn small" data-act="forceNext">全員を待たずに進める</button>' : ''}
      <button class="btn ghost small" data-act="closeResult">盤面を見る</button>
    </div></div>`;
}

function viewEnd() {
  const winners = S.final.filter(f => f.rank === 1);
  const iWon = winners.some(w => w.pid === pid);
  const colors = ['#ff5fa2', '#ffd166', '#9b6bff', '#4fc3ff', '#3ee0a0'];
  const confetti = iWon ? `<div class="confetti">${Array.from({ length: 40 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % 5]};animation-duration:${2.5 + Math.random() * 3}s;animation-delay:${Math.random() * 3}s"></i>`).join('')}</div>` : '';
  const rows = S.final.map(f => `<div class="rrow ${f.pid === pid ? 'me' : ''}"><div class="hd"><div class="rank r${f.rank}">${f.rank}位</div><div class="nm">${esc(f.name)}</div><div class="sc"><b>${f.fans}</b><small>ファン</small></div></div></div>`).join('');
  const host = G.isHost(S, pid);
  return `<div class="overlay"></div>${confetti}<div class="modal${enter('end')}">
    <div class="trophy">🏆</div>
    <div class="winner"><span>${winners.map(w => esc(w.name)).join('・')}</span><br>デビュー決定！</div>
    <div class="sub">${iWon ? 'おめでとうございます！あなたの事務所が最多ファンを獲得しました' : '全5週の音楽番組が終了しました'}</div>
    ${rows}
    <div class="modal-actions">
      ${host ? '<button class="btn primary big" data-act="again">もう一度遊ぶ（ロビーへ）</button>' : '<div class="waiting">ホストが「もう一度遊ぶ」を押すとロビーに戻ります</div>'}
      <button class="btn ghost small" data-act="closeEnd">盤面を見る</button>
      <button class="btn ghost small" data-act="quit">退出する</button>
    </div></div>`;
}

function rulesHtml() {
  return `<div class="rules">
    <p>あなたは芸能事務所のプロデューサー。練習生を集めてガールズグループを育て、<b>全5週の音楽番組</b>で勝負！ 5週終了時に<b>ファン数が最多</b>の事務所がデビュー決定（勝利）です。</p>
    <h4>準備</h4><p>各自、練習生2人がグループに入った状態でスタート。手札は4枚。</p>
    <h4>1週の流れ</h4>
    <p>① テーマ1枚とハプニング1枚を公開<br>② 順番に手番：山札から2枚引き、手札から<b>最大2枚</b>使う（練習生をグループに加える／レッスン／イベント）。グループは最大5人<br>③ 全員の手番後、グループから<b>3人</b>（3人未満なら全員）をこっそり選び一斉公開<br>④ 出演者の Vo+Da+Vi にテーマ・ハプニングの倍率と特技ボーナスを足してステージ点を計算<br>⑤ 順位でファン獲得：1位5／2位3／3位1／4位0（同点は同順位）</p>
    <h4>テーマ</h4><table>${Object.values(THEMES).map(t => `<tr><td>${t.icon} ${t.name}</td><td>${t.eff}</td></tr>`).join('')}</table>
    <p class="hint">※倍率は掛け算で重なる（例：バラード回＋ダンスブレイク回 → Vo×2・Da×2）</p>
    <h4>ハプニング</h4><table>${Object.values(HAPPS).map(h => `<tr><td>${h.icon} ${h.name}</td><td>${h.eff}</td></tr>`).join('')}</table>
    <h4>特技</h4><table>${SKILL_LIST.filter(s => s !== 'なし').map(s => `<tr><td>${s}</td><td>${SKILL_DESC[s]}</td></tr>`).join('')}<tr><td>海外メンバー</td><td>「ワールドツアー発表」でさらに1枚引く</td></tr></table>
    <h4>レッスン（練習生1人に永続）</h4><table><tr><td>🎙️ ボイトレ合宿</td><td>Vo+2</td></tr><tr><td>👟 ダンス特訓</td><td>Da+2</td></tr><tr><td>💄 イメチェン</td><td>Vi+2</td></tr><tr><td>📚 総合レッスン</td><td>全能力+1</td></tr><tr><td>✨ 個人レッスン</td><td>好きな能力+3</td></tr></table>
    <h4>イベント</h4><table>
      <tr><td>📱 直カムがバズった！</td><td>練習生1人のVi+2、ファン+3</td></tr><tr><td>🎬 チャレンジ動画</td><td>他事務所1つを選び、両者ファン+2</td></tr>
      <tr><td>✍️ ファンサイン会</td><td>ファン+グループ人数</td></tr><tr><td>🔥 サバイバル番組</td><td>練習生1人の全能力+1、次の週は出演不可</td></tr>
      <tr><td>📋 月末評価</td><td>グループの能力合計が全事務所で最高ならファン+4</td></tr><tr><td>📈 逆走</td><td>前週最下位ならファン+5</td></tr>
      <tr><td>🤝 引き抜き交渉</td><td>相手の練習生1人を自分のグループへ。代わりに手札1枚を相手に渡す</td></tr><tr><td>⚡ 電撃カムバック</td><td>今週の自分のステージ点×1.5</td></tr></table>
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
  start() { act(s => G.startGame(s, pid)); },
  openCustom() {
    openSheet('custom', { form: { name: '', vo: 2, da: 2, vi: 2, skill: 'なし', country: '' } });
  },
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
      list.unshift({ name: f.name.trim(), vo: f.vo, da: f.da, vi: f.vi, skill: f.skill, country: f.country.trim() });
      savedCustomStore.set(JSON.stringify(list.slice(0, 12)));
      toast(`「${f.name.trim()}」を山札に追加しました`);
      closeSheet();
    }
  },
  addSaved(ds) {
    const saved = savedCustoms().filter(sc => !(S.custom || []).some(c => c.name === sc.name && c.vo === sc.vo && c.da === sc.da && c.vi === sc.vi));
    const c = saved[Number(ds.i)];
    if (c) act(s => G.addCustom(s, pid, c));
  },
  delCustom(ds) { act(s => G.removeCustom(s, pid, ds.id)); },
  viewCustom(ds) { openSheet('customView', { cid: ds.cid }); },
  viewOpp(ds) { openSheet('opp', { pid: ds.id }); },
  viewMember(ds) { openSheet('member', { cid: ds.cid }); },
  openCard(ds) { openSheet('card', { cid: ds.cid }); },
  param(ds) {
    const prm = ui.sheet.prm;
    prm[ds.k] = ds.v;
    if (ds.k === 'opp') delete prm.otarget;
    render();
  },
  async play() {
    const { cid, prm } = ui.sheet;
    const p = { ...prm };
    if (prm.otarget) p.target = prm.otarget;
    const d = def(cid);
    const r = await act(s => G.playCard(s, pid, cid, p));
    if (r && !r.error) { ui.sheet = null; render(); toast(`${d.type === 'trainee' ? '👤' : d.icon} ${d.name}`, 'hi'); }
  },
  endTurn() {
    const my = me();
    if (S.plays > 0 && my.hand.length && !confirm(`まだ${S.plays}枚使えます。ターンを終了しますか？`)) return;
    act(s => G.endTurn(s, pid));
  },
  forceEnd() {
    if (confirm(`${G.curPlayer(S).name} のターンを強制終了しますか？`)) act(s => G.endTurn(s, pid, true));
  },
  pick(ds) {
    if (S.phase !== 'select' || S.picks[pid]) return;
    const my = me();
    const e = my.group.find(x => x.cid === ds.cid);
    if (!e || e.block === S.week) return toast('この練習生は今週出演できません', 'err');
    const i = ui.picks.indexOf(ds.cid);
    if (i >= 0) ui.picks.splice(i, 1);
    else if (ui.picks.length >= G.needPicks(S, my)) return toast(`出演できるのは${G.needPicks(S, my)}人までです`, 'err');
    else ui.picks.push(ds.cid);
    render();
  },
  async submitPicks() {
    const picks = [...ui.picks];
    const r = await act(s => G.submitPicks(s, pid, picks));
    if (r && !r.error) toast('出演メンバーを決定しました！');
  },
  forcePicks() {
    if (confirm('まだ選んでいない人の出演メンバーを自動で決めますか？')) act(s => G.forcePicks(s, pid));
  },
  ready() { act(s => G.readyNext(s, pid)); },
  forceNext() { if (confirm('全員を待たずに次へ進みますか？')) act(s => G.readyNext(s, pid, true)); },
  closeResult() { ui.closedResult = S.results.week; render(); },
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
    // プレビューだけ更新（入力中のフォーカスを保つため全体再描画しない）
    const prev = app.querySelector('.sheet .sheet-card');
    const f = ui.sheet.form;
    if (prev) prev.innerHTML = tcard({ id: 'preview', type: 'trainee', name: f.name || 'なまえ', vo: f.vo, da: f.da, vi: f.vi, skill: f.skill, country: f.country.trim(), custom: true }, null, { cls: ' big' });
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
  unsub = null; S = null; roomId = null; ui.sheet = null; ui.picks = [];
  roomStore.del();
  history.replaceState(null, '', location.pathname);
  render();
}

function onState(st) {
  const prev = S;
  if (!st) { if (prev) toast('部屋がなくなりました', 'err'); exitRoom(); return; }
  if (!st.players.some(p => p.id === pid)) { toast('部屋から退出しました'); exitRoom(); return; }
  S = st;
  // 通知
  if (prev && st.status === 'playing') {
    const myTurnNow = st.phase === 'turn' && G.curPlayer(st).id === pid;
    const myTurnBefore = prev.status === 'playing' && prev.phase === 'turn' && G.curPlayer(prev).id === pid;
    if (myTurnNow && !myTurnBefore) { toast('🎯 あなたのターンです！', 'hi'); navigator.vibrate?.(120); }
    if (st.phase === 'select' && prev.phase !== 'select') { toast('🎤 出演メンバーを選んでください', 'hi'); navigator.vibrate?.(80); }
    if (prev.week !== st.week) { ui.closedResult = 0; }
  }
  if (prev && prev.status !== 'lobby' && st.status === 'lobby') { seen.clear(); ui.closedResult = 0; }
  if (st.phase !== 'select') ui.picks = [];
  else ui.picks = ui.picks.filter(c => me()?.group.some(e => e.cid === c && e.block !== st.week));
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
