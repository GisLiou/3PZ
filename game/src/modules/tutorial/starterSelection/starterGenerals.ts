/** 主角三選一的資料（選擇武將畫面與教學戰鬥共用） */
const VOICE_ASSETS = '武將圖鑑語音';

export type StarterFaction = 'wei' | 'wu' | 'shu';

export interface StarterGeneral {
  /** 素材檔名中的勢力代號（tutorial_chara_<code>，日文讀音：gi 魏、go 吳、syoku 蜀） */
  assetCode: 'gi' | 'go' | 'syoku';
  faction: StarterFaction;
  name: string;
  description: string;
  portraitAssetId: string;
  /** 盤面記法中的勢力字母（B 魏、R 吳、G 蜀） */
  boardLetter: 'B' | 'R' | 'G';
}

export const STARTER_GENERALS: StarterGeneral[] = [
  { assetCode: 'go', faction: 'wu', name: '孫權', boardLetter: 'R', portraitAssetId: `${VOICE_ASSETS}/2.吳/孫權/S&M/ch_21200001_s`, description: '繼承孫吳霸業遺志的三國志主角之一。擁有尊貴的面相「碧眼紫髯」（藍眼珠與紅棕色的鬍鬚），背負著父親孫堅的期待。' },
  { assetCode: 'syoku', faction: 'shu', name: '劉備', boardLetter: 'G', portraitAssetId: `${VOICE_ASSETS}/3.蜀/劉備/S&M/ch_31200001_s`, description: '中山靖王劉勝的後代，三國志的主角之一。雖然生長於幽州樓桑村的貧困家庭中，仍然胸懷大志，每天都為了助人而四處奔走。' },
  { assetCode: 'gi', faction: 'wei', name: '曹操', boardLetter: 'B', portraitAssetId: `${VOICE_ASSETS}/1.魏/曹操/S&M/ch_11200001_s`, description: '成為中原霸者的三國志主角之一。是個天資聰穎卻喜歡惡作劇的少年，讓身邊的長輩每天都很頭疼，因此小名被喚作「阿瞞」（騙子）。' },
];

/** 預設主角（錄影中玩家選的劉備） */
export const DEFAULT_STARTER = STARTER_GENERALS[1]!;

export const findStarter = (faction: StarterFaction | undefined) => STARTER_GENERALS.find((starter) => starter.faction === faction) ?? DEFAULT_STARTER;
