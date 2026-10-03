// ===== ゲームロジック（純粋関数：状態を受け取り、変更して返す） =====
import {
  STATS, STAT_FULL, TYPES, MISSIONS, ELIM, DEBUT, SONGS, NORMAL_SONGS, POS_SONGS, DIFF, FAIL_MULT,
  CARDS, CARD_IDS, HAPPS, NPCS, NPC_IDS, SKILL_LIST,
} from './cards.js';

export const MAX_PLAYERS = 4, MAX_CUSTOM = 20, USES = 3, DRAW = 4, HAND_MAX = 8, WEEKS = MISSIONS.length;
const VOTE_RATE = 80;

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
const round10 = v => Math.round(v / 10) * 10;

export const getP = (s, pid) => s.players.find(p => p.id === pid);
export const isHost = (s, pid) => s.hostId === pid;
export const npcDef = (s, cid) => NPCS[cid] || (s.custom || []).find(c => c.id === cid);
export const mission = s => MISSIONS[s.mission - 1];
export const song = id => SONGS[id];
export const mainStat = so => STATS.reduce((a, k) => (so.w[k] > so.w[a] ? k : a), 'vo');

function addLog(s, m) {
  s.log = s.log || [];
  s.log.push({ w: s.mission || 0, m });
  if (s.log.length > 150) s.log = s.log.slice(-150);
}

// ---------- ロビー ----------
export function joinRoom(s, pid, name, roomId) {
  name = (name || '').trim().slice(0, 10);
  if (!name) err('名前を入力してください');
  // 部屋がない、または旧バージョンの部屋なら新しく作る
  if (!s || !s.v2) return { v2: true, roomId, status: 'lobby', hostId: pid, players: [{ id: pid, name, type: 'allround' }], custom: [], log: [], created: Date.now() };
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
  if (s.status !== 'lobby') err('ロビーでのみ変更できます');
  if (!TYPES[type]) err('不明なタイプです');
  getP(s, pid).type = type;
  return s;
}

export function addCustom(s, pid, c) {
  if (s.status !== 'lobby') err('ロビーでのみ追加できます');
  s.custom = s.custom || [];
  if (s.custom.length >= MAX_CUSTOM) err(`オリジナル練習生は${MAX_CUSTOM}人までです`);
  const name = String(c.name || '').trim().slice(0, 10);
  if (!name) err('練習生の名前を入力してください');
  const num = v => Math.max(0, Math.min(9, Math.floor(Number(v) || 0)));
  const id = 'C' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  s.custom.push({
    id, custom: true, owner: pid, star: false, name,
    vo: num(c.vo), da: num(c.da), ra: num(c.ra), vi: num(c.vi),
    skill: SKILL_LIST.includes(c.skill) ? c.skill : 'なし',
    country: String(c.country || '').trim().slice(0, 8),
  });
  addLog(s, `オリジナル練習生「${name}」が番組に参加！`);
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
  if (s.players.length < 1) err('参加者がいません');
  s.players.forEach(p => {
    const t = TYPES[p.type] || TYPES.allround;
    Object.assign(p, { st: { ...t.st }, fans: 0, hand: [], r: null, rank: 0, prevRank: 0, grade: '' });
  });
  // NPC：初期人気（番組放送前の知名度）と人気係数
  s.npc = {};
  [...NPC_IDS, ...(s.custom || []).map(c => c.id)].forEach(id => {
    const d = npcDef(s, id);
    const pop = d.star ? 1.5 + Math.random() * 0.5 : 0.7 + Math.random() * 0.7;
    s.npc[id] = { fans: round10((d.star ? 2500 : 0) + Math.random() * 2500), pop: Math.round(pop * 100) / 100, out: 0, rank: 0, prevRank: 0 };
  });
  s.deck = shuffle([...CARD_IDS]);
  s.discard = [];
  Object.assign(s, { status: 'playing', mission: 0, results: null, ranking: null, history: [], log: [] });
  calcRanking(s);
  addLog(s, `オーディション番組スタート！ 参加練習生 ${Object.keys(s.npc).length + s.players.length}人`);
  startMission(s);
  return s;
}

function draw(s, p, n) {
  let c = 0;
  for (let i = 0; i < n && p.hand.length < HAND_MAX; i++) {
    if (!s.deck.length) {
      if (!s.discard.length) break;
      s.deck = shuffle(s.discard);
      s.discard = [];
    }
    p.hand.push(s.deck.pop());
    c++;
  }
  return c;
}

