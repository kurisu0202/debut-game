// ===== データ：オーディション番組「デビューまであと1ステージ」 =====

export const STATS = ['vo', 'da', 'ra', 'vi'];
export const STAT_NAMES = { vo: 'ボーカル', da: 'ダンス', ra: 'ラップ', vi: 'ビジュアル' };
export const STAT_SHORT = { vo: 'ボ', da: 'ダ', ra: 'ラ', vi: 'ビ' };

// ---------- プレイヤーのタイプ（初期能力） ----------
export const TYPES = {
  vocal: { id: 'vocal', name: 'ボーカル型', icon: '🎤', st: { vo: 5, da: 2, ra: 2, vi: 2 } },
  dance: { id: 'dance', name: 'ダンス型', icon: '💃', st: { vo: 2, da: 5, ra: 2, vi: 2 } },
  rap: { id: 'rap', name: 'ラップ型', icon: '🎧', st: { vo: 2, da: 2, ra: 5, vi: 2 } },
  visual: { id: 'visual', name: 'ビジュアル型', icon: '💎', st: { vo: 2, da: 2, ra: 2, vi: 5 } },
  allround: { id: 'allround', name: 'オールラウンダー', icon: '🌈', st: { vo: 3, da: 3, ra: 2, vi: 3 } },
};

// ---------- 課題（全5ターン） ----------
// diffs: 候補曲の難易度 / mult: 得票倍率
export const MISSIONS = [
  { n: 1, name: 'レベル分け評価', icon: '🎓', diffs: [1], mult: 1 },
  { n: 2, name: 'グループバトル', icon: '⚔️', diffs: [1, 2], mult: 1 },
  { n: 3, name: 'ポジション評価', icon: '🎯', diffs: [2], mult: 1 },
  { n: 4, name: 'コンセプト評価', icon: '🎨', diffs: [2, 3], mult: 1 },
  { n: 5, name: 'デビュー評価', icon: '👑', diffs: [3], mult: 2 },
];
export const TEAM_SIZE = 2;       // 自分以外のメンバー数
export const SONG_CHOICES = 3;    // 選曲の候補数

// ---------- 課題曲（重みの合計は8） ----------
export const SONGS = {
  S01: { name: 'ハウ・ユー・ライク・納豆', genre: 'ポップ', w: { vo: 2, da: 2, ra: 2, vi: 2 }, diff: 1 },
  S02: { name: 'ティッシュ配布ボーイ', genre: '爽やか', w: { vo: 3, da: 2, ra: 1, vi: 2 }, diff: 1 },
  S03: { name: 'ダラダラ・ダッラ', genre: 'ダンスポップ', w: { vo: 1, da: 3, ra: 2, vi: 2 }, diff: 1 },
  S04: { name: '神メニュー（学食ver.）', genre: 'ヒップホップ', w: { vo: 2, da: 1, ra: 3, vi: 2 }, diff: 1 },
  S05: { name: 'ファンシー文具', genre: 'キュート', w: { vo: 2, da: 2, ra: 1, vi: 3 }, diff: 1 },
  S06: { name: '給料日グッデイ', genre: 'バラード', w: { vo: 4, da: 1, ra: 1, vi: 2 }, diff: 2 },
  S07: { name: 'ネクスト・レベル上げ', genre: 'ハードダンス', w: { vo: 1, da: 4, ra: 1, vi: 2 }, diff: 2 },
  S08: { name: 'ドゥドゥ…どうする？', genre: 'ラップ', w: { vo: 1, da: 2, ra: 4, vi: 1 }, diff: 2 },
  S09: { name: 'サイコロ', genre: 'ダーク', w: { vo: 1, da: 2, ra: 1, vi: 4 }, diff: 2 },
  S10: { name: 'スプリング・デイ（花粉症）', genre: '超高音バラード', w: { vo: 5, da: 1, ra: 0, vi: 2 }, diff: 3 },
  S11: { name: '埼玉スタイル', genre: '激ムズダンス', w: { vo: 0, da: 5, ra: 1, vi: 2 }, diff: 3 },
  S12: { name: 'バンバン晩ごはん', genre: '高速ラップ', w: { vo: 1, da: 1, ra: 5, vi: 1 }, diff: 3 },
  S13: { name: '割れ物注意フラジャイル', genre: 'コンセプト', w: { vo: 1, da: 1, ra: 1, vi: 5 }, diff: 3 },
};
export const NEED = { 1: 0, 2: 7, 3: 10 };
export const FAIL_MULT = 0.7;
export const MATE_RATE = 0.5;

// ---------- 順位ごとの得票（万票） ----------
export const VOTES = { 2: [10, 5], 3: [10, 6, 3], 4: [10, 6, 3, 1] };

