// ===== データ：オーディション番組「デビューまであと1ステージ」 =====

export const STATS = ['vo', 'da', 'ra', 'vi'];
export const STAT_NAMES = { vo: 'Vo', da: 'Da', ra: 'Rap', vi: 'Vi' };
export const STAT_FULL = { vo: 'ボーカル', da: 'ダンス', ra: 'ラップ', vi: 'ビジュアル' };

// ---------- プレイヤー（練習生）のタイプ ----------
export const TYPES = {
  vocal: { id: 'vocal', name: 'ボーカル型', icon: '🎤', st: { vo: 4, da: 2, ra: 1, vi: 2 }, perk: 'ボーカルがメインの曲でステージ点+4' },
  dance: { id: 'dance', name: 'ダンス型', icon: '💃', st: { vo: 1, da: 4, ra: 2, vi: 2 }, perk: 'ダンスがメインの曲でステージ点+4' },
  rap: { id: 'rap', name: 'ラップ型', icon: '🎧', st: { vo: 1, da: 2, ra: 4, vi: 2 }, perk: 'ラップがメインの曲でステージ点+4' },
  visual: { id: 'visual', name: 'ビジュアル型', icon: '💎', st: { vo: 2, da: 2, ra: 1, vi: 4 }, perk: '毎課題の獲得票+15%' },
  allround: { id: 'allround', name: 'オールラウンダー', icon: '🌈', st: { vo: 2, da: 2, ra: 2, vi: 2 }, perk: '毎課題の開始時、ランダムな能力+1' },
};

// ---------- 課題（ターン） ----------
export const MISSIONS = [
  { n: 1, name: 'レベル分け評価', icon: '🎓', team: 0, mult: 1, desc: 'ひとりでステージに立って実力を見せる。結果でクラス（A〜F）が決まる' },
  { n: 2, name: 'グループバトル', icon: '⚔️', team: 2, mult: 1, rival: true, desc: 'ランダムに組まれた3人チームで、同じ曲のライバルチームと対決' },
  { n: 3, name: 'ポジション評価', icon: '🎯', team: 2, mult: 1.5, pos: true, desc: 'ボーカル・ダンス・ラップ・ビジュアルから自分のポジションを選ぶ。チーム内1位でボーナス' },
  { n: 4, name: 'コンセプト評価', icon: '🎨', team: 3, mult: 1.5, rival: true, desc: '4人チームでコンセプト曲に挑戦。ライバルチームと対決' },
  { n: 5, name: 'デビュー評価', icon: '👑', team: 4, mult: 2, rival: true, desc: '最後の生放送ステージ。得票は2倍！' },
];
export const ELIM = { 2: 20, 4: 14 }; // この課題の後、この順位より下の練習生（NPC）が脱落
export const DEBUT = 11;

// ---------- 課題曲 ----------
// w: 能力ごとの重み（合計6）、diff: 難易度（★）
export const SONGS = {
  S01: { name: 'ときめきスタートライン', w: { vo: 2, da: 1, ra: 1, vi: 2 }, diff: 1, genre: 'ポップ' },
  S02: { name: 'Gravity', w: { vo: 2, da: 2, ra: 1, vi: 1 }, diff: 1, genre: 'ダンスポップ' },
  S03: { name: '夏のせいにして', w: { vo: 2, da: 2, ra: 0, vi: 2 }, diff: 1, genre: '爽やか' },
  S04: { name: 'ピンクの魔法', w: { vo: 1, da: 1, ra: 1, vi: 3 }, diff: 1, genre: 'キュート' },
  S05: { name: '月光セレナーデ', w: { vo: 3, da: 1, ra: 0, vi: 2 }, diff: 2, genre: 'バラード' },
  S06: { name: 'Burning Step', w: { vo: 1, da: 3, ra: 1, vi: 1 }, diff: 2, genre: 'ハードダンス' },
  S07: { name: 'Flow Like Me', w: { vo: 1, da: 1, ra: 3, vi: 1 }, diff: 2, genre: 'ヒップホップ' },
  S08: { name: 'Black Swan', w: { vo: 1, da: 2, ra: 0, vi: 3 }, diff: 2, genre: 'ダーク' },
  S09: { name: 'Into the Fire', w: { vo: 1, da: 2, ra: 2, vi: 1 }, diff: 2, genre: 'ガールクラッシュ' },
  S10: { name: 'Last Breath', w: { vo: 4, da: 1, ra: 0, vi: 1 }, diff: 3, genre: '超高音バラード' },
  S11: { name: 'Chaos Theory', w: { vo: 1, da: 4, ra: 0, vi: 1 }, diff: 3, genre: '激ムズダンス' },
  S12: { name: "Rapstar's Pride", w: { vo: 0, da: 1, ra: 4, vi: 1 }, diff: 3, genre: '高速ラップ' },
  P_vo: { name: 'ボーカルポジション', w: { vo: 5, da: 0, ra: 0, vi: 1 }, diff: 2, genre: 'ポジション', pos: 'vo' },
  P_da: { name: 'ダンスポジション', w: { vo: 0, da: 5, ra: 0, vi: 1 }, diff: 2, genre: 'ポジション', pos: 'da' },
  P_ra: { name: 'ラップポジション', w: { vo: 0, da: 0, ra: 5, vi: 1 }, diff: 2, genre: 'ポジション', pos: 'ra' },
  P_vi: { name: 'ビジュアルポジション', w: { vo: 0, da: 1, ra: 0, vi: 5 }, diff: 2, genre: 'ポジション', pos: 'vi' },
};
export const NORMAL_SONGS = Object.keys(SONGS).filter(k => k.startsWith('S'));
export const POS_SONGS = ['P_vo', 'P_da', 'P_ra', 'P_vi'];
export const DIFF = {
  1: { need: 0, mult: 1.0 },
  2: { need: 6, mult: 1.25 },
  3: { need: 9, mult: 1.6 },
};
export const FAIL_MULT = 0.75;

