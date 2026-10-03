// ===== ゲームロジック（純粋関数：状態を受け取り、変更して返す） =====
import { STD_CARDS, THEMES, HAPPS, TRAINEE_IDS, LESSON_IDS, EVENT_IDS, SKILL_LIST } from './cards.js';

export const MAX_PLAYERS = 4, MAX_GROUP = 5, WEEKS = 5, PLAYS = 2, DRAWS = 2, START_HAND = 4, MAX_CUSTOM = 20;
const FAN_TABLE = [5, 3, 1, 0];

const err = m => { throw new Error(m); };
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const entry = cid => ({ cid, b: { vo: 0, da: 0, vi: 0 }, block: 0 });

export const getP = (s, pid) => s.players.find(p => p.id === pid);
export const cardDef = (s, cid) => STD_CARDS[cid] || (s.custom || []).find(c => c.id === cid);
export const isHost = (s, pid) => s.hostId === pid;
export const curPlayer = s => s.players[s.turnIdx];

export function memberStats(s, e) {
  const d = cardDef(s, e.cid);
  return { vo: d.vo + e.b.vo, da: d.da + e.b.da, vi: d.vi + e.b.vi };
}
const groupTotal = (s, p) => p.group.reduce((t, e) => {
  const st = memberStats(s, e);
  return t + st.vo + st.da + st.vi;
}, 0);

function addLog(s, m) {
  s.log = s.log || [];
  s.log.push({ w: s.week || 0, m });
  if (s.log.length > 120) s.log = s.log.slice(-120);
}

function draw(s, p, n) {
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      if (!s.discard.length) break;
      s.deck = shuffle(s.discard);
      s.discard = [];
      addLog(s, '捨て札をシャッフルして山札に戻しました');
    }
    p.hand.push(s.deck.pop());
    c++;
  }
  return c;
}

// ---------- ロビー ----------
export function joinRoom(s, pid, name, roomId) {
  name = (name || '').trim().slice(0, 10);
  if (!name) err('名前を入力してください');
  if (!s) {
    return { roomId, status: 'lobby', hostId: pid, players: [{ id: pid, name }], custom: [], log: [], created: Date.now() };
  }
  const p = getP(s, pid);
  if (p) {
    if (s.status === 'lobby') p.name = name;
    return s;
  }
  // 同じ名前なら同じ席として再入室（端末変更・タブを閉じた場合の復帰用）
  if (s.players.some(x => x.name === name)) return s;
  if (s.status !== 'lobby') err('ゲーム進行中のため参加できません（参加中の人は同じ名前で再入室できます）');
  if (s.players.length >= MAX_PLAYERS) err('満員です（最大4人）');
  s.players.push({ id: pid, name });
  addLog(s, `${name} が入室しました`);
  return s;
}

export function leaveRoom(s, pid) {
  if (!s) return s;
  if (s.status !== 'lobby') return s; // 進行中は席を残す
  const p = getP(s, pid);
  if (!p) return s;
  s.players = s.players.filter(x => x.id !== pid);
  if (!s.players.length) return null; // 部屋を削除
  if (s.hostId === pid) s.hostId = s.players[0].id;
  addLog(s, `${p.name} が退出しました`);
  return s;
}

export function addCustom(s, pid, c) {
  if (s.status !== 'lobby') err('ロビーでのみ追加できます');
  s.custom = s.custom || [];
  if (s.custom.length >= MAX_CUSTOM) err(`オリジナル練習生は${MAX_CUSTOM}人までです`);
  const name = String(c.name || '').trim().slice(0, 10);
  if (!name) err('練習生の名前を入力してください');
  const num = v => Math.max(0, Math.min(9, Math.floor(Number(v) || 0)));
  const skill = SKILL_LIST.includes(c.skill) ? c.skill : 'なし';
  const id = 'C' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  s.custom.push({
    id, type: 'trainee', custom: true, owner: pid, star: false,
    name, vo: num(c.vo), da: num(c.da), vi: num(c.vi), skill,
    country: String(c.country || '').trim().slice(0, 8),
  });
  addLog(s, `オリジナル練習生「${name}」が追加されました`);
  return s;
}