// ---------- 練習カード（自分の能力アップ） ----------
const TRAIN = [
  { kind: 'vo', n: 5, name: 'ボイトレ', icon: '🎙️', eff: 'ボーカル+2' },
  { kind: 'da', n: 5, name: 'ダンス練習', icon: '👟', eff: 'ダンス+2' },
  { kind: 'ra', n: 5, name: 'ラップ練習', icon: '🎧', eff: 'ラップ+2' },
  { kind: 'vi', n: 5, name: '表情管理', icon: '💄', eff: 'ビジュアル+2' },
  { kind: 'any', n: 4, name: '居残り特訓', icon: '🔥', eff: '好きな能力+3' },
  { kind: 'all', n: 4, name: '基礎練習', icon: '📚', eff: '全能力+1' },
];

// ---------- アクションカード（伏せてセット → 本番で公開） ----------
// type: atk=妨害 / def=防御 / buf=強化 / spc=特殊
const ACTIONS = [
  { kind: 'steal', n: 3, type: 'atk', name: 'パート奪い', icon: '🎯', eff: 'ライバル1人のステージ点-5、自分+3' },
  { kind: 'devil', n: 3, type: 'atk', name: '悪魔の編集', icon: '😈', eff: 'ライバル1人の得票-2万' },
  { kind: 'sound', n: 2, type: 'atk', name: '音響トラブル', icon: '🔇', eff: 'ライバル1人のボーカル・ラップの点が半分' },
  { kind: 'costume', n: 2, type: 'atk', name: '衣装トラブル', icon: '👗', eff: 'ライバル1人のダンス・ビジュアルの点が半分' },
  { kind: 'swap', n: 2, type: 'atk', name: 'メンバー交換', icon: '🔄', eff: '自分のチームの一番弱いメンバーと、ライバルの一番強いメンバーを入れ替え' },
  { kind: 'pressure', n: 2, type: 'atk', name: 'プレッシャー', icon: '😱', eff: 'ライバル1人の本番ハプニングが必ず悪いものになる' },
  { kind: 'guard', n: 4, type: 'def', name: 'マネージャーの警護', icon: '🛡️', eff: '自分への妨害を1つ防ぐ' },
  { kind: 'counter', n: 3, type: 'def', name: 'カウンター', icon: '⚡', eff: '自分への妨害を1つ防ぎ、仕掛けた人のステージ点-5' },
  { kind: 'killing', n: 3, type: 'buf', name: 'キリングパート', icon: '✨', eff: '自分のステージ点+6' },
  { kind: 'fancam', n: 3, type: 'buf', name: '直カム撮影', icon: '📱', eff: '自分の得票+2万' },
  { kind: 'teamwork', n: 2, type: 'buf', name: 'チームワーク', icon: '🤝', eff: 'チームメンバーの点が1.5倍' },
  { kind: 'comeback', n: 2, type: 'buf', name: '一発逆転', icon: '💥', eff: '本番前に最下位なら得票+4万' },
  { kind: 'priority', n: 2, type: 'spc', name: '優先指名権', icon: '👆', eff: '次の課題のメンバー選びで最初に指名できる' },
];
export const ACTION_TYPES = { atk: '妨害', def: '防御', buf: '強化', spc: '特殊' };
export const TARGETED = ['steal', 'devil', 'sound', 'costume', 'swap', 'pressure'];

export const CARDS = {};
export const TRAIN_IDS = [];
export const ACTION_IDS = [];
let ci = 0;
TRAIN.forEach(t => {
  for (let k = 0; k < t.n; k++) {
    const id = 'K' + String(++ci).padStart(2, '0');
    CARDS[id] = { id, cat: 'train', ...t };
    TRAIN_IDS.push(id);
  }
});
ci = 0;
ACTIONS.forEach(t => {
  for (let k = 0; k < t.n; k++) {
    const id = 'A' + String(++ci).padStart(2, '0');
    CARDS[id] = { id, cat: 'action', ...t };
    ACTION_IDS.push(id);
  }
});

