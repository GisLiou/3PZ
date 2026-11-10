/**
 * 戰鬥演出速度：消珠、連擊、攻擊（我方與敵人）的演出時間都除以這個數；1＝原版速度。
 * 各檔的時間常數寫成 fast(原版毫秒)，原版的數字與來源註解保留不變。開場、拖曳、合戰大字、勝利不受影響。
 */
export const BATTLE_ANIMATION_SPEED = 1.6;
export const fast = (originalMs: number) => originalMs / BATTLE_ANIMATION_SPEED;

/**
 * 戰鬥用素材 id（全部為 遊戲素材/ 的原版檔案，路徑＝素材 id）。
 * 接著是：戰鬥用圖集的零件序號與樣式；共用的 DOM 小工具（點陣字圖、絕對定位的圖、轉 90° 的零件）與版面常數；
 * 最後：戰鬥的資料型別（部隊成員、敵人的定義、軍略、一回合的結果）。
 */
import { type EnemyAttackData, type EnemySkillData } from "./stageData";
import { type Faction, type PieceKind, type MatchGroup } from "./boardRules";
import { type ArtBounds } from "./formation";
import {
  atlasPartStyle,
  NAVIGATOR_ASSET,
  type AtlasPartRect,
  getCachedFontSheet,
  layoutBitmapText,
  placeGlyphElements,
  tintedFontSheet,
} from "@ui";
import layoutAtlas from "@data/atlas/puzzlelayout.json";
import tutorialAtlas from "@data/atlas/tutorialImg.json";
import effectAtlas from "@data/atlas/effect_data.json";
import { type CSSProperties } from "react";
import { designUnit } from "@core/stage";

export const BATTLE_ASSETS = {
  sky: "UI等/戰鬥背景/bg_board/bg_board_000000",
  ground: "UI等/ground/ground_000000",
  boardGrid: "UI等/戰鬥效果/新建文件夾/pazzle_grid",
  menuButton: "UI等/戰鬥效果/新建文件夾/button",
  partyHpGauge: "UI等/戰鬥效果/新建文件夾/pazzle_myhpgauge",
  enemyHpFrame: "UI等/戰鬥效果/新建文件夾/HPBarFrame1",
  enemyHpFill: "UI等/戰鬥效果/新建文件夾/HPGaugeBase",
  enemyNamePlate: "UI等/戰鬥效果/新建文件夾/namePlate",
  layoutAtlas: "UI等/戰鬥效果/puzzlelayout",
  tutorialAtlas: "UI等/戰鬥效果/tutorialImg",
  effectAtlas: "UI等/戰鬥效果/effect_data",
  victoryChar1: "UI等/戰鬥特效/win_efe01",
  victoryChar2: "UI等/戰鬥特效/win_efe02",
  victoryChar3: "UI等/戰鬥特效/win_efe03",
  victoryLight: "UI等/戰鬥特效/win_efe04",
  hitBurst: "UI等/戰鬥特效/attackeffect2",
  /** 各兵種的攻擊特效：劍兵斬擊、蠻兵劈砍、槍兵突刺、騎兵衝擊、弓兵的箭與命中、神算的火球與火焰、鬼謀的竹簡與伏兵 */
  strikeSlash: "UI等/戰鬥特效/zangeki_ef",
  strikeChop: "UI等/戰鬥特效/axe_ef",
  strikeThrust: "UI等/戰鬥特效/spear_ef_00",
  strikeThrustRays: "UI等/戰鬥特效/spear_ef_01",
  strikeCharge: "UI等/戰鬥特效/trooper_ef",
  arrow: "UI等/戰鬥特效/ya",
  fireBolt: "UI等/戰鬥特效/shinsan_ef",
  fireFrames: Array.from(
    { length: 10 },
    (_, i) => `UI等/戰鬥特效/fire_${String(i + 1).padStart(2, "0")}`,
  ),
  summonScroll: [0, 1, 2, 3].map((i) => `UI等/戰鬥特效/chikukan0${i}`),
  /** 敵人技能打到我方的火焰、雷擊 */
  enemyFire: [
    "UI等/戰鬥特效/comboeffect_fire1",
    "UI等/戰鬥特效/comboeffect_fire2",
  ],
  enemyThunder: [
    "UI等/戰鬥特效/comboeffect_thunder3_big",
    "UI等/戰鬥特效/comboeffect_thunder12",
  ],
  /** 鬼謀的伏兵與紫色墨花（kibou001，座標 data/atlas/kibou001.json） */
  summonAtlas: "UI等/戰鬥效果/kibou001",
  arrowHit: "UI等/戰鬥特效/arrow_ef_00",
  arrowHitRays: "UI等/戰鬥特效/arrow_ef_01",
  hitRays: "UI等/戰鬥特效/attackeffect14",
  hitRing: "UI等/戰鬥特效/attackeffect16",
  /** 右上角的勢力相剋圖 */
  factionRelationChart: "UI等/勢力相剋/L/adv_sa_468301_l",
  /** 魂（白色雲，畫面上以濾鏡染成粉紅） */
  soul: "UI等/戰鬥特效/ef_souldrop00",
  /** 敵人死亡的煙霧 */
  deathSmoke: [
    "UI等/戰鬥特效/ef_souldrop03",
    "UI等/戰鬥特效/ef_souldrop04",
    "UI等/戰鬥特效/ef_souldrop05",
  ],
  /** 教學的玲玲（全身，先預載）；表情零件 eye_/mouth_/mayu_*_s 的合成位置尚未解出（docs/復刻分析/02 §待確認） */
  navigatorLingling: NAVIGATOR_ASSET,
} as const;