export function removeCustom(s, pid, id) {
  if (s.status !== 'lobby') err('ロビーでのみ削除できます');
  const c = (s.custom || []).find(x => x.id === id);
  if (!c) return s;
  if (c.owner !== pid && s.hostId !== pid) err('作成者かホストだけが削除できます');
  s.custom = s.custom.filter(x => x.id !== id);
  return s;
}

// ---------- ゲーム開始 ----------
export function startGame(s, pid) {
  if (!isHost(s, pid)) err('ホストだけが開始できます');
  if (s.status !== 'lobby') err('すでに開始しています');
  if (s.players.length < 2) err('2人以上で開始できます');
  const trainees = shuffle([...TRAINEE_IDS, ...(s.custom || []).map(c => c.id)]);
  s.players.forEach(p => {
    Object.assign(p, { fans: 0, hand: [], group: [], comeback: 0, lastRank: 0, wasLast: false });
    p.group.push(entry(trainees.pop()), entry(trainees.pop()));
  });
  s.deck = shuffle([...trainees, ...LESSON_IDS, ...EVENT_IDS]);
  s.discard = [];
  s.players.forEach(p => draw(s, p, START_HAND));
  s.themeDeck = shuffle(Object.keys(THEMES));
  s.happDeck = shuffle(Object.keys(HAPPS));
  Object.assign(s, {
    status: 'playing', week: 0, firstIdx: Math.floor(Math.random() * s.players.length),
    results: null, history: [], scandal: null, log: [],
  });
  addLog(s, 'ゲーム開始！ 全5週の音楽番組で勝負！');
  startWeek(s);
  return s;
}

function startWeek(s) {
  s.week++;
  Object.assign(s, { phase: 'turn', picks: {}, ready: {}, turnsDone: 0 });
  s.players.forEach(p => { p.comeback = 0; });
  s.theme = s.themeDeck.pop();
  s.happening = s.happDeck.pop();
  const th = THEMES[s.theme], hp = HAPPS[s.happening];
  addLog(s, `── 第${s.week}週 ── テーマ「${th.name}」／ハプニング「${hp.name}」`);
  if (s.scandal) {
    const p = getP(s, s.scandal.pid);
    if (p) { p.fans += 4; addLog(s, `${p.name}：兄妹と判明して好感度アップ！ ファン+4`); }
    s.scandal = null;
  }
  if (hp.id === 'tour') {
    s.players.forEach(p => {
      const extra = p.group.filter(e => cardDef(s, e.cid)?.country).length;
      const n = draw(s, p, 1 + extra);
      addLog(s, `${p.name}：ワールドツアーで${n}枚ドロー${extra ? `（海外メンバー+${extra}）` : ''}`);
    });
  }
  if (hp.id === 'scandal') {
    const p = s.players[Math.floor(Math.random() * s.players.length)];
    p.fans -= 2;
    s.scandal = { pid: p.id };
    addLog(s, `${p.name}：熱愛報道！？ ファン-2（翌週+4）`);
  }
  s.turnIdx = (s.firstIdx + s.week - 1) % s.players.length;
  beginTurn(s);
}

function beginTurn(s) {
  const p = curPlayer(s);
  const n = draw(s, p, DRAWS);
  s.plays = PLAYS;
  addLog(s, `${p.name} のターン（${n}枚ドロー）`);
}