// ---------- 練習カード ----------
const TRAIN = [
  { kind: 'vo', n: 5, name: 'ボイトレ', icon: '🎙️', eff: 'ボーカル+2' },
  { kind: 'da', n: 5, name: 'ダンス練習', icon: '👟', eff: 'ダンス+2' },
  { kind: 'ra', n: 5, name: 'ラップメイキング', icon: '🎧', eff: 'ラップ+2' },
  { kind: 'vi', n: 5, name: '表情管理', icon: '💄', eff: 'ビジュアル+2' },
  { kind: 'all', n: 4, name: '基礎練習', icon: '📚', eff: '全能力+1' },
  { kind: 'low', n: 3, name: '先生の特訓', icon: '👩‍🏫', eff: 'いちばん低い能力+3' },
  { kind: 'night', n: 3, name: '徹夜練習', icon: '🌙', eff: '好きな能力+3。ただし今回のステージ点-5（寝不足）' },
  { kind: 'study', n: 3, name: '曲の研究', icon: '📝', eff: '選んだ曲のメイン能力+2、今回のステージ点+2' },
  { kind: 'killing', n: 3, name: 'キリングパート獲得', icon: '✨', eff: '今回のステージ点+6' },
  { kind: 'teamprac', n: 3, name: 'チーム練習', icon: '🤝', eff: '今回、チームメイト全員のステージ点+3' },
  { kind: 'swap', n: 2, name: 'メンバー交代', icon: '🔄', eff: 'いちばん弱いチームメイトを別の練習生と入れ替える' },
  { kind: 'reroll', n: 2, name: '選曲やり直し', icon: '🎲', eff: '課題曲の候補を新しい2曲に引き直す' },
  { kind: 'pr', n: 3, name: '個人PR動画', icon: '📹', eff: '得票+600' },
  { kind: 'devil', n: 2, name: '悪魔の編集', icon: '😈', eff: 'ほかのプレイヤー1人の得票-500' },
];
export const CARDS = {};
export const CARD_IDS = [];
let ci = 0;
TRAIN.forEach(t => {
  for (let k = 0; k < t.n; k++) {
    const id = 'K' + String(++ci).padStart(2, '0');
    CARDS[id] = { id, ...t };
    CARD_IDS.push(id);
  }
});

// ---------- ハプニング（各プレイヤーに毎課題1枚） ----------
// team: true はチーム課題でのみ起きる
export const HAPPS = {
  baddancer: { name: 'ダンスが苦手な子と同じチームに！', icon: '😵', team: true, eff: 'チームメイト1人のダンス-3（今回）' },
  badsinger: { name: '音程が不安な子と同じチームに…', icon: '🙉', team: true, eff: 'チームメイト1人のボーカル-3（今回）' },
  ace: { name: '実力者と同じチームに！', icon: '🌟', team: true, eff: 'チームメイト1人が★練習生に入れ替わる' },
  fight: { name: 'パート分けで大揉め', icon: '💢', team: true, eff: 'チーム点-4、でも自分のパートは多め（ステージ点+2）' },
  mood: { name: 'チームの雰囲気が最高！', icon: '🥰', team: true, eff: 'チーム点+6' },
  leader: { name: 'リーダーに選ばれた', icon: '🧢', team: true, eff: 'チーム点+3、得票+200' },
  killing: { name: 'キリングパートを任された！', icon: '🎯', eff: 'ステージ点+5' },
  injury: { name: '練習中に足を痛めた…', icon: '🩹', eff: 'ダンス-2（今回）' },
  cold: { name: '喉の調子が悪い…', icon: '😷', eff: 'ボーカル-2（今回）' },
  devil: { name: '悪魔の編集…', icon: '✂️', eff: '得票-400' },
  angel: { name: '天使の編集！', icon: '👼', eff: '得票+400' },
  mentor: { name: 'トレーナーに褒められた！', icon: '👏', eff: 'いちばん高い能力+1（永続）' },
  fancam: { name: '直カムがバズった！', icon: '📱', eff: '得票+600（ビジュアル型なら+1000）' },
  calm: { name: '平和な練習期間', icon: '🍵', eff: '特に何も起きなかった' },
};

