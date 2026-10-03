// ===== ゲームロジック（純粋関数：状態を受け取り、変更して返す） =====
import {
  STATS, STAT_NAMES, TYPES, MISSIONS, TEAM_SIZE, SONG_CHOICES, SONGS, NEED, FAIL_MULT, MATE_RATE, VOTES,
  CARDS, TRAIN_IDS, ACTION_IDS, TARGETED, TRAITS, NPCS, NPC_IDS, HAPPS,
} from './cards.js';

export const MAX_PLAYERS = 4, MAX_CUSTOM = 20;
export const TRAIN_USES = 2, ACTION_SETS = 2;
const TRAIN_START = 3, TRAIN_DRAW = 2, TRAIN_MAX = 6;
const ACT_START = 2, ACT_DRAW = 2, ACT_MAX = 5;
export const WEEKS = MISSIONS.length;

const err = m => { throw new Error(m); };
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const getP = (s, pid) => s.players.find(p => p.id === pid);
export const isHost = (s, pid) => s.hostId === pid;
export const npcDef = (s, cid) => NPCS[cid] || (s.custom || []).find(c => c.id === cid);
export const mission = s => MISSIONS[s.mission - 1];
export const curSong = s => SONGS[s.song];
export const mainStat = so => STATS.reduce((a, k) => (so.w[k] > so.w[a] ? k : a), 'vo');
export const needOf = so => NEED[so.diff];

function addLog(s, m) {
  s.log = s.log || [];
  s.log.push({ w: s.mission || 0, m });
  if (s.log.length > 200) s.log = s.log.slice(-200);
}

// ---------- 待機室 ----------
export function joinRoom(s, pid, name, roomId) {
  name = (name || '').trim().slice(0, 10);
  if (!name) err('名前を入力してください');
  // 部屋がない、または旧バージョンの部屋なら新しく作る
  if (!s || s.v !== 4) return { v: 4, roomId, status: 'lobby', hostId: pid, players: [{ id: pid, name, type: 'allround' }], custom: [], log: [], created: Date.now() };
  const p = getP(s, pid);
  if (p) {
    if (s.status === 'lobby') p.name = name;
    return s;
  }
  if (s.players.some(x => x.name === name)) return s; // 同じ名前なら同じ席に再入室
  if (s.status !== 'lobby') err('ゲーム進行中のため参加できません（参加中の人は同じ名前で再入室できます）');
  if (s.players.length >= MAX_PLAYERS) err('満員です（最大4人）');
  s.players.push({ id: pid, name, type: 'allround' });
  addLog(s, `${name} が入室しました`);
  return s;
}

export function leaveRoom(s, pid) {
  if (!s || s.status !== 'lobby') return s;
  const p = getP(s, pid);
  if (!p) return s;
  s.players = s.players.filter(x => x.id !== pid);
  if (!s.players.length) return null;
  if (s.hostId === pid) s.hostId = s.players[0].id;
  addLog(s, `${p.name} が退出しました`);
  return s;
}

export function setType(s, pid, type) {
  if (s.status !== 'lobby') err('待機室でのみ変更できます');
  if (!TYPES[type]) err('不明なタイプです');
  getP(s, pid).type = type;
  return s;
}

export function addCustom(s, pid, c) {
  if (s.status !== 'lobby') err('待機室でのみ追加できます');
  s.custom = s.custom || [];
  if (s.custom.length >= MAX_CUSTOM) err(`オリジナル練習生は${MAX_CUSTOM}人までです`);
  const name = String(c.name || '').trim().slice(0, 10);
  if (!name) err('練習生の名前を入力してください');
  const num = v => Math.max(0, Math.min(9, Math.floor(Number(v) || 0)));
  const id = 'C' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  s.custom.push({
    id, custom: true, owner: pid, name, vo: num(c.vo), da: num(c.da), ra: num(c.ra), vi: num(c.vi),
    trait: TRAITS[c.trait] ? c.trait : 'leader', country: String(c.country || '').trim().slice(0, 8),
  });
  addLog(s, `オリジナル練習生「${name}」が番組に参加！`);
  return s;
}

