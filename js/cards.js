// ===== カードデータ =====

export const SKILL_DESC = {
  'メインボーカル': 'Voが2倍以上になる週はさらに+2',
  'メインダンサー': 'Daが2倍以上になる週はさらに+2',
  'リードボーカル': 'メインボーカルと一緒に出ると+1',
  'リードダンサー': 'メインダンサーと一緒に出ると+1',
  'センター': '出演すると、一緒に出た他のメンバーも+1ずつ',
  'ラッパー': '「音響トラブル」でもVoが0にならない',
  'ビジュアル': '「直カムがバズった！」の効果が2倍',
  'リーダー': 'グループにいる間、毎週ファン+1',
  'マンネ': '「ファンサイン会」で追加ファン+2',
  'オールラウンダー': '出演すると毎週ステージ点+1',
  'なし': '特技なし',
};
export const SKILL_LIST = Object.keys(SKILL_DESC);

// 特技 → 色系統
export const SKILL_TONE = {
  'メインボーカル': 'vo', 'リードボーカル': 'vo',
  'メインダンサー': 'da', 'リードダンサー': 'da', 'ラッパー': 'da',
  'センター': 'vi', 'ビジュアル': 'vi',
  'リーダー': 'etc', 'マンネ': 'etc', 'オールラウンダー': 'etc', 'なし': 'etc',
};

export const FLAGS = { '日本': '🇯🇵', 'タイ': '🇹🇭', '中国': '🇨🇳', '韓国': '🇰🇷', 'アメリカ': '🇺🇸' };

const TRAINEES = [
  ['ハユン★', 5, 2, 3, 'メインボーカル'],
  ['ソア★', 2, 5, 3, 'メインダンサー'],
  ['ダオン★', 3, 3, 5, 'センター'],
  ['セア★', 3, 4, 3, 'オールラウンダー'],
  ['ジオ', 2, 4, 2, 'ラッパー'],
  ['ハリン', 4, 2, 2, 'リードボーカル'],
  ['セビン', 3, 3, 3, 'リーダー'],
  ['ラオン', 1, 3, 4, 'ビジュアル'],
  ['ヨルム', 4, 3, 1, 'リードボーカル'],
  ['ナビ', 2, 4, 3, 'リードダンサー'],
  ['イソル', 1, 2, 2, 'マンネ'],
  ['ガオン', 3, 2, 4, 'ビジュアル'],
  ['ハンビ', 2, 3, 2, 'ラッパー'],
  ['ウンソル', 5, 1, 2, 'メインボーカル'],
  ['ジェア', 1, 5, 2, 'メインダンサー'],
  ['ルア', 2, 2, 5, 'センター'],
  ['ダルビ', 2, 3, 3, 'ラッパー'],
  ['ノウル', 3, 1, 3, 'リードボーカル'],
  ['イェソル', 2, 2, 2, 'マンネ'],
  ['ミル', 3, 3, 2, 'リーダー'],
  ['ソウン', 3, 3, 3, 'オールラウンダー'],
  ['ヘオン', 1, 3, 3, 'マンネ'],
  ['ボダム', 1, 4, 3, 'ラッパー'],
  ['ヒナタ', 2, 5, 2, 'メインダンサー', '日本'],
  ['コハル', 4, 2, 2, 'リードボーカル', '日本'],
  ['ツムギ', 1, 2, 5, 'ビジュアル', '日本'],
  ['プリム', 2, 4, 3, 'ラッパー', 'タイ'],
  ['ナリン', 2, 3, 4, 'センター', 'タイ'],
  ['ユエ', 2, 4, 2, 'リードダンサー', '中国'],
  ['シンイー', 4, 1, 3, 'メインボーカル', '中国'],
];

const LESSONS = [
  { kind: 'vo', name: 'ボイトレ合宿', eff: 'Vo+2', icon: '🎙️' },
  { kind: 'da', name: 'ダンス特訓', eff: 'Da+2', icon: '👟' },
  { kind: 'vi', name: 'イメチェン', eff: 'Vi+2', icon: '💄' },
  { kind: 'all', name: '総合レッスン', eff: '全能力+1', icon: '📚' },
  { kind: 'free', name: '個人レッスン', eff: '好きな能力+3', icon: '✨' },
];