/** 戰鬥開場一出現就要看到的圖（在前一個畫面先預載，避免開場時背景還在載入） */
export const BATTLE_INTRO_PRELOAD_ASSETS: string[] = [
  BATTLE_ASSETS.sky,
  BATTLE_ASSETS.ground,
  BATTLE_ASSETS.boardGrid,
  BATTLE_ASSETS.menuButton,
  BATTLE_ASSETS.partyHpGauge,
  BATTLE_ASSETS.layoutAtlas,
  BATTLE_ASSETS.factionRelationChart,
];

/** 勢力光焰（軍略發動時武將頭上的光，kouyou_*） */
export const FACTION_AURA_ASSETS: Record<Faction, string> = {
  wei: "UI等/戰鬥特效/kouyou_blue_1",
  wu: "UI等/戰鬥特效/kouyou_red1",
  shu: "UI等/戰鬥特效/kouyou_green1",
  han: "UI等/戰鬥特效/kouyou_purple1",
  qun: "UI等/戰鬥特效/kouyou_gray1",
};

/** 傷害數字顏色（v5 149385：蜀綠 84、漢紫 129、群白 92） */
export const DAMAGE_NUMBER_COLORS: Record<PieceKind, string> = {
  wei: "#3aa8ff",
  wu: "#ff3a2a",
  shu: "#9cff3a",
  han: "#d070ff",
  qun: "#ffffff",
  peach: "#9cff3a",
};

/** 點陣字型（遊戲素材/UI等/字體 的檔名） */
export const BATTLE_FONTS = {
  number: "BFBattleNum",
  comboNumber: "BFComboNumber",
  enemyCountdown: "BFEnemyCountDown",
  waveLabel: "BF_BattleCnt",
  waveNumber: "BF_BattleCntNum",
} as const;

/**
 * 戰鬥用圖集的零件（座標表 data/atlas/*.json 由 _開發工具_不需修改/素材轉檔/slice-atlas.py 依透明度切出）。
 * rotationDeg=-90：零件在圖集中轉 90° 存放，顯示時轉回。
 */
const layoutParts = (layoutAtlas as { parts: AtlasPartRect[] }).parts;
const tutorialParts = (tutorialAtlas as { parts: AtlasPartRect[] }).parts;
const effectParts = (effectAtlas as { parts: AtlasPartRect[] }).parts;