const activeNpcs = s => Object.keys(s.npc).filter(id => !s.npc[id].out);

function pickMates(s, n, exclude = []) {
  const used = new Set(exclude);
  s.players.forEach(p => (p.r?.mates || []).forEach(m => used.add(m.cid)));
  let pool = shuffle(activeNpcs(s).filter(id => !used.has(id)));
  if (pool.length < n) pool = pool.concat(shuffle(activeNpcs(s).filter(id => !exclude.includes(id) && !pool.includes(id))));
  return pool.slice(0, n).map(cid => ({ cid, mod: { vo: 0, da: 0, ra: 0, vi: 0 } }));
}

function pick2Songs(exclude = []) {
  return shuffle(NORMAL_SONGS.filter(k => !exclude.includes(k))).slice(0, 2);
}

function startMission(s) {
  s.mission++;
  s.phase = 'practice';
  const M = mission(s);
  addLog(s, `── 第${s.mission}課題「${M.name}」──`);
  s.players.forEach(p => { p.r = null; });
  s.players.forEach(p => {
    p.r = {
      songs: M.pos ? [...POS_SONGS] : pick2Songs(), song: null, mates: [], hap: null,
      used: 0, ready: false, tmp: { stage: 0, team: 0, mate: 0 }, tmpSt: { vo: 0, da: 0, ra: 0, vi: 0 }, early: 0, notes: [],
    };
    p.r.mates = pickMates(s, M.team);
    if (p.type === 'allround') {
      const k = pick(STATS);
      p.st[k]++;
      p.r.notes.push(`オールラウンダー：${STAT_FULL[k]}+1`);
    }
    draw(s, p, s.mission === 1 ? DRAW + 1 : DRAW);
    applyHap(s, p, M);
  });
}

function addFans(p, v) { p.fans += v; p.r.early += v; }

function applyHap(s, p, M) {
  const keys = Object.keys(HAPPS).filter(k => M.team || !HAPPS[k].team);
  const k = pick(keys);
  const r = p.r;
  r.hap = k;
  const mate = () => pick(r.mates);
  const nm = m => npcDef(s, m.cid).name;
  let detail = '';
  switch (k) {
    case 'baddancer': {
      const m = r.mates.reduce((a, b) => (npcDef(s, b.cid).da < npcDef(s, a.cid).da ? b : a));
      m.mod.da -= 3; detail = `${nm(m)}のダンスが…（ダンス-3）`; break;
    }
    case 'badsinger': {
      const m = r.mates.reduce((a, b) => (npcDef(s, b.cid).vo < npcDef(s, a.cid).vo ? b : a));
      m.mod.vo -= 3; detail = `${nm(m)}の音程が…（ボーカル-3）`; break;
    }
    case 'ace': {
      const stars = activeNpcs(s).filter(id => npcDef(s, id).star && !r.mates.some(m => m.cid === id));
      const m = mate();
      if (stars.length) { m.cid = pick(stars); m.mod = { vo: 0, da: 0, ra: 0, vi: 0 }; }
      else { m.mod = { vo: 2, da: 2, ra: 2, vi: 2 }; }
      detail = `${nm(m)}と同じチームに！`; break;
    }
    case 'fight': r.tmp.team -= 4; r.tmp.stage += 2; break;
    case 'mood': r.tmp.team += 6; break;
    case 'leader': r.tmp.team += 3; addFans(p, 200); break;
    case 'killing': r.tmp.stage += 5; break;
    case 'injury': r.tmpSt.da -= 2; break;
    case 'cold': r.tmpSt.vo -= 2; break;
    case 'devil': addFans(p, -400); break;
    case 'angel': addFans(p, 400); break;
    case 'mentor': {
      const top = STATS.reduce((a, b) => (p.st[b] > p.st[a] ? b : a));
      p.st[top]++; detail = `${STAT_FULL[top]}+1`; break;
    }
    case 'fancam': addFans(p, p.type === 'visual' ? 1000 : 600); break;
    default: break;
  }
  r.hapDetail = detail;
}

// ---------- 練習フェーズ（全員同時） ----------
function myRound(s, pid) {
  if (s.status !== 'playing' || s.phase !== 'practice') err('今は練習期間ではありません');
  const p = getP(s, pid);
  if (!p) err('参加者ではありません');
  if (p.r.ready) err('すでに準備完了しています');
  return p;
}