// ---------- 手番 ----------
export function playCard(s, pid, cid, prm = {}) {
  if (s.status !== 'playing' || s.phase !== 'turn') err('今はカードを使えません');
  const p = curPlayer(s);
  if (p.id !== pid) err('あなたのターンではありません');
  if (s.plays <= 0) err('このターンはもうカードを使えません');
  if (!p.hand.includes(cid)) err('手札にありません');
  const d = cardDef(s, cid);
  const myE = id => p.group.find(x => x.cid === id) || err('対象の練習生を選んでください');
  const removeFromHand = () => p.hand.splice(p.hand.indexOf(cid), 1);
  const nm = id => cardDef(s, id).name;
  let msg = '';

  if (d.type === 'trainee') {
    if (p.group.length >= MAX_GROUP) err('グループは最大5人です');
    removeFromHand();
    p.group.push(entry(cid));
    msg = `${p.name}：${d.name} がグループに加入！`;
  } else if (d.type === 'lesson') {
    const e = myE(prm.target);
    let eff = d.eff;
    if (d.kind === 'all') { e.b.vo++; e.b.da++; e.b.vi++; }
    else if (d.kind === 'free') {
      if (!['vo', 'da', 'vi'].includes(prm.stat)) err('上げる能力を選んでください');
      e.b[prm.stat] += 3;
      eff = `${prm.stat === 'vo' ? 'Vo' : prm.stat === 'da' ? 'Da' : 'Vi'}+3`;
    } else e.b[d.kind] += 2;
    removeFromHand();
    s.discard.push(cid);
    msg = `${p.name}：${nm(e.cid)} に「${d.name}」（${eff}）`;
  } else {
    switch (d.kind) {
      case 'buzz': {
        const e = myE(prm.target);
        const x = cardDef(s, e.cid).skill === 'ビジュアル' ? 2 : 1;
        e.b.vi += 2 * x;
        p.fans += 3 * x;
        msg = `${p.name}：${nm(e.cid)} の直カムがバズった！ Vi+${2 * x}、ファン+${3 * x}`;
        break;
      }
      case 'challenge': {
        const o = getP(s, prm.opp);
        if (!o || o.id === pid) err('相手の事務所を選んでください');
        p.fans += 2; o.fans += 2;
        msg = `${p.name}：${o.name} とチャレンジ動画！ 両者ファン+2`;
        break;
      }
      case 'fansign': {
        const mk = p.group.filter(e => cardDef(s, e.cid).skill === 'マンネ').length;
        const g = p.group.length + mk * 2;
        p.fans += g;
        msg = `${p.name}：ファンサイン会でファン+${g}${mk ? `（マンネ効果+${mk * 2}）` : ''}`;
        break;
      }
      case 'survival': {
        const e = myE(prm.target);
        e.b.vo++; e.b.da++; e.b.vi++;
        e.block = s.week + 1;
        msg = `${p.name}：${nm(e.cid)} がサバイバル番組に出演！ 全能力+1（第${s.week + 1}週は出演不可）`;
        break;
      }
      case 'monthly': {
        const mine = groupTotal(s, p);
        const best = Math.max(...s.players.map(q => groupTotal(s, q)));
        if (mine >= best) { p.fans += 4; msg = `${p.name}：月末評価でトップ（合計${mine}）！ ファン+4`; }
        else msg = `${p.name}：月末評価…トップに届かず（合計${mine}／最高${best}）`;
        break;
      }
      case 'reverse': {
        if (p.wasLast) { p.fans += 5; msg = `${p.name}：最下位からの逆走！ ファン+5`; }
        else msg = `${p.name}：逆走…しかし前週は最下位ではなかった`;
        break;
      }
      case 'poach': {
        const o = getP(s, prm.opp);
        if (!o || o.id === pid) err('相手の事務所を選んでください');
        if (p.group.length >= MAX_GROUP) err('グループが満員（5人）です');
        const ei = o.group.findIndex(x => x.cid === prm.target);
        if (ei < 0) err('引き抜く練習生を選んでください');
        const others = p.hand.filter(c => c !== cid);
        if (others.length && !others.includes(prm.give)) err('相手に渡すカードを選んでください');
        const [e] = o.group.splice(ei, 1);
        p.group.push(e);
        if (others.length) {
          p.hand.splice(p.hand.indexOf(prm.give), 1);
          o.hand.push(prm.give);
        }
        msg = `${p.name}：${o.name} から ${nm(e.cid)} を引き抜き！${others.length ? '（手札1枚を渡した）' : ''}`;
        break;
      }
      case 'comeback':
        p.comeback = (p.comeback || 0) + 1;
        msg = `${p.name}：電撃カムバック！ 今週のステージ点×1.5`;
        break;
      default: err('不明なカードです');
    }
    removeFromHand();
    s.discard.push(cid);
  }
  s.plays--;
  addLog(s, msg);
  return s;
}