/** puzzlelayout（512×1024）零件用途（對照 docs/復刻分析/02 §3） */
export const LAYOUT_PART = {
  hpBarBackground: 2,
  hpBarPink: 5,
  messageBand: 7,
  chest: 37,
  heart: 61,
  menuText: 51,
  target: 50,
  targetRing: 25,
} as const;
/** tutorialImg（128×256）零件：0 直條、1 手(右指)、2 橫條、3 手(上指)、4 ▶、5 ●、6 ▼、7 ◀ */
export const TUTORIAL_PART = {
  verticalBar: 0,
  handPointRight: 1,
  horizontalBar: 2,
  handPointUp: 3,
  arrowRight: 4,
  dot: 5,
  arrowDown: 6,
  arrowLeft: 7,
} as const;
/** effect_data（512×1024）零件：6 紅色血花、13 白色放射光、0 紅色斬線、5 白色弧光 */
export const EFFECT_PART = {
  redSlash: 0,
  whiteArc: 5,
  bloodSplash: 6,
  whiteRays: 13,
} as const;

export const layoutPartStyle = (index: number, scale = 1, rotationDeg = 0) =>
  atlasPartStyle(
    BATTLE_ASSETS.layoutAtlas,
    layoutParts[index]!,
    512,
    1024,
    scale,
    rotationDeg,
  );
export const layoutPartRect = (index: number) => layoutParts[index]!;
export const tutorialPartStyle = (index: number, scale = 1) =>
  atlasPartStyle(
    BATTLE_ASSETS.tutorialAtlas,
    tutorialParts[index]!,
    128,
    256,
    scale,
  );
export const tutorialPartRect = (index: number) => tutorialParts[index]!;
export const effectPartStyle = (index: number, scale = 1) =>
  atlasPartStyle(
    BATTLE_ASSETS.effectAtlas,
    effectParts[index]!,
    512,
    1024,
    scale,
  );
export const effectPartRect = (index: number) => effectParts[index]!;

/**
 * 戰鬥畫面共用的常數與 DOM 小工具。
 * 「版面座標」：以螢幕底部往上 999 設計單位為 y=0（由上而下）；螢幕較高時上方多出的空間是負的 y。
 * 各元件放在哪裡由元件標籤（<Board x y /> 等，./BattleCanvas.tsx）決定，組合見 ./StandardBattleLayout.tsx。
 */
/** 底部基準版面的高度 */
export const BATTLE_LAYOUT_HEIGHT = 999;

export type TextAnchor = "left" | "right" | "center";

/**
 * 把點陣字畫到 element 上（取代原本內容）。text 為空字串時隱藏。
 * height＝顯示字高；x,y＝錨點位置（設計單位）。
 */
export async function setBitmapTextImage(
  element: HTMLElement,
  font: string,
  text: string,
  color: string,
  height: number,
  x: number,
  y: number,
  anchor: TextAnchor = "left",
) {
  if (!text) {
    element.style.display = "none";
    return;
  }
  // 逐字排列（上色字型圖每種顏色只做一次），每禎改數字也不會卡
  const sheetUrl =
    getCachedFontSheet(font, color) ?? (await tintedFontSheet(font, color));
  const layout = layoutBitmapText(font, text);
  const scale = height / layout.height,
    width = layout.width * scale;
  const left =
    anchor === "right" ? x - width : anchor === "center" ? x - width / 2 : x;
  Object.assign(element.style, {
    display: "block",
    left: designUnit(left),
    top: designUnit(y),
    width: designUnit(width),
    height: designUnit(height),
    background: "none",
  });
  placeGlyphElements(element, layout, sheetUrl, scale);
}

/** 建立一個絕對定位的 <i>，套上指定樣式並放進 parent */
export function createImageElement(
  parent: HTMLElement | null,
  style: Partial<CSSStyleDeclaration> = {},
  className?: string,
): HTMLElement {
  const element = document.createElement("i");
  if (className) element.className = className;
  Object.assign(element.style, style);
  parent?.appendChild(element);
  return element;
}