export function removeCustom(s, pid, id) {
  if (s.status !== 'lobby') err('待機室でのみ削除できます');
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
  s.tdeck = shuffle([...TRAIN_IDS]); s.tdiscard = [];
  s.adeck = shuffle([...ACTION_IDS]); s.adiscard = [];
  s.players.forEach(p => {
    Object.assign(p, { st: { ...(TYPES[p.type] || TYPES.allround).st }, votes: 0, rank: 1, train: [], act: [], r: null, chose: 0 });
    drawTo(s, p, 'train', TRAIN_START);
    drawTo(s, p, 'act', ACT_START);
  });
  Object.assign(s, { status: 'playing', mission: 0, played: [], priority: [], results: null, history: [], log: [] });
  addLog(s, 'オーディション番組スタート！');
  startMission(s);
  return s;
}

function drawTo(s, p, kind, n) {
  const [deck, disc, max] = kind === 'train' ? ['tdeck', 'tdiscard', TRAIN_MAX] : ['adeck', 'adiscard', ACT_MAX];
  for (let i = 0; i < n && p[kind].length < max; i++) {
    if (!s[deck].length) {
      if (!s[disc].length) break;
      s[deck] = shuffle(s[disc]);
      s[disc] = [];
    }
    p[kind].push(s[deck].pop());
  }
}

function startMission(s) {
  s.mission++;
  const M = mission(s);
  s.ready = {};
  s.players.forEach(p => {
    p.r = { mates: [], used: 0, set: [], ready: false };
    drawTo(s, p, 'train', TRAIN_DRAW);
    drawTo(s, p, 'act', ACT_DRAW);
  });
  // 選曲担当：まだ選んだ回数が少ない人の中からランダム
  const minC = Math.min(...s.players.map(p => p.chose));
  const by = pick(s.players.filter(p => p.chose === minC));
  const unplayed = Object.keys(SONGS).filter(k => !s.played.includes(k));
  let choices = shuffle(unplayed.filter(k => M.diffs.includes(SONGS[k].diff))).slice(0, SONG_CHOICES);
  if (choices.length < SONG_CHOICES) choices = choices.concat(shuffle(unplayed.filter(k => !choices.includes(k))).slice(0, SONG_CHOICES - choices.length));
  s.songPick = { by: by.id, choices };
  s.song = null;
  s.phase = 'song';
  addLog(s, `── 第${s.mission}課題「${M.name}」── 選曲担当は ${by.name}`);
}

// ---------- 選曲 ----------
export function chooseSong(s, pid, songId) {
  if (s.status !== 'playing' || s.phase !== 'song') err('今は選曲の時間ではありません');
  if (s.songPick.by !== pid) err('選曲担当ではありません');
  if (!s.songPick.choices.includes(songId)) err('その曲は選べません');
  const p = getP(s, pid);
  p.chose++;
  s.song = songId;
  s.played.push(songId);
  addLog(s, `${p.name} が課題曲「${SONGS[songId].name}」を選びました`);
  startDraft(s);
  return s;
}

// ---------- メンバー選び（指名 or 押し付け） ----------
function startDraft(s) {
  const base = [...s.players].sort((a, b) => a.votes - b.votes || Math.random() - 0.5).map(p => p.id);
  const pri = (s.priority || []).filter(id => base.includes(id));
  const order = [...new Set([...pri, ...base])];
  const all = [...NPC_IDS, ...(s.custom || []).map(c => c.id)];
  s.draft = { pool: shuffle(all).slice(0, s.players.length * TEAM_SIZE + 2), order, idx: 0, taken: {} };
  s.priority = [];
  s.phase = 'draft';
  addLog(s, `メンバー選び：指名順 ${order.map(id => getP(s, id).name).join(' → ')}${pri.length ? '（優先指名権あり）' : ''}`);
}

export const drafter = s => (s.phase === 'draft' ? s.draft.order[s.draft.idx % s.draft.order.length] : null);
export const hasSlot = p => p.r.mates.length < TEAM_SIZE;

