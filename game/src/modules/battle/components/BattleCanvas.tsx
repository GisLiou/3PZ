/**
 * 戰鬥畫布：用元件標籤組合戰鬥畫面（組合範例見 ./StandardBattleLayout.tsx）。
 *
 *   <BattleCanvas party={…} onReady={(battle) => …}>
 *     <Scenery />
 *     <Board x={0} y={540} />
 *     <PartyHpBar x={10} y={508} w={620} />
 *     …
 *   </BattleCanvas>
 *
 * 規則：
 *   1. 每個標籤都有 x、y（設計單位，元件左上角）與 anchor：
 *        "bottom"（預設）：y 以「螢幕底部往上 999」為 0（原版 640×999 的版面座標，螢幕再高也貼著底部）
 *        "top"：y 以螢幕最上緣為 0（寶箱、Menu 這類固定在螢幕頂端的 UI）
 *      大小用 w／h（只寫 w 時 h 依原圖比例），其餘屬性依元件而定。
 *   2. 標籤的先後順序＝圖層順序：寫在後面的蓋在前面的上方。
 *   3. UI 元件（檔案後段：頭像、HP 條、寶箱、相剋圖、Menu）是一般的 React 元件；盤面、敵人、背景、效果層這類大量動畫的元件，
 *      由 BattleScreen 在全部標籤放好之後建立內容（onReady 拿到的 battle 已經全部就緒）。
 *   4. 熱更新：改了標籤的 x、y、w…，存檔後畫面立刻跟著動（元件外框重新定位；BattleScreen 每次都讀最新的屬性）。
 *      只有在建立時讀一次的屬性（例：<Scenery y>）要重新整理才會生效。
 * 這個檔案：畫布、共用的 CanvasPart、戰鬥狀態（HP、寶箱數，給 UI 元件顯示），以及盤面／敵人／背景／效果層／小兵層的標籤。
 */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { currentStage, designUnit } from "@core/stage";
import { BattleScreen } from "../logic/BattleScreen";
import {
  type PartyMemberDefinition,
  BATTLE_LAYOUT_HEIGHT,
  BATTLE_ASSETS,
  BATTLE_FONTS,
  DAMAGE_NUMBER_COLORS,
  LAYOUT_PART,
  layoutPartRect,
  layoutPartStyle,
  reactStyle,
  rotatedLayoutPartStyle,
} from "../logic/battleAssets";
import { getAssetSize, getAssetUrl } from "@core/assetLoader";
import { BitmapText } from "@ui";

// ---------- 位置 ----------
export type Anchor = "top" | "bottom";
export interface Placement {
  x: number;
  y: number;
  anchor: Anchor;
}
/** 元件屬性：位置＋各元件自己的屬性 */
export type PartProps = Placement & Record<string, number | string>;

/**
 * 元件外框的大小：
 *   point  ＝0×0 的點，內容從 (x, y) 往右下畫（大部分元件）
 *   layout ＝640×999 的版面大小（效果層、小兵層、教學遮罩：裡面用版面座標）
 *   screen ＝整個螢幕（背景）
 */
export type PartBox = "point" | "layout" | "screen";

function placementStyle(
  { x, y, anchor }: Placement,
  box: PartBox,
): CSSProperties {
  if (box === "screen") return { left: 0, top: 0, right: 0, bottom: 0 };
  const top =
    anchor === "top"
      ? designUnit(y)
      : `calc(100% - ${designUnit(BATTLE_LAYOUT_HEIGHT - y)})`;
  const size =
    box === "layout"
      ? { width: designUnit(640), height: designUnit(BATTLE_LAYOUT_HEIGHT) }
      : { width: 0, height: 0 };
  return { left: designUnit(x), top, ...size };
}

/** 元件原點在版面座標中的位置（anchor="top" 的元件會隨螢幕高度換算） */
export function layoutOrigin({ x, y, anchor }: Placement) {
  return {
    x,
    y: anchor === "top" ? y - (currentStage.height - BATTLE_LAYOUT_HEIGHT) : y,
  };
}

// ---------- 戰鬥狀態（UI 元件顯示用） ----------
export interface HudValues {
  hp: number;
  maxHp: number;
  chest: number;
  /** 這個合戰的勝利條件提示（空字串＝不顯示） */
  victoryHint: string;
}

