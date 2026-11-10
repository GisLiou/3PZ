/**
 * 關卡資料：讀取 data/stages/<關卡>.json，補上共用資料（敵人資料庫 data/enemies.json、我方部隊 data/parties.json），
 * 並檢查格式。欄位說明與範例見 docs/關卡格式.md。
 *   getStage(id)        讀出一個關卡（base 繼承、共用資料合併、檢查）
 *   resolveWaveEnemies  一個合戰的敵人清單 → 完整的敵人資料（資料庫＋關卡的 enemies＋該合戰的覆寫）
 *   VictoryTracker      每個合戰的勝利條件：判斷是否過關、產生提示文字
 */
import enemyLibrary from "@data/enemies.json";
import partyLibrary from "@data/parties.json";
import { type Faction, type PieceKind } from "./boardRules";
import { type PartyMemberData } from "./units";
import { type TutorialStep } from "@ui";

// ---------- 敵人 ----------
/** 敵人攻擊結束後對盤面的效果 */
export type BoardEffect =
  /** 把盤面上 count 個小兵（from 種類之一；省略＝任何種類，但不會選到已經是 to 的）換成 to */
  { type: "convert"; to: PieceKind; from?: PieceKind[]; count: number };

/** 攻擊的特效：blood 血花（預設）、fire 火焰、thunder 雷擊、none 不播 */
export type AttackFx = "blood" | "fire" | "thunder" | "none";

/** 一次攻擊（普攻或技能）的內容 */
export interface EnemyActionData {
  /** 對我方部隊的傷害（0＝不攻擊，例：只回血、只改盤面的技能） */
  damage: number;
  fx?: AttackFx;
  /** 攻擊時播放的語音 id（武將圖鑑語音/… 不含副檔名；沒下載語音包時略過） */
  voice?: string;
  /** 攻擊結束後對盤面的效果 */
  boardEffect?: BoardEffect;
  /** 回復自己最大 HP 的比例（0.2＝回 20%） */
  healSelf?: number;
}

/** 普攻：每 interval 回合攻擊一次（頭上「殘 N」；攻擊當下是 0，我方 HP 減少的同時回到 interval） */
export interface EnemyAttackData extends EnemyActionData {
  interval: number;
}

/**
 * 技能：輪到攻擊時，第一個符合 when 的技能取代普攻。
 *   when.every   第 every、2×every…次攻擊時（例：2＝每兩次攻擊用一次）
 *   when.hpBelow HP 低於這個比例時（只用一次）
 *   when.first   第一次攻擊就用（只用一次）
 *   when.chance  機率（0～1）
 */
export interface EnemySkillData extends EnemyActionData {
  /** 技能名稱（攻擊時顯示在敵人頭上） */
  name: string;
  when: { every?: number; hpBelow?: number; first?: boolean; chance?: number };
}

/** 敵人資料（data/enemies.json 或關卡的 enemies 裡的一筆；key＝敵人 id） */
export interface EnemyData {
  name: string;
  /** 立繪素材 id */
  art: string;
  faction: Faction;
  /** 星數：決定大小（越大立繪越大）與站位（見 units.ts 的 arrangeEnemies） */
  stars: number;
  hp: number;
  attack: EnemyAttackData;
  skills?: EnemySkillData[];
  /** 是否在腳下顯示名牌 */
  showName?: boolean;
  /** 合戰開始時的「殘 N」（省略＝attack.interval）；例：每回合攻擊（interval 1）但開場先等 2 回合 */
  firstCountdown?: number;
  /**
   * 先攻：第一個敵人回合就出手（開場「殘 1」，蓋過 firstCountdown），並指定第一次出手的招式：
   * "attack"＝普攻，或技能的 name（不看該技能的 when）
   */
  firstStrike?: string;
}

/** 合戰裡的一個敵人：只寫 id，或 id＋要覆寫的欄位（例：{ "id": "zhouYu", "hp": 200 }） */
export type WaveEnemy = string | ({ id: string } & Partial<EnemyData>);

// ---------- 勝利條件 ----------
/**
 * 合戰的勝利條件（沒寫＝打倒全部敵人，不顯示提示）：
 *   defeat   打倒指定的敵人（targets：敵人 id；同 id 有多個時要全部打倒）
 *   survive  撐過 turns 個敵人回合
 *   combo    一回合達成 count 連擊
 *   damage   一回合造成 amount 以上的傷害
 * hint：自訂提示文字（省略時自動產生）。
 */