export function draftPick(s, pid, cid, toPid) {
  if (s.status !== 'playing' || s.phase !== 'draft') err('今はメンバー選びではありません');
  if (drafter(s) !== pid) err('あなたの指名の番ではありません');
  if (!s.draft.pool.includes(cid) || s.draft.taken[cid]) err('その練習生は選べません');
  const to = getP(s, toPid || pid);
  if (!to) err('相手が見つかりません');
  if (!hasSlot(to)) err(`${to.id === pid ? 'あなた' : to.name}のチームはもう満員です`);
  doPick(s, getP(s, pid), cid, to);
  return s;
}

function doPick(s, p, cid, to) {
  s.draft.taken[cid] = to.id;
  to.r.mates.push(cid);
  s.draft.idx++;
  const nm = npcDef(s, cid).name;
  addLog(s, to.id === p.id ? `${p.name} が ${nm} を指名` : `${p.name} が ${nm} を ${to.name} に押し付けた！`);
  if (s.players.every(q => !hasSlot(q))) {
    s.phase = 'practice';
    addLog(s, 'メンバー決定！ 練習期間スタート');
  }
}

// ---------- 練習期間 ----------
function practicing(s, pid) {
  if (s.status !== 'playing' || s.phase !== 'practice') err('今は練習期間ではありません');
  const p = getP(s, pid);
  if (!p) err('参加者ではありません');
  if (p.r.ready) err('準備完了を取り消すと操作できます');
  return p;
}

export function useTrain(s, pid, cid, prm = {}) {
  const p = practicing(s, pid);
  if (p.r.used >= TRAIN_USES) err(`練習カードは1課題に${TRAIN_USES}枚までです`);
  if (!p.train.includes(cid)) err('手札にありません');
  const c = CARDS[cid];
  let msg;
  if (STATS.includes(c.kind)) { p.st[c.kind] += 2; msg = `${STAT_NAMES[c.kind]}+2`; }
  else if (c.kind === 'any') {
    if (!STATS.includes(prm.stat)) err('上げる能力を選んでください');
    p.st[prm.stat] += 3; msg = `${STAT_NAMES[prm.stat]}+3`;
  } else if (c.kind === 'all') { STATS.forEach(k => p.st[k]++); msg = '全能力+1'; }
  else err('不明なカードです');
  p.train.splice(p.train.indexOf(cid), 1);
  s.tdiscard.push(cid);
  p.r.used++;
  addLog(s, `${p.name}：「${c.name}」${msg}`);
  return s;
}

export function setAction(s, pid, cid, prm = {}) {
  const p = practicing(s, pid);
  if (p.r.set.length >= ACTION_SETS) err(`アクションカードは1課題に${ACTION_SETS}枚までです`);
  if (!p.act.includes(cid)) err('手札にありません');
  const c = CARDS[cid];
  let opp = null;
  if (TARGETED.includes(c.kind)) {
    const o = getP(s, prm.opp);
    if (!o || o.id === pid) err('ライバルを選んでください');
    opp = o.id;
  }
  p.act.splice(p.act.indexOf(cid), 1);
  p.r.set.push({ cid, opp });
  addLog(s, `${p.name} がアクションカードを1枚伏せた`);
  return s;
}

export function unsetAction(s, pid, i) {
  const p = practicing(s, pid);
  const x = p.r.set[i];
  if (!x) return s;
  p.r.set.splice(i, 1);
  p.act.push(x.cid);
  return s;
}

export function setReady(s, pid) {
  const p = practicing(s, pid);
  p.r.ready = true;
  addLog(s, `${p.name} が準備完了`);
  if (s.players.every(q => q.r.ready)) resolveStage(s);
  return s;
}

export function cancelReady(s, pid) {
  if (s.phase !== 'practice') return s;
  getP(s, pid).r.ready = false;
  return s;
}

