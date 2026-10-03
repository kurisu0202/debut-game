// ===== 通信層：Firebase Realtime Database / ローカルテスト（localStorage） =====
// 部屋の状態は rooms/{roomId}/data に JSON文字列として保存し、更新は必ずトランザクションで行う。
import { firebaseConfig } from './firebase-config.js';

const FB_VER = '10.12.2';
export const isOnline = !!(firebaseConfig && firebaseConfig.databaseURL &&
  firebaseConfig.apiKey && !/^YOUR/.test(firebaseConfig.apiKey));

let fb = null;
async function fbInit() {
  if (fb) return fb;
  const appM = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`);
  const dbM = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database.js`);
  const app = appM.initializeApp(firebaseConfig);
  fb = { db: dbM.getDatabase(app), ...dbM };
  return fb;
}

const path = id => `rooms/${id}/data`;
const parse = v => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

// fn(state) → 新しい state（null で部屋削除）。例外を投げると中止してエラーを返す。
function wrap(fn, ctx) {
  return cur => {
    ctx.error = null;
    try {
      const ns = fn(parse(cur));
      if (ns === null || ns === undefined) return null;
      ns.updated = Date.now();
      return JSON.stringify(ns);
    } catch (e) {
      ctx.error = e.message || String(e);
      return undefined; // 中止
    }
  };
}

// ---------- ローカルモード ----------
const LKEY = id => 'dm_local_room_' + id;
const localSubs = {};
window.addEventListener('storage', e => {
  if (!e.key || !e.key.startsWith('dm_local_room_')) return;
  const id = e.key.slice('dm_local_room_'.length);
  (localSubs[id] || []).forEach(cb => cb(parse(e.newValue)));
});

export async function subscribe(id, cb) {
  if (isOnline) {
    const f = await fbInit();
    return f.onValue(f.ref(f.db, path(id)), snap => cb(parse(snap.val())), e => console.error(e));
  }
  (localSubs[id] = localSubs[id] || []).push(cb);
  return () => { localSubs[id] = (localSubs[id] || []).filter(x => x !== cb); };
}

export async function transact(id, fn) {
  const ctx = { error: null };
  const update = wrap(fn, ctx);
  if (isOnline) {
    try {
      const f = await fbInit();
      const res = await f.runTransaction(f.ref(f.db, path(id)), update);
      if (ctx.error) return { error: ctx.error };
      return { state: parse(res.snapshot.val()) };
    } catch (e) {
      return { error: '通信エラー：' + (e.message || e) };
    }
  }
  const out = update(localStorage.getItem(LKEY(id)));
  if (ctx.error) return { error: ctx.error };
  if (out === null) localStorage.removeItem(LKEY(id));
  else localStorage.setItem(LKEY(id), out);
  const st = parse(out);
  (localSubs[id] || []).forEach(cb => cb(st));
  return { state: st };
}