// ---------- NPC練習生（番組のほかの参加者） ----------
export const SKILL_DESC = {
  'メインボーカル': 'ボーカルがメインの曲で+3',
  'リードボーカル': 'ボーカルがメインの曲で+1',
  'メインダンサー': 'ダンスがメインの曲で+3',
  'リードダンサー': 'ダンスがメインの曲で+1',
  'ラッパー': 'ラップがメインの曲で+3',
  'ビジュアル': 'ビジュアルがメインの曲で+3',
  'センター': 'チーム点+2',
  'リーダー': 'チーム点+2',
  'マンネ': '同じチームのあなたの得票+200',
  'オールラウンダー': 'いつでも+2',
  'なし': '特技なし',
};
export const SKILL_LIST = Object.keys(SKILL_DESC);
export const SKILL_TONE = {
  'メインボーカル': 'vo', 'リードボーカル': 'vo',
  'メインダンサー': 'da', 'リードダンサー': 'da', 'ラッパー': 'da',
  'センター': 'vi', 'ビジュアル': 'vi',
  'リーダー': 'etc', 'マンネ': 'etc', 'オールラウンダー': 'etc', 'なし': 'etc',
};
export const FLAGS = { '日本': '🇯🇵', 'タイ': '🇹🇭', '中国': '🇨🇳', '韓国': '🇰🇷', 'アメリカ': '🇺🇸' };

// 名前, Vo, Da, Rap, Vi, 特技, 国
const TRAINEES = [
  ['ハユン★', 5, 2, 1, 3, 'メインボーカル'],
  ['ソア★', 2, 5, 3, 3, 'メインダンサー'],
  ['ダオン★', 3, 3, 2, 5, 'センター'],
  ['セア★', 3, 4, 3, 3, 'オールラウンダー'],
  ['ジオ', 2, 4, 5, 2, 'ラッパー'],
  ['ハリン', 4, 2, 1, 2, 'リードボーカル'],
  ['セビン', 3, 3, 3, 3, 'リーダー'],
  ['ラオン', 1, 3, 2, 4, 'ビジュアル'],
  ['ヨルム', 4, 3, 1, 1, 'リードボーカル'],
  ['ナビ', 2, 4, 3, 3, 'リードダンサー'],
  ['イソル', 1, 2, 1, 2, 'マンネ'],
  ['ガオン', 3, 2, 2, 4, 'ビジュアル'],
  ['ハンビ', 2, 3, 4, 2, 'ラッパー'],
  ['ウンソル', 5, 1, 1, 2, 'メインボーカル'],
  ['ジェア', 1, 5, 3, 2, 'メインダンサー'],
  ['ルア', 2, 2, 1, 5, 'センター'],
  ['ダルビ', 2, 3, 4, 3, 'ラッパー'],
  ['ノウル', 3, 1, 2, 3, 'リードボーカル'],
  ['イェソル', 2, 2, 2, 2, 'マンネ'],
  ['ミル', 3, 3, 2, 2, 'リーダー'],
  ['ソウン', 3, 3, 3, 3, 'オールラウンダー'],
  ['ヘオン', 1, 3, 2, 3, 'マンネ'],
  ['ボダム', 1, 4, 5, 3, 'ラッパー'],
  ['ヒナタ', 2, 5, 2, 2, 'メインダンサー', '日本'],
  ['コハル', 4, 2, 1, 2, 'リードボーカル', '日本'],
  ['ツムギ', 1, 2, 1, 5, 'ビジュアル', '日本'],
  ['プリム', 2, 4, 5, 3, 'ラッパー', 'タイ'],
  ['ナリン', 2, 3, 2, 4, 'センター', 'タイ'],
  ['ユエ', 2, 4, 3, 2, 'リードダンサー', '中国'],
  ['シンイー', 4, 1, 1, 3, 'メインボーカル', '中国'],
];
export const NPCS = {};
export const NPC_IDS = [];
TRAINEES.forEach(([n, vo, da, ra, vi, skill, country], i) => {
  const id = 'T' + String(i + 1).padStart(2, '0');
  NPCS[id] = { id, name: n.replace('★', ''), star: n.includes('★'), vo, da, ra, vi, skill, country: country || '' };
  NPC_IDS.push(id);
});