export function endTurn(s, pid, force = false) {
  if (s.status !== 'playing' || s.phase !== 'turn') err('今はターン終了できません');
  const cur = curPlayer(s);
  if (cur.id !== pid) {
    if (!(force && isHost(s, pid))) err('あなたのターンではありません');
    addLog(s, `ホストが ${cur.name} のターンを終了させました`);
  }
  s.turnsDone++;
  if (s.turnsDone >= s.players.length) enterSelect(s);
  else {
    s.turnIdx = (s.turnIdx + 1) % s.players.length;
    beginTurn(s);
  }
  return s;
}

// ---------- 出演メンバー選択 ----------
export const eligible = (s, p) => p.group.filter(e => e.block !== s.week).map(e => e.cid);
export const needPicks = (s, p) => Math.min(3, eligible(s, p).length);

function enterSelect(s) {
  s.phase = 'select';
  s.picks = {};
  addLog(s, '全員の手番終了！ 出演メンバーを選んでください');
  s.players.forEach(p => { if (needPicks(s, p) === 0) s.picks[p.id] = []; });
  checkAllPicked(s);
}

export function submitPicks(s, pid, picks) {
  if (s.status !== 'playing' || s.phase !== 'select') err('今は選択できません');
  const p = getP(s, pid);
  if (s.picks[pid]) err('すでに決定済みです');
  const el = eligible(s, p);
  const uniq = [...new Set(picks || [])];
  if (uniq.length !== needPicks(s, p)) err(`${needPicks(s, p)}人選んでください`);
  if (!uniq.every(c => el.includes(c))) err('選べないメンバーが含まれています');
  s.picks[pid] = uniq;
  addLog(s, `${p.name} が出演メンバーを決定`);
  checkAllPicked(s);
  return s;
}

// ホスト用：未決定の人のメンバーを自動決定
export function forcePicks(s, pid) {
  if (!isHost(s, pid)) err('ホストだけが操作できます');
  if (s.phase !== 'select') return s;
  s.players.forEach(p => {
    if (s.picks[p.id]) return;
    const el = eligible(s, p);
    const sc = cid => stageScore(s, p, [cid]).total;
    s.picks[p.id] = el.sort((a, b) => sc(b) - sc(a)).slice(0, 3);
    addLog(s, `ホストが ${p.name} の出演メンバーを自動決定`);
  });
  checkAllPicked(s);
  return s;
}

function checkAllPicked(s) {
  if (s.players.every(p => s.picks[p.id])) resolveStage(s);
}

export function weekMult(s) {
  const th = THEMES[s.theme], hp = HAPPS[s.happening];
  const m = { ...th.mult };
  if (hp.id === 'dance') m.da *= 2;
  if (hp.id === 'visual') m.vi *= 2;
  return m;
}
export const fanMul = s => THEMES[s.theme].fanMul * (s.happening === 'award' ? 2 : 1);

// ステージ点計算
export function stageScore(s, p, picks) {
  const m = weekMult(s);
  const th = THEMES[s.theme];
  const sound = s.happening === 'sound';
  const mem = (picks || []).map(cid => {
    const e = p.group.find(x => x.cid === cid);
    return e ? { cid, d: cardDef(s, cid), st: memberStats(s, e) } : null;
  }).filter(Boolean);
  const has = sk => mem.some(x => x.d.skill === sk);
  const centers = mem.filter(x => x.d.skill === 'センター').length;
  const lines = mem.map(x => {
    const sk = x.d.skill;
    const vm = sound ? (sk === 'ラッパー' ? th.mult.vo : 0) : m.vo;
    const base = x.st.vo * vm + x.st.da * m.da + x.st.vi * m.vi;
    const notes = [];
    let bonus = 0;
    if (sk === 'メインボーカル' && vm >= 2) { bonus += 2; notes.push('メインボーカル+2'); }
    if (sk === 'メインダンサー' && m.da >= 2) { bonus += 2; notes.push('メインダンサー+2'); }
    if (sk === 'リードボーカル' && has('メインボーカル')) { bonus += 1; notes.push('リードボーカル+1'); }
    if (sk === 'リードダンサー' && has('メインダンサー')) { bonus += 1; notes.push('リードダンサー+1'); }
    const oc = centers - (sk === 'センター' ? 1 : 0);
    if (oc > 0) { bonus += oc; notes.push(`センター効果+${oc}`); }
    if (sk === 'オールラウンダー') { bonus += 1; notes.push('オールラウンダー+1'); }
    if (sound && sk === 'ラッパー') notes.push('ラッパー：Vo有効');
    return { cid: x.cid, name: x.d.name, st: x.st, vm, base, bonus, pts: base + bonus, notes };
  });
  const raw = lines.reduce((t, l) => t + l.pts, 0);
  const cb = p.comeback || 0;
  const total = cb ? Math.floor(raw * Math.pow(1.5, cb)) : raw;
  return { total, raw, comeback: cb, lines, mult: m };
}