export function chooseSong(s, pid, songId) {
  const p = myRound(s, pid);
  if (!p.r.songs.includes(songId)) err('選べない曲です');
  p.r.song = songId;
  return s;
}

export function playCard(s, pid, cid, prm = {}) {
  const p = myRound(s, pid);
  const r = p.r;
  if (r.used >= USES) err(`練習カードは1課題に${USES}枚までです`);
  if (!p.hand.includes(cid)) err('手札にありません');
  const c = CARDS[cid];
  let msg = '';
  switch (c.kind) {
    case 'vo': case 'da': case 'ra': case 'vi':
      p.st[c.kind] += 2; msg = `${STAT_FULL[c.kind]}+2`; break;
    case 'all':
      STATS.forEach(k => p.st[k]++); msg = '全能力+1'; break;
    case 'low': {
      const k = STATS.reduce((a, b) => (p.st[b] < p.st[a] ? b : a));
      p.st[k] += 3; msg = `${STAT_FULL[k]}+3`; break;
    }
    case 'night':
      if (!STATS.includes(prm.stat)) err('上げる能力を選んでください');
      p.st[prm.stat] += 3; r.tmp.stage -= 5; msg = `${STAT_FULL[prm.stat]}+3（寝不足でステージ点-5）`; break;
    case 'study': {
      if (!r.song) err('先に課題曲を選んでください');
      const k = mainStat(song(r.song));
      p.st[k] += 2; r.tmp.stage += 2; msg = `${STAT_FULL[k]}+2、ステージ点+2`; break;
    }
    case 'killing': r.tmp.stage += 6; msg = 'ステージ点+6'; break;
    case 'teamprac':
      if (!r.mates.length) err('この課題はソロステージです');
      r.tmp.mate += 3; msg = 'チームメイト全員+3'; break;
    case 'swap': {
      if (!r.mates.length) err('この課題はソロステージです');
      const so = song(r.song || r.songs[0]);
      const weakest = r.mates.reduce((a, b) => (npcScore(s, b, so).score < npcScore(s, a, so).score ? b : a));
      const [nw] = pickMates(s, 1, r.mates.map(m => m.cid));
      if (!nw) err('入れ替えられる練習生がいません');
      msg = `${npcDef(s, weakest.cid).name} → ${npcDef(s, nw.cid).name} に交代`;
      Object.assign(weakest, nw);
      break;
    }
    case 'reroll':
      if (mission(s).pos) err('ポジション評価では使えません');
      r.songs = pick2Songs(r.songs); r.song = null; msg = '課題曲の候補を引き直した'; break;
    case 'pr': addFans(p, 600); msg = '得票+600'; break;
    case 'devil': {
      const o = getP(s, prm.opp);
      if (!o || o.id === pid) err('相手を選んでください');
      o.fans -= 500;
      if (o.r) o.r.early -= 500;
      msg = `${o.name} の得票-500`;
      break;
    }
    default: err('不明なカードです');
  }
  p.hand.splice(p.hand.indexOf(cid), 1);
  s.discard.push(cid);
  r.used++;
  addLog(s, `${p.name}：「${c.name}」${msg}`);
  return s;
}

export function setReady(s, pid) {
  const p = myRound(s, pid);
  if (!p.r.song) err('課題曲を選んでください');
  p.r.ready = true;
  addLog(s, `${p.name} が準備完了`);
  if (s.players.every(q => q.r.ready)) resolveMission(s);
  return s;
}

export function cancelReady(s, pid) {
  if (s.phase !== 'practice') return s;
  const p = getP(s, pid);
  p.r.ready = false;
  return s;
}

// ホスト用：未準備の人を自動で準備完了にする
export function forceReady(s, pid) {
  if (!isHost(s, pid)) err('ホストだけが操作できます');
  if (s.phase !== 'practice') return s;
  s.players.forEach(p => {
    if (p.r.ready) return;
    if (!p.r.song) p.r.song = p.r.songs.reduce((a, b) => (personalScore(s, p, b).score > personalScore(s, p, a).score ? b : a));
    p.r.ready = true;
    addLog(s, `ホストが ${p.name} を準備完了にしました`);
  });
  resolveMission(s);
  return s;
}