export type VictoryCondition =
  | { type: "defeatAll"; hint?: string }
  | { type: "defeat"; targets: string[]; hint?: string }
  | { type: "survive"; turns: number; hint?: string }
  | { type: "combo"; count: number; hint?: string }
  | { type: "damage"; amount: number; hint?: string };

// ---------- 關卡 ----------
export interface WaveData {
  enemies: WaveEnemy[];
  victory?: VictoryCondition;
  /** 這個合戰換背景音樂（省略＝沿用） */
  bgm?: string;
}

export interface TutorialData {
  /** 教學步驟（見 TutorialMask.tsx 的 runTutorialScript） */
  script: TutorialStep[];
  /** guidedMove／intro 用的錄影盤面：起始盤面、規定路徑（[列, 欄]）、每欄的補位佇列 */
  moves?: Record<
    string,
    { before: string; path: number[][]; queues: string[] }
  >;
  /** moves 的盤面記法中代表「主角勢力」的字母（錄影選的是蜀＝G），玩家選別的勢力時自動替換 */
  starterLetter?: string;
}

export interface StageData {
  name: string;
  /** 背景音樂（遊戲素材/BGM 的檔名） */
  bgm: string;
  /** 我方部隊：data/parties.json 的 id，或直接寫陣列 */
  party: string | PartyMemberData[];
  /** 軍略：faction 的武將攻擊力變為 multiplier 倍（"starter"＝主角勢力） */
  leaderSkill?: { faction: Faction | "starter"; multiplier: number };
  /** 盤面：refill＝補位的新小兵（"random" 隨機、"peach" 都是桃子） */
  board: { refill: "random" | "peach" };
  /** 合戰（數量＝合戰數，「合戰 n/總數」的總數就是這裡的個數） */
  waves: WaveData[];
  /** 這個關卡專用的敵人（與 data/enemies.json 同格式；同 id 時覆蓋資料庫） */
  enemies?: Record<string, EnemyData>;
  /** true＝最後一個合戰打完從第一個再來（測試用） */
  endless?: boolean;
  /** 教學（有寫就照 script 執行；沒寫就是一般戰鬥） */
  tutorial?: TutorialData | null;
  /** 繼承另一個關卡，只寫不同的欄位 */
  base?: string;
}

/** 讀出後的關卡（部隊已展開） */
export interface Stage extends Omit<StageData, "party" | "base"> {
  id: string;
  party: PartyMemberData[];
}

const STAGE_FILES = import.meta.glob("/src/data/stages/*.json", {
  eager: true,
  import: "default",
}) as Record<string, StageData>;
const ENEMY_LIBRARY = enemyLibrary as unknown as Record<string, EnemyData>;
const PARTY_LIBRARY = partyLibrary as unknown as Record<
  string,
  PartyMemberData[]
>;

function readStageFile(id: string): StageData {
  const entry = Object.entries(STAGE_FILES).find(([path]) =>
    path.endsWith(`/${id}.json`),
  );
  if (!entry) throw new Error(`找不到關卡 data/stages/${id}.json`);
  const stage = entry[1];
  return stage.base ? { ...readStageFile(stage.base), ...stage } : stage;
}

/** 讀出關卡並檢查（格式錯誤時丟出錯誤，訊息指出是哪個欄位） */
export function getStage(id: string): Stage {
  const data = readStageFile(id);
  const party =
    typeof data.party === "string" ? PARTY_LIBRARY[data.party] : data.party;
  if (!party) throw new Error(`關卡 ${id}：找不到部隊 ${String(data.party)}`);
  if (!data.waves?.length)
    throw new Error(`關卡 ${id}：waves 至少要有一個合戰`);
  const stage: Stage = { ...data, id, party };
  stage.waves.forEach((wave, index) => {
    const where = `關卡 ${id} 的第 ${index + 1} 個合戰`;
    if (!wave.enemies?.length) throw new Error(`${where}：沒有敵人`);
    const enemies = resolveWaveEnemies(stage, index); // 敵人 id 打錯時這裡就會報錯
    for (const enemy of enemies) checkEnemy(enemy, `${where}的 ${enemy.id}`);
    const victory = wave.victory;
    if (victory?.type === "defeat")
      for (const target of victory.targets)
        if (!enemies.some((enemy) => enemy.id === target))
          throw new Error(`${where}：勝利條件的 ${target} 不在這個合戰裡`);
  });
  return stage;
}