function resolveStage(s) {
  const hp = HAPPS[s.happening];
  const fm = fanMul(s);
  const rows = s.players.map(p => ({ pid: p.id, name: p.name, picks: s.picks[p.id] || [], ...stageScore(s, p, s.picks[p.id] || []) }));
  rows.forEach(r => { r.rank = 1 + rows.filter(o => o.total > r.total).length; });
  const maxRank = Math.max(...rows.map(r => r.rank));
  rows.forEach(r => {
    const p = getP(s, r.pid);
    const items = [];
    let base = FAN_TABLE[r.rank - 1] ?? 0;
    if (hp.id === 'overlap' && r.rank !== 1) {
      items.push({ label: `${r.rank}位（活動時期かぶり）`, v: 0 });
    } else {
      items.push({ label: `${r.rank}位${fm > 1 ? `（×${fm}）` : ''}`, v: base * fm });
    }
    const leaders = p.group.filter(e => cardDef(s, e.cid).skill === 'リーダー').length;
    if (leaders) items.push({ label: `リーダー${leaders > 1 ? `×${leaders}` : ''}`, v: leaders });
    if (hp.id === 'penlight' && p.group.length >= MAX_GROUP) items.push({ label: 'ペンライトの海', v: 3 });
    r.items = items;
    r.gain = items.reduce((t, i) => t + i.v, 0);
    p.fans += r.gain;
    p.lastRank = r.rank;
    p.wasLast = maxRank > 1 && r.rank === maxRank;
  });
  rows.sort((a, b) => a.rank - b.rank);
  s.results = { week: s.week, theme: s.theme, happening: s.happening, rows };
  s.history.push({ week: s.week, rows: rows.map(r => ({ pid: r.pid, total: r.total, rank: r.rank, gain: r.gain })) });
  s.phase = 'result';
  s.ready = {};
  addLog(s, `第${s.week}週の結果：` + rows.map(r => `${r.rank}位 ${r.name}（${r.total}点・ファン+${r.gain}）`).join(' / '));
}

export function readyNext(s, pid, force = false) {
  if (s.status !== 'playing' || s.phase !== 'result') return s;
  if (force && !isHost(s, pid)) err('ホストだけが操作できます');
  s.ready[pid] = true;
  if (force || s.players.every(p => s.ready[p.id])) {
    if (s.week >= WEEKS) finish(s);
    else startWeek(s);
  }
  return s;
}

function finish(s) {
  if (s.scandal) {
    const p = getP(s, s.scandal.pid);
    if (p) { p.fans += 4; addLog(s, `${p.name}：最終集計で兄妹と判明！ ファン+4`); }
    s.scandal = null;
  }
  s.status = 'ended';
  s.phase = 'ended';
  const sorted = [...s.players].sort((a, b) => b.fans - a.fans);
  s.final = sorted.map(p => ({ pid: p.id, name: p.name, fans: p.fans, rank: 1 + s.players.filter(o => o.fans > p.fans).length }));
  const winners = s.final.filter(f => f.rank === 1).map(f => f.name);
  addLog(s, `🎉 デビュー決定：${winners.join('・')}！`);
}

export function backToLobby(s, pid) {
  if (!isHost(s, pid)) err('ホストだけが操作できます');
  const keep = { roomId: s.roomId, status: 'lobby', hostId: s.hostId, custom: s.custom || [], created: s.created, log: [] };
  keep.players = s.players.map(p => ({ id: p.id, name: p.name }));
  return keep;
}