// ---------- 採点 ----------
export function effStats(p) {
  const o = {};
  STATS.forEach(k => { o[k] = Math.max(0, p.st[k] + (p.r ? p.r.tmpSt[k] : 0)); });
  return o;
}

export function personalScore(s, p, songId = p.r.song) {
  const so = song(songId);
  if (!so) return { score: 0, base: 0, notes: [], fail: false };
  const st = effStats(p);
  const mk = mainStat(so);
  const notes = [];
  let base = STATS.reduce((t, k) => t + so.w[k] * st[k], 0);
  const perkStat = { vocal: 'vo', dance: 'da', rap: 'ra' }[p.type];
  if (perkStat && perkStat === mk) { base += 4; notes.push(`${TYPES[p.type].name}+4`); }
  const d = DIFF[so.diff];
  const fail = st[mk] < d.need;
  const mult = fail ? FAIL_MULT : d.mult;
  if (fail) notes.push(`${STAT_FULL[mk]}${d.need}未満でミス連発…×${FAIL_MULT}`);
  else if (d.mult > 1) notes.push(`難曲クリア×${d.mult}`);
  const t = p.r ? p.r.tmp.stage : 0;
  if (t) notes.push(`補正${t > 0 ? '+' : ''}${t}`);
  return { score: Math.max(0, Math.round(base * mult) + t), base, mult, fail, need: d.need, main: mk, notes };
}

export function npcScore(s, m, so) {
  const d = npcDef(s, m.cid);
  const mk = mainStat(so);
  let sc = STATS.reduce((t, k) => t + so.w[k] * Math.max(0, d[k] + (m.mod?.[k] || 0)), 0);
  const sk = d.skill;
  const notes = [];
  const bonus = (v, why) => { sc += v; notes.push(why); };
  if (mk === 'vo' && sk === 'メインボーカル') bonus(3, sk);
  if (mk === 'vo' && sk === 'リードボーカル') bonus(1, sk);
  if (mk === 'da' && sk === 'メインダンサー') bonus(3, sk);
  if (mk === 'da' && sk === 'リードダンサー') bonus(1, sk);
  if (mk === 'ra' && sk === 'ラッパー') bonus(3, sk);
  if (mk === 'vi' && sk === 'ビジュアル') bonus(3, sk);
  if (sk === 'オールラウンダー') bonus(2, sk);
  if (sk === 'センター' || sk === 'リーダー') bonus(2, sk);
  return { score: sc, notes };
}

export function teamScore(s, p) {
  const so = song(p.r.song);
  const me = personalScore(s, p);
  const mates = p.r.mates.map(m => ({ cid: m.cid, name: npcDef(s, m.cid).name, ...npcScore(s, m, so) }));
  mates.forEach(m => { m.score += p.r.tmp.mate; });
  const total = me.score + mates.reduce((t, m) => t + m.score, 0) + p.r.tmp.team;
  return { total, me, mates };
}

const GRADES = [[36, 'A', 800], [30, 'B', 400], [24, 'C', 200], [18, 'D', 0], [12, 'E', 0], [0, 'F', 0]];