/** 檢查敵人的回合數設定（殘 N）與先攻招式 */
function checkEnemy(enemy: EnemyData, where: string) {
  const isTurnCount = (value: unknown) =>
    Number.isInteger(value) && (value as number) >= 1;
  if (!isTurnCount(enemy.attack?.interval))
    throw new Error(`${where}：attack.interval 要是 1 以上的整數`);
  if (enemy.firstCountdown !== undefined && !isTurnCount(enemy.firstCountdown))
    throw new Error(`${where}：firstCountdown 要是 1 以上的整數`);
  const strike = enemy.firstStrike;
  if (
    strike !== undefined &&
    strike !== "attack" &&
    !enemy.skills?.some((skill) => skill.name === strike)
  )
    throw new Error(
      `${where}：firstStrike 要是 "attack" 或這個敵人的技能名稱（找不到 ${strike}）`,
    );
}

/** 一個合戰的敵人：資料庫 ← 關卡的 enemies ← 合戰裡的覆寫 */
export function resolveWaveEnemies(
  stage: Pick<Stage, "id" | "waves" | "enemies">,
  waveIndex: number,
): Array<EnemyData & { id: string }> {
  return stage.waves[waveIndex]!.enemies.map((entry) => {
    const { id, ...override } =
      typeof entry === "string" ? { id: entry } : entry;
    const base = stage.enemies?.[id] ?? ENEMY_LIBRARY[id];
    if (!base)
      throw new Error(
        `關卡 ${stage.id}：找不到敵人 ${id}（data/enemies.json 或關卡的 enemies）`,
      );
    return { ...base, ...override, id };
  });
}

// ---------- 勝利條件 ----------
/** 一回合（我方攻擊）的結果，判斷勝利條件用 */
export interface TurnStats {
  combos: number;
  damage: number;
}
/** 判斷用的敵人狀態 */
interface EnemyState {
  id: string;
  name?: string;
  isDead: boolean;
}

/** 一個合戰的勝利條件：記錄進度、判斷過關、產生提示文字（沒有條件或「打倒全部」時提示為空字串） */
export class VictoryTracker {
  readonly condition: VictoryCondition;
  private enemyTurns = 0;
  private achieved = false;

  constructor(condition: VictoryCondition | undefined) {
    this.condition = condition ?? { type: "defeatAll" };
  }

  /** 我方攻擊後呼叫 */
  recordTurn(stats: TurnStats) {
    const condition = this.condition;
    if (condition.type === "combo" && stats.combos >= condition.count)
      this.achieved = true;
    if (condition.type === "damage" && stats.damage >= condition.amount)
      this.achieved = true;
  }

  /** 敵人回合結束後呼叫 */
  recordEnemyTurn() {
    this.enemyTurns++;
    if (
      this.condition.type === "survive" &&
      this.enemyTurns >= this.condition.turns
    )
      this.achieved = true;
  }

  /** 是否過關（打倒全部敵人一律算過關） */
  isWon(enemies: EnemyState[]) {
    const alive = enemies.filter((enemy) => !enemy.isDead);
    if (!alive.length) return true;
    if (this.condition.type === "defeat") {
      const targets = this.condition.targets;
      return !alive.some((enemy) => targets.includes(enemy.id));
    }
    return this.achieved;
  }

  /** 提示文字（空字串＝不顯示） */
  hint(enemies: EnemyState[]): string {
    const condition = this.condition;
    if (condition.hint !== undefined) return condition.hint;
    switch (condition.type) {
      case "defeatAll":
        return "";
      case "defeat": {
        const names = [
          ...new Set(
            enemies
              .filter((enemy) => condition.targets.includes(enemy.id))
              .map((enemy) => enemy.name ?? enemy.id),
          ),
        ];
        return `打倒${names.join("、")}`;
      }
      case "survive":
        return `撐過 ${condition.turns} 回合\n（還剩 ${Math.max(0, condition.turns - this.enemyTurns)} 回合）`;
      case "combo":
        return `一回合達成\n${condition.count} 連擊`;
      case "damage":
        return `一回合造成\n${condition.amount} 以上的傷害`;
    }
  }
}