// ホスト用：止まっている人の代わりに進める
export function forceAdvance(s, pid) {
  if (!isHost(s, pid)) err('ホストだけが操作できます');
  if (s.phase === 'song') {
    const by = getP(s, s.songPick.by);
    addLog(s, `ホストが ${by.name} の代わりに選曲しました`);
    chooseSong(s, by.id, pick(s.songPick.choices));
  } else if (s.phase === 'draft') {
    const d = getP(s, drafter(s));
    const free = s.draft.pool.filter(c => !s.draft.taken[c]);
    const best = free.reduce((a, b) => (mateBase(s, b) > mateBase(s, a) ? b : a));
    const to = hasSlot(d) ? d : s.players.find(hasSlot);
    addLog(s, `ホストが ${d.name} の代わりに指名しました`);
    doPick(s, d, best, to);
  } else if (s.phase === 'practice') {
    s.players.forEach(p => { p.r.ready = true; });
    addLog(s, 'ホストがステージを開始しました');
    resolveStage(s);
  } else if (s.phase === 'result') {
    nextMission(s);
  }
  return s;
}

// ---------- 採点 ----------
const songMult = (so, half) => {
  const w = { ...so.w };
  (half || []).forEach(k => { w[k] = w[k] / 2; });
  return w;
};

export function selfScore(s, p, half = []) {
  const so = curSong(s);
  const w = songMult(so, half);
  const mk = mainStat(so);
  const base = Math.round(STATS.reduce((t, k) => t + w[k] * p.st[k], 0));
  const fail = p.st[mk] < needOf(so);
  return { score: fail ? Math.round(base * FAIL_MULT) : base, base, fail, main: mk };
}

export const mateBase = (s, cid) => {
  const so = curSong(s), d = npcDef(s, cid);
  return STATS.reduce((t, k) => t + so.w[k] * d[k], 0) * MATE_RATE;
};

// メンバー1人の評価（roll=true で運要素を判定、false で予想）
export function mateEval(s, cid, roll = false) {
  const so = curSong(s), d = npcDef(s, cid);
  const mk = mainStat(so);
  let v = mateBase(s, cid);
  const r = { cid, name: d.name, trait: d.trait, team: 0, votes: 0, note: '', risk: '' };
  switch (d.trait) {
    case 'mood': v *= 0.5; r.team += 4; break;
    case 'genius':
      if (roll && rand(3) === 0) { v = 0; r.note = '大ミス…'; } else v *= 2;
      if (!roll) r.risk = '1/3で大ミス';
      break;
    case 'diva': v *= 1.5; r.team -= 4; break;
    case 'nervous':
      if (roll && rand(2) === 0) { v *= 0.5; r.note = '緊張で実力を出せず…'; }
      if (!roll) r.risk = '1/2で半分';
      break;
    case 'hard': v += s.mission * 2; break;
    case 'visual': v += mk === 'vi' ? 6 : -2; break;
    case 'rapper': v += mk === 'ra' ? 6 : -2; break;
    case 'leader': v -= 2; r.team += 3; break;
    case 'maknae': v *= 0.5; r.votes += 1; break;
    case 'clumsy': r.team -= 5; r.votes += 2; break;
    case 'trouble': if (!roll) r.risk = '悪いハプニングが起きやすい'; break;
    default: break;
  }
  r.v = Math.max(0, Math.round(v));
  return r;
}

export function predict(s, p) {
  const me = selfScore(s, p);
  const mates = p.r.mates.map(c => mateEval(s, c));
  const team = mates.reduce((t, m) => t + m.v + m.team, 0);
  return { ...me, mates, team, total: me.score + team };
}

function rollHap(pressure, trouble) {
  const list = pressure ? HAPPS.filter(h => h.bad) : HAPPS;
  let total = 0;
  const ws = list.map(h => { const w = h.w * (h.bad && trouble ? 3 : 1); total += w; return w; });
  let x = Math.random() * total;
  return list.find((h, i) => (x -= ws[i]) < 0) || list[0];
}