const EVENTS = [
  { kind: 'buzz', n: 2, name: '直カムがバズった！', icon: '📱', eff: '練習生1人のVi+2、ファン+3（ビジュアルなら2倍）' },
  { kind: 'challenge', n: 2, name: 'チャレンジ動画', icon: '🎬', eff: '他事務所1つを選び、両者ファン+2' },
  { kind: 'fansign', n: 2, name: 'ファンサイン会', icon: '✍️', eff: 'ファン+グループ人数（マンネ1人につき+2）' },
  { kind: 'survival', n: 2, name: 'サバイバル番組に出演', icon: '🔥', eff: '練習生1人の全能力+1。次の週は出演不可' },
  { kind: 'monthly', n: 2, name: '月末評価', icon: '📋', eff: 'グループ全員の能力合計が全事務所で最高ならファン+4' },
  { kind: 'reverse', n: 1, name: '逆走', icon: '📈', eff: '前週のステージで最下位だったらファン+5' },
  { kind: 'poach', n: 2, name: '引き抜き交渉', icon: '🤝', eff: '相手の練習生1人を自分のグループへ。代わりに手札1枚を相手に渡す' },
  { kind: 'comeback', n: 2, name: '電撃カムバック', icon: '⚡', eff: '今週の自分のステージ点×1.5' },
];

export const THEMES = {
  ballad: { id: 'ballad', name: 'バラード回', icon: '🎤', mult: { vo: 2, da: 1, vi: 1 }, fanMul: 1, eff: 'Vo×2' },
  perf: { id: 'perf', name: 'パフォーマンス回', icon: '💃', mult: { vo: 1, da: 2, vi: 1 }, fanMul: 1, eff: 'Da×2' },
  visual: { id: 'visual', name: 'ビジュアル回', icon: '💎', mult: { vo: 1, da: 1, vi: 2 }, fanMul: 1, eff: 'Vi×2' },
  all: { id: 'all', name: '総合回', icon: '🌈', mult: { vo: 1, da: 1, vi: 1 }, fanMul: 1, eff: '倍率なし' },
  yearend: { id: 'yearend', name: '年末特番', icon: '🎆', mult: { vo: 1, da: 1, vi: 1 }, fanMul: 2, eff: 'ファン獲得2倍' },
};

export const HAPPS = {
  award: { id: 'award', name: '年末授賞式シーズン', icon: '🏆', eff: '今週のファン獲得2倍' },
  sound: { id: 'sound', name: '生放送で音響トラブル', icon: '🔇', eff: '今週はVo点が0（ラッパーは除く）' },
  dance: { id: 'dance', name: 'ダンスブレイク回', icon: '🕺', eff: 'Da×2' },
  visual: { id: 'visual', name: 'ビジュアル担当特集', icon: '📸', eff: 'Vi×2' },
  penlight: { id: 'penlight', name: 'ペンライトの海', icon: '🔦', eff: 'グループ5人の事務所はファン+3' },
  overlap: { id: 'overlap', name: '活動時期かぶり', icon: '📅', eff: '今週は1位以外ファン獲得なし' },
  scandal: { id: 'scandal', name: '熱愛報道…と思ったら兄妹でした', icon: '📰', eff: 'ランダムな事務所1つがファン-2、翌週+4' },
  tour: { id: 'tour', name: 'ワールドツアー発表', icon: '✈️', eff: '全員1枚引く（海外メンバー1人につきさらに1枚）' },
};

// 標準カード定義（ID → 定義）
export const STD_CARDS = {};
export const TRAINEE_IDS = [];
export const LESSON_IDS = [];
export const EVENT_IDS = [];

TRAINEES.forEach(([n, vo, da, vi, skill, country], i) => {
  const id = 'T' + String(i + 1).padStart(2, '0');
  const star = n.includes('★');
  STD_CARDS[id] = { id, type: 'trainee', name: n.replace('★', ''), star, vo, da, vi, skill, country: country || '' };
  TRAINEE_IDS.push(id);
});
let li = 0;
LESSONS.forEach(l => {
  for (let k = 0; k < 4; k++) {
    const id = 'L' + String(++li).padStart(2, '0');
    STD_CARDS[id] = { id, type: 'lesson', ...l };
    LESSON_IDS.push(id);
  }
});
let ei = 0;
EVENTS.forEach(e => {
  for (let k = 0; k < e.n; k++) {
    const id = 'E' + String(++ei).padStart(2, '0');
    STD_CARDS[id] = { id, type: 'event', kind: e.kind, name: e.name, icon: e.icon, eff: e.eff };
    EVENT_IDS.push(id);
  }
});