/** 戰鬥中會變的數值；BattleScreen 更新，UI 元件用 useHud() 顯示 */
export class HudState {
  private values: HudValues = { hp: 0, maxHp: 1, chest: 0, victoryHint: "" };
  private listeners = new Set<() => void>();
  get current() {
    return this.values;
  }
  set(patch: Partial<HudValues>) {
    this.values = { ...this.values, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

// ---------- 畫布 ----------
/** 畫布上的一個元件（BattleScreen 依這份清單建立內容） */
export interface CanvasPartEntry {
  /** 元件種類（board、hpBar…） */
  kind: string;
  /** 識別名稱（預設＝種類；同種類有多個時用 id 屬性區分） */
  id: string;
  props: PartProps;
  /** 元件外框（內容畫在裡面，座標以外框左上為原點） */
  element: HTMLDivElement;
}

interface CanvasContextValue {
  register(entry: CanvasPartEntry): () => void;
  hud: HudState;
  party: PartyMemberDefinition[];
}
const CanvasContext = createContext<CanvasContextValue | null>(null);

function useCanvas(kind: string) {
  const context = useContext(CanvasContext);
  if (!context) throw new Error(`<${kind}> 必須放在 <BattleCanvas> 裡面`);
  return context;
}
/** UI 元件讀取戰鬥狀態（數值變了會重新繪製） */
export function useHud() {
  const hud = useCanvas("useHud").hud;
  return useSyncExternalStore(hud.subscribe, () => hud.current);
}
/** UI 元件讀取我方部隊 */
export function useParty() {
  return useCanvas("useParty").party;
}

interface CanvasPartProps {
  kind: string;
  /** 標籤上寫的屬性 */
  props: Partial<PartProps> & { id?: string };
  /** 沒寫時的預設值 */
  defaults: Partial<PartProps>;
  box?: PartBox;
  /** React 內容（UI 元件）；拿到合併好的屬性 */
  children?: (props: PartProps) => ReactNode;
}

/** 所有元件標籤共用：放一個定位好的外框、登記到畫布，並畫出 React 內容（有的話） */
export function CanvasPart({
  kind,
  props,
  defaults,
  box = "point",
  children,
}: CanvasPartProps) {
  const context = useCanvas(kind);
  const id = String(props.id ?? kind);
  const merged = {
    x: 0,
    y: 0,
    anchor: "bottom",
    ...defaults,
    ...props,
  } as PartProps;
  const ref = useRef<HTMLDivElement>(null);
  // 每個標籤只登記一次；屬性每次繪製都更新到同一筆登記上（熱更新改了數值，BattleScreen 立刻讀到）
  const entry = useRef<CanvasPartEntry | null>(null);
  if (entry.current) entry.current.props = merged;
  // 子元件的 layout effect 比 BattleCanvas 的 effect 早執行，所以畫布建立內容時清單已經齊全
  useLayoutEffect(() => {
    entry.current = { kind, id, props: merged, element: ref.current! };
    return context.register(entry.current);
  }, []);
  return (
    <div
      ref={ref}
      className={`battle-part battle-part-${kind}`}
      data-part={id}
      style={placementStyle(merged, box)}
    >
      {children?.(merged)}
    </div>
  );
}

interface BattleCanvasProps {
  /** 我方部隊 */
  party: PartyMemberDefinition[];
  /** 畫面建好時呼叫（只呼叫一次） */
  onReady: (battle: BattleScreen) => void;
  children: ReactNode;
}

export function BattleCanvas({ party, onReady, children }: BattleCanvasProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const entries = useRef<CanvasPartEntry[]>([]);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const hud = useMemo(() => new HudState(), []);
  const context = useMemo<CanvasContextValue>(
    () => ({
      register: (entry) => {
        entries.current.push(entry);
        return () => {
          entries.current = entries.current.filter((item) => item !== entry);
        };
      },
      hud,
      party,
    }),
    [hud, party],
  );

  useEffect(() => {
    // 依畫面上的順序（＝標籤順序）排好，交給 BattleScreen 建立內容
    const ordered = [...entries.current].sort((a, b) =>
      a.element.compareDocumentPosition(b.element) &
      Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    );
    const battle = new BattleScreen(screenRef.current!, ordered, party, hud);
    onReadyRef.current(battle);
    return () => battle.destroy();
    // 畫布只建立一次（party 也只在建立時讀取）；要換版面時由外層改 key 重新建立
  }, []);

  return (
    <div className="battle-screen" ref={screenRef}>
      <CanvasContext.Provider value={context}>
        {children}
      </CanvasContext.Provider>
    </div>
  );
}

// ---------- 由 BattleScreen 建立內容的元件標籤 ----------
type Props<Extra extends string = never> = Partial<
  Pick<PartProps, "x" | "y" | "anchor">
> & { id?: string } & Partial<Record<Extra, number>>;

/** 背景（天空＋透視地面），鋪滿整個螢幕。y＝整片背景往下移多少（地平線預設在版面 y=205） */
export const Scenery = (props: Props) => (
  <CanvasPart kind="scenery" box="screen" props={props} defaults={{ y: 0 }} />
);

/** 敵人區：敵人資料裡的 x, y（腳底中心）以這裡為原點 */
export const Enemies = (props: Props) => (
  <CanvasPart kind="enemies" props={props} defaults={{ x: 0, y: 0 }} />
);

/** 盤面（7×5，640×457）：x, y＝左上角 */
export const Board = (props: Props) => (
  <CanvasPart kind="board" props={props} defaults={{ x: 0, y: 540 }} />
);

/** 效果層：魂、傷害數字、頭上小兵、軍略訊息帶、命中特效…（版面座標，通常不用移動） */
export const Effects = (props: Props) => (
  <CanvasPart
    kind="effects"
    box="layout"
    props={props}
    defaults={{ x: 0, y: 0 }}
  />
);

/** 衝鋒小兵層（攻擊時跑向敵人的大隻小兵與命中爆光）：h＝小兵高度（v5 實測約 100） */
export const Troops = (props: Props<"h">) => (
  <CanvasPart
    kind="troops"
    box="layout"
    props={props}
    defaults={{ x: 0, y: 0, h: 100 }}
  />
);

/**
 * 戰鬥 UI 元件（React）：和 TextLabel、Sprite 一樣用 x、y、w、h 擺放，放進 <BattleCanvas> 就會出現。
 *   <PartyPortraits x={10} y={405} size={100} gap={5} />   我方頭像
 *   <PartyHpBar x={10} y={508} w={620} />                   HP 條（愛心、底框、HP 條、數字）
 *   <ChestCounter anchor="top" x={8} y={48} w={29.7} />     寶箱與數量
 *   <RelationChart anchor="top" x={514.22} y={104.72} w={141.36} />  勢力相剋圖
 *   <MenuButton anchor="top" x={493} y={46} w={140.6} />    Menu 按鈕
 *   <VictoryHint anchor="top" x={466} y={192} w={170} size={18} />  勝利條件提示（合戰沒有設定勝利條件時不顯示）
 *   <WaveBanner y={126} h={64} gap={14} />                  「合戰 n/m」大字的位置
 * 只寫 w 時，h 依原圖比例；x, y＝左上角。數值（HP、寶箱數）由 useHud() 取得，戰鬥中變動會自動更新。
 */
const num = (props: PartProps, key: string) => Number(props[key]);

/** 我方頭像：x, y＝第一位頭像左上角；size＝頭像邊長；gap＝頭像之間的空隙 */
export const PartyPortraits = (props: Props<"size" | "gap">) => (
  <CanvasPart
    kind="portraits"
    props={props}
    defaults={{ x: 10, y: 405, size: 100, gap: 5 }}
  >
    {(merged) => (
      <Portraits size={num(merged, "size")} gap={num(merged, "gap")} />
    )}
  </CanvasPart>
);
function Portraits({ size, gap }: { size: number; gap: number }) {
  return (
    <>
      {useParty().map((member, index) => (
        <i
          key={member.id}
          className="party-member"
          style={{
            left: designUnit((size + gap) * index),
            top: 0,
            width: designUnit(size),
            height: designUnit(size),
            backgroundImage: `url(${getAssetUrl(member.portraitAssetId)})`,
          }}
        />
      ))}
    </>
  );
}

/** HP 條原版尺寸（v5 量測）：全寬 620＝愛心 40＋底框 580；HP 條本體高 16，填滿底框內側 */
export const HP_BAR_WIDTH = 620;
/** HP 條：x, y＝愛心左上角；w＝全寬（底框、HP 條、數字位置跟著等比拉長） */
export const PartyHpBar = (props: Props<"w">) => (
  <CanvasPart
    kind="hpBar"
    props={props}
    defaults={{ x: 10, y: 508, w: HP_BAR_WIDTH }}
  >
    {(merged) => <HpBar w={num(merged, "w")} />}
  </CanvasPart>
);
function HpBar({ w }: { w: number }) {
  const { hp, maxHp } = useHud();
  const { shown, trail, healing } = useHpAnimation(hp, maxHp);
  const frameWidth = w - 40;
  /** HP 條本體：填滿底框內側（左右各留 10），數字下方也有 */
  const barWidth = frameWidth - 20;
  const ratio = (value: number) => Math.max(0, Math.min(1, value / maxHp));
  const barStyle = (value: number): CSSProperties => ({
    left: designUnit(50),
    top: designUnit(11),
    width: designUnit(barWidth),
    height: designUnit(16),
    transformOrigin: "0 50%",
    transform: `scaleX(${ratio(value)})`,
  });
  return (
    <>
      <i
        style={reactStyle(
          rotatedLayoutPartStyle(
            LAYOUT_PART.hpBarBackground,
            40,
            5,
            frameWidth,
            28,
          ),
        )}
      />
      {/* 變化量：受傷時是紅色、慢一點才縮回去；回復時是綠色、HP 條隨後長過去 */}
      <i
        style={{
          ...barStyle(trail),
          background: healing ? HP_HEAL_COLOR : HP_DAMAGE_COLOR,
        }}
      />
      <i
        style={{
          ...barStyle(shown),
          backgroundImage: `url(${getAssetUrl(BATTLE_ASSETS.partyHpGauge)})`,
          backgroundSize: "100% 100%",
        }}
      />
      <i
        style={{
          ...reactStyle(layoutPartStyle(LAYOUT_PART.heart, 0.8)),
          left: 0,
          top: 0,
        }}
      />
      <BitmapText
        font={BATTLE_FONTS.number}
        text={`${Math.round(shown)}/${maxHp}`}
        color={DAMAGE_NUMBER_COLORS.shu}
        h={32}
        x={w - 2}
        y={2}
        anchor="right"
      />
    </>
  );
}

const HP_DAMAGE_COLOR = "linear-gradient(#ffd9cf, #e8392b 60%, #a3170e)";
const HP_HEAL_COLOR = "linear-gradient(#efffe6, #5bdc46 60%, #23901a)";

/** HP 條的動畫時間（毫秒） */
const hpBarTiming = {
  /** 受傷：HP 條縮短、數字遞減 */
  damageMs: 300,
  /** 受傷：紅色部分先停住，再縮回去 */
  trailHoldMs: 250,
  trailDrainMs: 400,
  /** 回復：HP 條變長、數字遞增 */
  healMs: 600,
} as const;

/**
 * HP 變化的動畫：shown＝目前顯示的 HP（數字與 HP 條，逐步遞增／遞減），
 * trail＝變化量的另一端（受傷時是原本的 HP、慢慢縮回；回復時是新的 HP）。
 * 部隊換了（maxHp 改變，例：戰鬥開始）時直接顯示，不播動畫。
 */
function useHpAnimation(hp: number, maxHp: number) {
  const [view, setView] = useState({ shown: hp, trail: hp, healing: false });
  const current = useRef(view);
  current.current = view;
  const shownMaxHp = useRef(maxHp);
  useEffect(() => {
    if (shownMaxHp.current !== maxHp) {
      shownMaxHp.current = maxHp;
      setView({ shown: hp, trail: hp, healing: false });
      return;
    }
    const from = current.current;
    if (from.shown === hp && from.trail === hp) return;
    const healing = hp > from.shown;
    const startShown = from.shown,
      startTrail = healing ? hp : Math.max(from.trail, from.shown);
    const startedAt = performance.now();
    /** 0→1 的進度（減速），到 1 時剛好等於終點 */
    const tween = (start: number, elapsed: number, duration: number) => {
      const progress = Math.max(0, Math.min(1, elapsed / duration));
      return progress >= 1
        ? hp
        : start + (hp - start) * (1 - (1 - progress) ** 2);
    };
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const shown = tween(
        startShown,
        elapsed,
        healing ? hpBarTiming.healMs : hpBarTiming.damageMs,
      );
      const trail = healing
        ? hp
        : tween(
            startTrail,
            elapsed - hpBarTiming.trailHoldMs,
            hpBarTiming.trailDrainMs,
          );
      setView({ shown, trail, healing });
      if (shown !== hp || trail !== hp) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hp, maxHp]);
  return view;
}

/** 寶箱：x, y＝寶箱左上角；w＝寶箱寬；countX, countY, countH＝數量的位置與字高（相對寶箱左上） */
export const ChestCounter = (
  props: Props<"w" | "countX" | "countY" | "countH">,
) => (
  <CanvasPart
    kind="chest"
    props={props}
    defaults={{
      anchor: "top",
      x: 20,
      y: 40,
      w: 29.7,
      countX: 44,
      countY: -1,
      countH: 30,
    }}
  >
    {(merged) => (
      <Chest
        w={num(merged, "w")}
        countX={num(merged, "countX")}
        countY={num(merged, "countY")}
        countH={num(merged, "countH")}
      />
    )}
  </CanvasPart>
);
function Chest({
  w,
  countX,
  countY,
  countH,
}: {
  w: number;
  countX: number;
  countY: number;
  countH: number;
}) {
  const { chest } = useHud();
  return (
    <>
      <i
        style={{
          ...reactStyle(
            layoutPartStyle(
              LAYOUT_PART.chest,
              w / layoutPartRect(LAYOUT_PART.chest).w,
            ),
          ),
          left: 0,
          top: 0,
        }}
      />
      <BitmapText
        font={BATTLE_FONTS.number}
        text={String(chest)}
        color="#ffffff"
        h={countH}
        x={countX}
        y={countY}
      />
    </>
  );
}

/** 勢力相剋圖：x, y＝左上角；w＝寬（原圖 248×142） */
export const RelationChart = (props: Props<"w">) => (
  <CanvasPart
    kind="relationChart"
    props={props}
    defaults={{ anchor: "top", x: 514.22, y: 104.72, w: 141.36 }}
  >
    {(merged) => (
      <ImageBox
        assetId={BATTLE_ASSETS.factionRelationChart}
        w={num(merged, "w")}
      />
    )}
  </CanvasPart>
);

/**
 * 勝利條件提示（相剋圖下方）：x, y＝左上角；w＝寬；size＝字高（標題「勝利條件」小一號）。
 * 內容由關卡 JSON 各合戰的 victory 決定（BattleScene 寫進 useHud 的 victoryHint）；沒有設定時不顯示。
 */
export const VictoryHint = (props: Props<"w" | "size">) => (
  <CanvasPart
    kind="victoryHint"
    props={props}
    defaults={{ anchor: "top", x: 466, y: 192, w: 170, size: 18 }}
  >
    {(merged) => (
      <VictoryHintBox w={num(merged, "w")} size={num(merged, "size")} />
    )}
  </CanvasPart>
);
function VictoryHintBox({ w, size }: { w: number; size: number }) {
  const { victoryHint } = useHud();
  if (!victoryHint) return null;
  return (
    <div
      className="victory-hint"
      style={{
        width: designUnit(w),
        padding: `${designUnit(size * 0.35)} ${designUnit(size * 0.5)}`,
        borderWidth: designUnit(2),
        borderRadius: designUnit(size * 0.5),
        fontSize: designUnit(size),
      }}
    >
      <div
        className="victory-hint-title"
        style={{ fontSize: designUnit(size * 0.85) }}
      >
        勝利條件
      </div>
      {victoryHint}
    </div>
  );
}

/** Menu 按鈕：x, y＝左上角；w＝寬（原圖 148×52） */
export const MenuButton = (props: Props<"w">) => (
  <CanvasPart
    kind="menu"
    props={props}
    defaults={{ anchor: "top", x: 493, y: 40, w: 140.6 }}
  >
    {(merged) => {
      const w = num(merged, "w"),
        scale = w / getAssetSize(BATTLE_ASSETS.menuButton).width;
      return (
        <ImageBox assetId={BATTLE_ASSETS.menuButton} w={w}>
          <i
            style={{
              ...reactStyle(
                layoutPartStyle(LAYOUT_PART.menuText, 1 * scale, -90),
              ),
              left: designUnit(60 * scale),
              top: designUnit(-10 * scale),
            }}
          />
        </ImageBox>
      );
    }}
  </CanvasPart>
);

/** 「合戰 n/m」大字：y＝上緣；x＝水平偏移（0＝畫面置中）；h＝字高；gap＝兩段之間的間距。播放由 battle.playWaveBanner() */
export const WaveBanner = (props: Props<"h" | "gap">) => (
  <CanvasPart
    kind="waveBanner"
    props={props}
    defaults={{ x: 0, y: 126, h: 64, gap: 14 }}
  />
);

/** 單張素材圖（寬 w，高依原圖比例），子元素以圖的左上為原點 */
function ImageBox({
  assetId,
  w,
  children,
}: {
  assetId: string;
  w: number;
  children?: ReactNode;
}) {
  const size = getAssetSize(assetId);
  return (
    <i
      style={{
        left: 0,
        top: 0,
        width: designUnit(w),
        height: designUnit((w * size.height) / size.width),
        backgroundImage: `url(${getAssetUrl(assetId)})`,
        backgroundSize: "100% 100%",
      }}
    >
      {children}
    </i>
  );
}