/** puzzlelayout 中轉 90° 存放的零件，轉回後放在 (x,y)、拉成 width×height 的樣式 */
export function rotatedLayoutPartStyle(
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
): Partial<CSSStyleDeclaration> {
  const rect = layoutPartRect(index),
    scaleX = height / rect.w,
    scaleY = width / rect.h;
  return {
    ...layoutPartStyle(index),
    width: designUnit(height),
    height: designUnit(width),
    left: designUnit(x + width / 2 - height / 2),
    top: designUnit(y + height / 2 - width / 2),
    transform: "rotate(-90deg)",
    backgroundSize: `${designUnit(512 * scaleX)} ${designUnit(1024 * scaleY)}`,
    backgroundPosition: `${designUnit(-rect.x * scaleX)} ${designUnit(-rect.y * scaleY)}`,
  };
}

/** 同上，直接建立元素 */
export function createRotatedLayoutPart(
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const element = document.createElement("i");
  Object.assign(
    element.style,
    rotatedLayoutPartStyle(index, x, y, width, height),
  );
  return element;
}

/** DOM 樣式物件 → React style（兩者的值都是 CSS 字串） */
export const reactStyle = (style: Partial<CSSStyleDeclaration>) =>
  style as unknown as CSSProperties;

/** 重新觸發 CSS 動畫 class（例：晃動） */
export function restartCssAnimation(element: HTMLElement, className: string) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

/** 戰鬥的資料型別：部隊成員、敵人的定義（由關卡／教學資料提供）與戰鬥中的狀態 */
/** 我方武將（部隊成員）的定義 */
export interface PartyMemberDefinition {
  id: string;
  faction: Faction;
  attack: number;
  recovery: number;
  hp: number;
  /** 頭像素材 id */
  portraitAssetId: string;
  /** 兵種（攻擊時衝出去的小兵） */
  troop: TroopType;
}

/** 兵種（data/troops.json）：騎兵、弓兵、槍兵、劍兵、神算、鬼謀、蠻兵 */
export type TroopType =
  | "cavalry"
  | "archer"
  | "spearman"
  | "swordsman"
  | "tactician"
  | "schemer"
  | "barbarian";

/** 敵人的定義。x,y＝腳底位置（底部 999 版面的設計單位），scale＝立繪縮放 */
export interface EnemyDefinition {
  id: string;
  name?: string;
  /** 立繪素材 id */
  artAssetId: string;
  faction: Faction;
  stars: number;
  hp: number;
  /** 普攻（interval＝每幾回合攻擊一次，攻擊後頭上「殘 N」回到這個數） */
  attack: EnemyAttackData;
  /** 技能（符合條件時取代普攻） */
  skills: EnemySkillData[];
  /** 開場的「殘 N」（省略＝attack.interval） */
  firstCountdown?: number;
  /** 先攻：開場「殘 1」，第一次出手用這招（"attack"＝普攻，或技能名稱） */
  firstStrike?: string;
  x: number;
  y: number;
  scale: number;
  /** 立繪看得到的部分的寬度（設計單位；HP 條長度依這個） */
  visibleWidth: number;
  /** 點擊判定用的透明度遮罩（見 formation.ts 的 ArtBounds） */
  hitMask?: ArtBounds["mask"];
  /** 是否在腳下顯示名牌 */
  showName?: boolean;
}

/** 軍略（大將技能）：指定勢力的武將攻擊力變為 multiplier 倍 */
export interface LeaderSkill {
  faction: Faction;
  factionName: string;
  multiplier: number;
}

/** 一回合的結果 */
export interface TurnResult {
  groups: MatchGroup[];
  combos: number;
  /** 這回合對敵人造成的總傷害（全體攻擊時每個敵人都算；勝利條件 damage 用） */
  damage: number;
}