function resolveStage(s) {
  const M = mission(s);
  const P = id => getP(s, id);
  const st = {};
  s.players.forEach(p => {
    st[p.id] = { ev: [], pts: 0, votes: 0, half: [], pressure: false, teamwork: false, defs: [], penalty: 0 };
    p.r.set.forEach(x => {
      const k = CARDS[x.cid].kind;
      if (k === 'guard' || k === 'counter') st[p.id].defs.push(k);
    });
  });
  // ① 妨害の判定（防御カードで順に防ぐ）
  const attacks = [];
  s.players.forEach(p => p.r.set.forEach(x => { if (x.opp) attacks.push({ from: p.id, to: x.opp, kind: CARDS[x.cid].kind, name: CARDS[x.cid].name, icon: CARDS[x.cid].icon }); }));
  shuffle(attacks);
  const hits = [];
  attacks.forEach(a => {
    const t = st[a.to];
    const def = t.defs.shift();
    if (def) {
      t.ev.push({ t: `🛡️ ${P(a.from).name} の「${a.name}」を${def === 'counter' ? 'カウンターで返り討ち！' : '警護で防いだ'}`, good: true });
      st[a.from].ev.push({ t: `${a.icon} ${P(a.to).name} への「${a.name}」は防がれた…`, bad: true });
      if (def === 'counter') { st[a.from].pts -= 5; st[a.from].ev.push({ t: `⚡ ${P(a.to).name} のカウンター`, v: -5, bad: true }); }
    } else hits.push(a);
  });
  // ② メンバー交換（スコア計算の前に入れ替え）
  hits.filter(a => a.kind === 'swap').forEach(a => {
    const me = P(a.from), op = P(a.to);
    if (!me.r.mates.length || !op.r.mates.length) return;
    const val = c => mateEval(s, c).v + mateEval(s, c).team;
    const mine = me.r.mates.reduce((x, y) => (val(y) < val(x) ? y : x));
    const theirs = op.r.mates.reduce((x, y) => (val(y) > val(x) ? y : x));
    me.r.mates[me.r.mates.indexOf(mine)] = theirs;
    op.r.mates[op.r.mates.indexOf(theirs)] = mine;
    st[a.from].ev.push({ t: `🔄 ${op.name} の ${npcDef(s, theirs).name} と ${npcDef(s, mine).name} を交換`, good: true });
    st[a.to].ev.push({ t: `🔄 ${me.name} に ${npcDef(s, theirs).name} を奪われ、${npcDef(s, mine).name} が来た`, bad: true });
  });
  // ③ そのほかの妨害の効果
  hits.forEach(a => {
    const f = st[a.from], t = st[a.to], fn = P(a.from).name, tn = P(a.to).name;
    switch (a.kind) {
      case 'steal': t.pts -= 5; f.pts += 3; t.ev.push({ t: `🎯 ${fn} にパートを奪われた`, v: -5, bad: true }); f.ev.push({ t: `🎯 ${tn} のパートを奪った`, v: 3, good: true }); break;
      case 'devil': t.votes -= 2; t.ev.push({ t: `😈 ${fn} の悪魔の編集`, votes: -2, bad: true }); f.ev.push({ t: `😈 ${tn} に悪魔の編集が成功`, good: true }); break;
      case 'sound': t.half.push('vo', 'ra'); t.ev.push({ t: `🔇 ${fn} の音響トラブル（ボーカル・ラップ半分）`, bad: true }); f.ev.push({ t: `🔇 ${tn} に音響トラブルが成功`, good: true }); break;
      case 'costume': t.half.push('da', 'vi'); t.ev.push({ t: `👗 ${fn} の衣装トラブル（ダンス・ビジュアル半分）`, bad: true }); f.ev.push({ t: `👗 ${tn} に衣装トラブルが成功`, good: true }); break;
      case 'pressure': t.pressure = true; t.ev.push({ t: `😱 ${fn} からのプレッシャー`, bad: true }); f.ev.push({ t: `😱 ${tn} にプレッシャーが成功`, good: true }); break;
      default: break;
    }
  });
  // ④ 強化カード
  const maxRank = Math.max(...s.players.map(p => p.rank));
  s.players.forEach(p => {
    const x = st[p.id];
    p.r.set.forEach(c => {
      const k = CARDS[c.cid].kind;
      if (k === 'killing') { x.pts += 6; x.ev.push({ t: '✨ キリングパート', v: 6, good: true }); }
      if (k === 'fancam') { x.votes += 2; x.ev.push({ t: '📱 直カム撮影', votes: 2, good: true }); }
      if (k === 'teamwork') x.teamwork = true;
      if (k === 'comeback') {
        if (s.mission > 1 && maxRank > 1 && p.rank === maxRank) { x.votes += 4; x.ev.push({ t: '💥 一発逆転（最下位から）', votes: 4, good: true }); }
        else x.ev.push({ t: '💥 一発逆転…最下位ではなかった' });
      }
      if (k === 'priority') { s.priority.push(p.id); x.ev.push({ t: '👆 次の課題で優先指名権', good: true }); }
    });
  });
  // ⑤ ステージ点
  const rows = s.players.map(p => {
    const x = st[p.id];
    const me = selfScore(s, p, x.half);
    const mates = p.r.mates.map(c => mateEval(s, c, true));
    let team = 0;
    mates.forEach(m => {
      const v = x.teamwork ? Math.round(m.v * 1.5) : m.v;
      team += v + m.team;
      x.votes += m.votes;
      const tr = TRAITS[m.trait];
      if (m.note) x.ev.push({ t: `${m.name}（${tr.name}）${m.note}`, bad: true });
      if (m.team) x.ev.push({ t: `${m.name}（${tr.name}）`, v: m.team, bad: m.team < 0, good: m.team > 0 });
      if (m.votes) x.ev.push({ t: `${m.name}（${tr.name}）`, votes: m.votes, good: true });
    });
    if (x.teamwork) x.ev.push({ t: '🤝 チームワークでメンバーの点1.5倍', good: true });
    const trouble = p.r.mates.some(c => npcDef(s, c).trait === 'trouble');
    const h = rollHap(x.pressure, trouble);
    if (h.v) x.ev.push({ t: `${h.icon} ${h.name}`, v: h.v, bad: h.v < 0, good: h.v > 0 });
    if (h.votes) { x.votes += h.votes; x.ev.push({ t: `${h.icon} ${h.name}`, votes: h.votes, good: true }); }
    const total = Math.max(0, me.score + team + x.pts + h.v);
    return { pid: p.id, name: p.name, self: me.score, fail: me.fail, team, mates: p.r.mates.map((c, i) => ({ cid: c, v: mates[i].v })), total, ev: x.ev, extra: x.votes };
  });
  // ⑥ 順位と得票
  const table = VOTES[s.players.length] || VOTES[4];
  rows.forEach(r => {
    r.rank = 1 + rows.filter(o => o.total > r.total).length;
    r.place = (table[r.rank - 1] || 0) * M.mult;
    r.gain = r.place + r.extra;
    const p = getP(s, r.pid);
    p.votes = Math.max(0, p.votes + r.gain);
  });
  rows.sort((a, b) => a.rank - b.rank);
  s.players.forEach(p => {
    p.rank = 1 + s.players.filter(o => o.votes > p.votes).length;
    p.r.set.forEach(x => s.adiscard.push(x.cid));
    p.r.set = [];
  });
  s.results = { mission: s.mission, song: s.song, rows };
  s.history.push({ mission: s.mission, rows: rows.map(r => ({ pid: r.pid, rank: r.rank, total: r.total })) });
  s.phase = 'result';
  s.ready = {};
  addLog(s, `第${s.mission}課題の結果：` + rows.map(r => `${r.rank}位 ${r.name}（${r.total}点）`).join(' / '));
}

export function readyNext(s, pid) {
  if (s.status !== 'playing' || s.phase !== 'result') return s;
  s.ready[pid] = true;
  if (s.players.every(p => s.ready[p.id])) nextMission(s);
  return s;
}

function nextMission(s) {
  if (s.mission >= WEEKS) finish(s);
  else startMission(s);
}

function finish(s) {
  s.status = 'ended';
  s.phase = 'ended';
  s.final = [...s.players].sort((a, b) => b.votes - a.votes).map(p => ({ pid: p.id, name: p.name, votes: p.votes, rank: p.rank }));
  addLog(s, `🎉 最終順位発表！ デビューを決めたのは ${s.final.filter(f => f.rank === 1).map(f => f.name).join('・')}！`);
}

export function backToLobby(s, pid) {
  if (!isHost(s, pid)) err('ホストだけが操作できます');
  return {
    v: 4, roomId: s.roomId, status: 'lobby', hostId: s.hostId, custom: s.custom || [], created: s.created, log: [],
    players: s.players.map(p => ({ id: p.id, name: p.name, type: p.type })),
  };
}