// ---------- メンバーの特徴（利点とデメリット） ----------
export const TRAITS = {
  mood: { name: 'ムードメーカー', plus: 'チームの点+4', minus: '本人の点は半分' },
  genius: { name: '天才肌', plus: '本人の点が2倍', minus: '3回に1回、本番で大ミス（本人の点0）' },
  diva: { name: '目立ちたがり', plus: '本人の点が1.5倍', minus: 'パートを独占（あなたの点-4）' },
  nervous: { name: 'あがり症', plus: '能力が高い', minus: '2回に1回、本人の点が半分' },
  hard: { name: '努力家', plus: '課題ごとに成長（課題数×2点）', minus: '最初は能力が低い' },
  visual: { name: 'ビジュアル担当', plus: 'ビジュアルが一番重要な曲で+6', minus: 'それ以外の曲で-2' },
  rapper: { name: 'ラップ担当', plus: 'ラップが一番重要な曲で+6', minus: 'それ以外の曲で-2' },
  leader: { name: 'リーダー', plus: 'チームの点+3', minus: '本人の点-2' },
  maknae: { name: 'マンネ', plus: '愛されて得票+1万', minus: '本人の点は半分' },
  clumsy: { name: 'ドジっ子', plus: 'ドジがバズって得票+2万', minus: 'チームの点-5' },
  trouble: { name: 'トラブルメーカー', plus: '能力が高い', minus: '本番で悪いハプニングが起きやすい' },
};

// ---------- NPC練習生（ステージメンバー候補） ----------
// 名前, Vo, Da, Rap, Vi, 特徴, 国
const TRAINEES = [
  ['ハユン', 5, 2, 1, 3, 'genius'], ['ソア', 2, 5, 3, 3, 'diva'], ['ダオン', 3, 3, 2, 5, 'visual'],
  ['セア', 3, 4, 3, 3, 'leader'], ['ジオ', 2, 4, 5, 2, 'rapper'], ['ハリン', 4, 2, 1, 2, 'mood'],
  ['セビン', 3, 3, 3, 3, 'leader'], ['ラオン', 1, 3, 2, 5, 'visual'], ['ヨルム', 5, 4, 1, 3, 'nervous'],
  ['ナビ', 2, 3, 2, 2, 'hard'], ['イソル', 1, 2, 1, 3, 'maknae'], ['ガオン', 3, 2, 2, 4, 'mood'],
  ['ハンビ', 2, 3, 5, 2, 'rapper'], ['ウンソル', 5, 1, 1, 2, 'diva'], ['ジェア', 2, 5, 4, 3, 'nervous'],
  ['ルア', 2, 2, 1, 4, 'clumsy'], ['ダルビ', 4, 4, 4, 3, 'trouble'], ['ノウル', 2, 1, 2, 2, 'hard'],
  ['イェソル', 2, 2, 2, 2, 'maknae'], ['ミル', 3, 3, 2, 2, 'mood'], ['ソウン', 2, 2, 2, 2, 'hard'],
  ['ヘオン', 1, 3, 2, 3, 'clumsy'], ['ボダム', 1, 4, 5, 3, 'genius'], ['ヒナタ', 2, 5, 2, 2, 'diva', '日本'],
  ['コハル', 3, 2, 1, 2, 'hard', '日本'], ['ツムギ', 1, 2, 1, 5, 'visual', '日本'], ['プリム', 2, 4, 5, 3, 'rapper', 'タイ'],
  ['ナリン', 4, 4, 3, 4, 'trouble', 'タイ'], ['ユエ', 2, 4, 3, 2, 'leader', '中国'], ['シンイー', 5, 1, 1, 3, 'genius', '中国'],
];
export const NPCS = {};
export const NPC_IDS = [];
TRAINEES.forEach(([name, vo, da, ra, vi, trait, country], i) => {
  const id = 'T' + String(i + 1).padStart(2, '0');
  NPCS[id] = { id, name, vo, da, ra, vi, trait, country: country || '' };
  NPC_IDS.push(id);
});

// ---------- 本番ハプニング ----------
// v: ステージ点 / votes: 得票（万） / bad: 悪いハプニング / w: 出やすさ
export const HAPPS = [
  { id: 'none', w: 5, icon: '🎵', name: '何事もなくステージ終了', v: 0 },
  { id: 'adlib', w: 2, icon: '✨', name: 'アドリブが大成功！', v: 5 },
  { id: 'crowd', w: 2, icon: '🙌', name: '客席が大盛り上がり！', v: 3 },
  { id: 'chem', w: 2, icon: '🤝', name: 'チームの息がぴったり！', v: 4 },
  { id: 'buzz', w: 1, icon: '📈', name: 'ステージ動画がバズった！', v: 0, votes: 2 },
  { id: 'mic', w: 2, icon: '🎧', name: 'イヤモニのトラブル…', v: -3, bad: true },
  { id: 'shake', w: 2, icon: '😰', name: '緊張で声が震えた…', v: -3, bad: true },
  { id: 'fall', w: 2, icon: '🤕', name: 'メンバーが本番で転んだ！', v: -5, bad: true },
];

export const FLAGS = { '日本': '🇯🇵', 'タイ': '🇹🇭', '中国': '🇨🇳', '韓国': '🇰🇷', 'アメリカ': '🇺🇸' };