function resolveMission(s) {
  const M = mission(s);
  const rows = s.players.map(p => {
    const r = p.r;
    const so = song(r.song);
    const ts = teamScore(s, p);
    const items = [];
    if (r.early) items.push({ label: '練習期間の話題', v: r.early, already: true });
    const noise = 0.9 + Math.random() * 0.2;
    const perf = round10(ts.me.score * VOTE_RATE * M.mult * noise);
    items.push({ label: `個人パフォーマンス（${ts.me.score}点）`, v: perf });
    let rival = null, win = null, grade = '';
    if (s.mission === 1) {
      const g = GRADES.find(x => ts.me.score >= x[0]);
      grade = g[1];
      p.grade = grade;
      if (g[2]) items.push({ label: `${grade}クラス判定`, v: g[2] });
    }
    if (M.rival) {
      const rv = pickMates(s, M.team + 1, r.mates.map(m => m.cid));
      const rs = rv.reduce((t, m) => t + npcScore(s, m, so).score, 0) + rand(8);
      rival = { names: rv.map(m => npcDef(s, m.cid).name), score: rs };
      win = ts.total >= rs;
      if (win) items.push({ label: 'チーム勝利ベネフィット', v: round10(1000 * M.mult) });
    }
    if (M.pos) {
      const top = ts.mates.every(m => ts.me.score > m.score);
      if (top) items.push({ label: 'ポジション内1位ボーナス', v: round10(1000 * M.mult) });
    }
    const mk = r.mates.filter(m => npcDef(s, m.cid).skill === 'マンネ').length;
    if (mk) items.push({ label: `マンネの応援×${mk}`, v: 200 * mk });
    if (p.type === 'visual') {
      const sub = items.filter(i => !i.already).reduce((t, i) => t + i.v, 0);
      items.push({ label: 'ビジュアル型+15%', v: round10(sub * 0.15) });
    }
    const gain = items.filter(i => !i.already).reduce((t, i) => t + i.v, 0);
    p.fans += gain;
    return {
      pid: p.id, name: p.name, type: p.type, song: r.song, hap: r.hap, hapDetail: r.hapDetail || '',
      me: ts.me, mates: ts.mates, total: ts.total, rival, win, grade, items,
      gain: gain + r.early,
    };
  });
  // NPCの得票
  activeNpcs(s).forEach(id => {
    const d = npcDef(s, id), n = s.npc[id];
    const sum = d.vo + d.da + d.ra + d.vi;
    const sc = sum * 2 + (s.mission - 1) * 8 + (d.star ? 6 : 0); // NPCも課題ごとに成長する
    n.fans += round10(sc * VOTE_RATE * M.mult * n.pop * (0.7 + Math.random() * 0.6));
  });
  rows.sort((a, b) => b.gain - a.gain);
  s.results = { mission: s.mission, rows };
  calcRanking(s);
  // 脱落
  const cut = ELIM[s.mission];
  let eliminated = [];
  if (cut) {
    s.ranking.forEach(e => {
      if (e.kind === 'n' && e.rank > cut && !s.npc[e.id].out) { s.npc[e.id].out = s.mission; eliminated.push(e.name); }
    });
    calcRanking(s);
  }
  s.results.eliminated = eliminated;
  s.results.cut = cut || 0;
  s.history.push({ mission: s.mission, ranks: s.players.map(p => ({ pid: p.id, rank: p.rank, fans: p.fans })) });
  s.phase = 'result';
  s.ready = {};
  addLog(s, `第${s.mission}課題「${M.name}」結果発表：` + s.players.map(p => `${p.name} ${p.rank}位`).join(' / '));
  if (eliminated.length) addLog(s, `${eliminated.length}人の練習生が脱落しました`);
}

// 全練習生の順位（脱落者は下位に固定）
function calcRanking(s) {
  const list = [
    ...s.players.map(p => ({ kind: 'p', id: p.id, name: p.name, fans: p.fans, out: 0 })),
    ...Object.keys(s.npc).map(id => ({ kind: 'n', id, name: npcDef(s, id).name, fans: s.npc[id].fans, out: s.npc[id].out })),
  ];
  list.sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || (b.out - a.out) || b.fans - a.fans);
  list.forEach((e, i) => {
    e.rank = i + 1;
    const o = e.kind === 'p' ? getP(s, e.id) : s.npc[e.id];
    e.prev = o.rank || 0;
    o.prevRank = o.rank || 0;
    o.rank = e.rank;
  });
  s.ranking = list;
}

export function readyNext(s, pid, force = false) {
  if (s.status !== 'playing' || s.phase !== 'result') return s;
  if (force && !isHost(s, pid)) err('ホストだけが操作できます');
  s.ready[pid] = true;
  if (force || s.players.every(p => s.ready[p.id])) {
    if (s.mission >= WEEKS) finish(s);
    else startMission(s);
  }
  return s;
}

function finish(s) {
  s.status = 'ended';
  s.phase = 'ended';
  s.final = [...s.players].sort((a, b) => a.rank - b.rank).map(p => ({ pid: p.id, name: p.name, fans: p.fans, rank: p.rank, debut: p.rank <= DEBUT }));
  s.debut = s.ranking.slice(0, DEBUT).map(e => ({ kind: e.kind, id: e.id, name: e.name, fans: e.fans }));
  addLog(s, `🎉 最終順位発表！ 1位は ${s.ranking[0].name}`);
}

export function backToLobby(s, pid) {
  if (!isHost(s, pid)) err('ホストだけが操作できます');
  return {
    v2: true, roomId: s.roomId, status: 'lobby', hostId: s.hostId, custom: s.custom || [], created: s.created, log: [],
    players: s.players.map(p => ({ id: p.id, name: p.name, type: p.type })),
  };
}
