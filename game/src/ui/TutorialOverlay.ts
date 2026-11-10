/**
 * 教學遮罩（任何畫面都能用）：一張蓋住整個畫面的透明 modal，擋下所有操作，只留下教學要玩家碰的地方。
 *   show()   變暗範圍（dimArea，預設整個畫面）＋明亮的洞（highlight，可以多個）＋可操作的範圍（touchable，其餘全部擋住）
 *   say()    玲玲對話＋遮罩；點「確定」繼續
 *   tap()    高亮一個元件，只有那裡可以點（點擊照常傳給底下的元件），點了才繼續
 *   runTutorialSteps()  執行 JSON 教學步驟；共用步驟在這裡，各畫面自己的步驟用 handlers 加進來
 * 座標一律是 640 寬的設計單位，以遮罩的 host 左上為原點（戰鬥＝640×999 版面）。
 * 元件 id 由 findElement 找到元素，範圍＝該元素（含子元素）在畫面上實際佔的位置；預設找 data-tutorial-id="<id>" 的元素。
 */
import { designUnit } from "@core/stage";
import { getAsset, getAssetUrl } from "@core/assetLoader";
import { sceneRouter } from "@core/sceneRouter";
import { saveStore } from "@core/saveStore";
import { wait } from "@core/animate";
import { uiAsset } from "./components";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 元件 id（例：'menu'、'hpBar'）或矩形 */
export type TutorialTarget = string | Rect;

export interface SpotlightOptions {
  /** 變暗的範圍；預設整個畫面 */
  dimArea?: TutorialTarget;
  /** 變暗的程度 0～1；預設 0.5（v5 113 537 實測） */
  dim?: number;
  /** 保持明亮的洞（可以多個，例：轉珠路徑經過的每一格；洞之間不可重疊） */
  highlight?: TutorialTarget | TutorialTarget[];
  /** 元件 id 的四周多留多少；預設 5 */
  padding?: number;
  /** 洞的圓角 */
  radius?: number;
  /** 可以操作的範圍（其餘全部擋住）："highlight"＝跟洞一樣（多個洞時取包住全部洞的矩形）；預設全部擋住 */
  touchable?: TutorialTarget | "highlight";
  /** 變暗淡入的時間（毫秒） */
  fadeMs?: number;
}

export interface SayOptions extends SpotlightOptions {
  /** 表情（笑臉）。表情零件的合成位置尚未解出，目前不影響畫面（docs/復刻分析/02 §待確認） */
  expression?: "smile";
  /** 不顯示玲玲 */
  hideNavigator?: boolean;
}

/** 玲玲（教學嚮導）全身圖 */
export const NAVIGATOR_ASSET = "UI等/鈴鈴/naviBase_s";

/** 遮罩往畫面外多蓋的範圍（螢幕比版面高、寬時也蓋得到） */
const OUTSIDE = 1000;
const FULL: Rect = {
  x: -OUTSIDE,
  y: -OUTSIDE,
  w: 640 + OUTSIDE * 2,
  h: 999 + OUTSIDE * 2,
};
const DEFAULT_DIM = 0.5;
const DEFAULT_PADDING = 5;

/** 對話視窗的演出時間（毫秒），來源 v5 亞修實況（每禎 53.5 ms），逐禎紀錄見 docs/復刻分析/02_教學戰鬥1.md */
const dialogTiming = {
  /** 對話視窗與變暗出現（一禎內完成） */
  fadeInMs: 54,
} as const;

const SVG_NS = "http://www.w3.org/2000/svg";

/** 矩形的 SVG 子路徑（radius＝圓角） */
function roundedRectPath({ x, y, w, h }: Rect, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  return (
    `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
    `v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  );
}

/** 包住全部矩形的矩形（沒有矩形＝undefined） */
function boundingRect(rects: Rect[]): Rect | undefined {
  if (!rects.length) return undefined;
  const left = Math.min(...rects.map((rect) => rect.x)),
    top = Math.min(...rects.map((rect) => rect.y)),
    right = Math.max(...rects.map((rect) => rect.x + rect.w)),
    bottom = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

const place = (element: HTMLElement | SVGElement, rect: Rect) =>
  Object.assign(element.style, {
    left: designUnit(rect.x),
    top: designUnit(rect.y),
    width: designUnit(rect.w),
    height: designUnit(rect.h),
  });

export class TutorialOverlay {
  /** 變暗：一張 SVG，範圍＝dimArea，洞以 evenodd 挖空 */
  private dim = document.createElementNS(SVG_NS, "svg");
  private dimPath = document.createElementNS(SVG_NS, "path");
  /** 擋下操作的透明片 */
  private blockers = document.createElement("div");
  /** 可操作範圍（只用來量位置，不攔操作） */
  private touchProbe = document.createElement("div");
  /** 對話視窗、路徑指引等放在這層（蓋在擋片上面，可以自己接操作） */
  readonly top = document.createElement("div");

  constructor(
    private host: HTMLElement,
    private findElement: (id: string) => Element = findByTutorialId,
    /** 點擊提示（tap 步驟的手與「タッチ!」）的位置；每禎現讀，可以接到會熱更新的設定 */
    private touchHintPlacement: () => TouchHintPlacement = () =>
      DEFAULT_TOUCH_HINT,
  ) {
    this.dim.style.cssText = "position:absolute;pointer-events:none;opacity:0";
    this.dimPath.setAttribute("fill-rule", "evenodd");
    this.blockers.style.cssText = "position:absolute;inset:0";
    this.touchProbe.style.cssText =
      "position:absolute;pointer-events:none;visibility:hidden";
    this.top.style.cssText = "position:absolute;inset:0;pointer-events:none";
    this.dim.appendChild(this.dimPath);
    host.append(this.dim, this.blockers, this.touchProbe, this.top);
  }

  /** 元件 id 或矩形 → 矩形（id 會四周多留 padding） */
  resolve(target: TutorialTarget, padding = DEFAULT_PADDING): Rect {
    if (typeof target !== "string") return target;
    const root = this.findElement(target);
    const rect = rectOfElements(this.host, [
      root,
      ...root.querySelectorAll("*"),
    ]);
    return {
      x: rect.x - padding,
      y: rect.y - padding,
      w: rect.w + padding * 2,
      h: rect.h + padding * 2,
    };
  }

  /** 顯示遮罩：變暗、留洞、只允許操作 touchable */
  show(options: SpotlightOptions = {}) {
    const area = options.dimArea
      ? this.resolve(options.dimArea, options.padding)
      : FULL;
    const holes = (
      options.highlight === undefined
        ? []
        : Array.isArray(options.highlight)
          ? options.highlight
          : [options.highlight]
    ).map((target) => this.resolve(target, options.padding));
    // 外框（變暗範圍）＋每個洞各一個子路徑；evenodd：洞的部分不塗
    place(this.dim, area);
    this.dim.setAttribute("viewBox", `${area.x} ${area.y} ${area.w} ${area.h}`);
    this.dimPath.setAttribute(
      "d",
      [area, ...holes]
        .map((rect, i) => roundedRectPath(rect, i ? (options.radius ?? 0) : 0))
        .join(""),
    );
    this.dimPath.setAttribute(
      "fill",
      `rgba(0,0,0,${options.dim ?? DEFAULT_DIM})`,
    );
    this.dim.style.transition = `opacity ${options.fadeMs ?? 0}ms linear`;
    this.dim.style.opacity = "1";

    const touchable =
      options.touchable === "highlight"
        ? boundingRect(holes)
        : options.touchable && this.resolve(options.touchable, options.padding);
    this.setBlockers(touchable || undefined);
  }

  /** 收起遮罩，恢復所有操作 */
  hide(fadeMs = 0) {
    this.dim.style.transition = `opacity ${fadeMs}ms linear`;
    this.dim.style.opacity = "0";
    this.blockers.innerHTML = "";
  }

  /** 玲玲對話：遮罩＋對話視窗，點「確定」後收起並 resolve */
  async say(text: string, options: SayOptions = {}) {
    this.show({ fadeMs: dialogTiming.fadeInMs, ...options });
    const dialog = createNavigatorDialog(text, options, true);
    this.top.appendChild(dialog.element);
    await dialog.confirmed;
    dialog.element.remove();
    this.hide();
  }

  /** 高亮 target，只有那裡可以點（點擊照常傳給底下的元件）；點了才 resolve。text：同時顯示的說明（沒有「確定」鈕） */
  async tap(
    target: TutorialTarget,
    options: SayOptions & { text?: string; touchHint?: boolean } = {},
  ) {
    this.show({
      fadeMs: dialogTiming.fadeInMs,
      ...options,
      highlight: target,
      touchable: "highlight",
    });
    const dialog =
      options.text !== undefined
        ? createNavigatorDialog(options.text, options, false)
        : null;
    if (dialog) this.top.appendChild(dialog.element);
    // 高亮的右邊：手指按下的動畫＋「タッチ!」（touch00／01 交替，touch02 字樣）
    const hint =
      options.touchHint === false
        ? null
        : createTouchHint(
            this.resolve(target, options.padding),
            this.touchHintPlacement,
          );
    if (hint) this.top.appendChild(hint.element);
    await new Promise<void>((resolve) => {
      const onPointerUp = (event: PointerEvent) => {
        const rect = this.touchProbe.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          return;
        document.removeEventListener("pointerup", onPointerUp, true);
        resolve();
      };
      document.addEventListener("pointerup", onPointerUp, true);
    });
    dialog?.element.remove();
    hint?.remove();
    this.hide();
  }

  destroy() {
    this.host.innerHTML = "";
  }

  /** 擋片：hole 以外全部擋住（沒有 hole＝全部擋住） */
  private setBlockers(hole?: Rect) {
    this.blockers.innerHTML = "";
    const add = (rect: Rect) => {
      const panel = document.createElement("i");
      panel.style.cssText = "position:absolute;pointer-events:auto";
      place(panel, rect);
      this.blockers.appendChild(panel);
    };
    if (!hole) {
      add(FULL);
      this.touchProbe.style.display = "none";
      return;
    }
    const right = hole.x + hole.w,
      bottom = hole.y + hole.h,
      fullRight = FULL.x + FULL.w,
      fullBottom = FULL.y + FULL.h;
    add({ x: FULL.x, y: FULL.y, w: FULL.w, h: hole.y - FULL.y });
    add({ x: FULL.x, y: bottom, w: FULL.w, h: fullBottom - bottom });
    add({ x: FULL.x, y: hole.y, w: hole.x - FULL.x, h: hole.h });
    add({ x: right, y: hole.y, w: fullRight - right, h: hole.h });
    this.touchProbe.style.display = "block";
    place(this.touchProbe, hole);
  }
}

/** 預設的元件 id 對照：畫面上 data-tutorial-id="<id>" 的元素 */
function findByTutorialId(id: string): Element {
  const root = document.querySelector(`[data-tutorial-id="${id}"]`);
  if (!root) throw new Error(`畫面上沒有 data-tutorial-id="${id}" 的元素`);
  return root;
}

/** 一組元素在 host 座標（設計單位）中合起來佔的範圍；host 寬＝640 設計單位 */
export function rectOfElements(host: HTMLElement, elements: Element[]): Rect {
  const rects = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width && rect.height);
  const reference = host.getBoundingClientRect(),
    unit = reference.width / 640;
  const left = Math.min(...rects.map((rect) => rect.left)),
    top = Math.min(...rects.map((rect) => rect.top)),
    right = Math.max(...rects.map((rect) => rect.right)),
    bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    x: (left - reference.left) / unit,
    y: (top - reference.top) / unit,
    w: (right - left) / unit,
    h: (bottom - top) / unit,
  };
}

/** 點擊提示的時間（毫秒） */
const touchHintTiming = {
  /** 手指按下／放開交替 */
  pressMs: 280,
} as const;

/**
 * 點擊提示的位置（設計單位）：以高亮範圍「右緣、上下置中」那一點為原點。
 * handX／handY＝手（touch00／01）的左上角，labelX／labelY＝「タッチ!」（touch02）的左上角，size＝兩張圖的邊長（原圖 120）。
 */
export interface TouchHintPlacement {
  handX: number;
  handY: number;
  labelX: number;
  labelY: number;
  size: number;
}
export const DEFAULT_TOUCH_HINT: TouchHintPlacement = {
  handX: -10,
  handY: -19,
  labelX: 5,
  labelY: -82,
  size: 96,
};

/**
 * 點擊提示：在 rect 右邊顯示手指按下的動畫與「タッチ!」；回傳元素與收起函式。
 * 位置每禎由 placement() 現讀（戰鬥中＝<TutorialMask> 標籤的屬性，改了存檔就會跟著動）。
 */
function createTouchHint(rect: Rect, placement: () => TouchHintPlacement) {
  const element = document.createElement("div");
  element.style.cssText = "position:absolute;inset:0;pointer-events:none";
  const hand = document.createElement("i"),
    label = document.createElement("i");
  for (const part of [hand, label])
    Object.assign(part.style, {
      position: "absolute",
      backgroundSize: "100% 100%",
    });
  label.style.backgroundImage = `url(${getAssetUrl(uiAsset("touch02"))})`;
  const frames = [uiAsset("touch00"), uiAsset("touch01")].map(
    (id) => `url(${getAssetUrl(id)})`,
  );
  const originX = rect.x + rect.w,
    originY = rect.y + rect.h / 2,
    startedAt = performance.now();
  let frameId = 0;
  const update = () => {
    const { handX, handY, labelX, labelY, size } = placement();
    place(hand, { x: originX + handX, y: originY + handY, w: size, h: size });
    place(label, {
      x: originX + labelX,
      y: originY + labelY,
      w: size,
      h: size,
    });
    const frame =
      Math.floor((performance.now() - startedAt) / touchHintTiming.pressMs) % 2;
    hand.style.backgroundImage = frames[frame]!;
    frameId = requestAnimationFrame(update);
  };
  update();
  element.append(hand, label);
  return {
    element,
    remove: () => {
      cancelAnimationFrame(frameId);
      element.remove();
    },
  };
}

/**
 * 玲玲的對話視窗。版面量測自 v5 113 537 ms，640×999 設計單位：
 *   玲玲 naviBase_s 縮 0.967、左緣 -12、頂 505
 *   視窗 info_window x120 y600 400×340，文字左緣 165、字高 24　確定鈕 button_mini_2 (240,835)
 */
const NAVIGATOR_SCALE = 0.967;

function createNavigatorDialog(
  text: string,
  options: SayOptions,
  withButton: boolean,
) {
  const element = document.createElement("div");
  element.style.cssText = "position:absolute;inset:0;pointer-events:none";
  const navigator = getAsset(NAVIGATOR_ASSET);
  const windowUrl = getAssetUrl(uiAsset("info_window")),
    buttonUrl = getAssetUrl(uiAsset("button_mini_2")),
    buttonPressedUrl = getAssetUrl(uiAsset("button_mini_2_dark"));
  const navigatorHtml = options.hideNavigator
    ? ""
    : `<i style="position:absolute;left:${designUnit(-12)};top:${designUnit(505)};width:${designUnit(navigator.width * NAVIGATOR_SCALE)};height:${designUnit(navigator.height * NAVIGATOR_SCALE)};background:url(${navigator.url}) 0 0/100% 100%"></i>`;
  const buttonHtml = withButton
    ? `<button style="position:absolute;left:${designUnit(80)};top:${designUnit(195)};width:${designUnit(159)};height:${designUnit(66)};border:0;padding:0;pointer-events:auto;background:url(${buttonUrl}) 0 0/100% 100%;font:900 ${designUnit(28)}/${designUnit(66)} sans-serif;color:#fff;-webkit-text-stroke:${designUnit(5)} #3a0806;paint-order:stroke fill;letter-spacing:${designUnit(4)}">確定</button>`
    : "";
  element.innerHTML =
    navigatorHtml +
    `<div class="tutorial-dialog" style="position:absolute;left:${designUnit(120)};top:${designUnit(600)};width:${designUnit(400)};height:${designUnit(340)};box-sizing:border-box;border:${designUnit(40)} solid transparent;border-image:url(${windowUrl}) 40 fill/${designUnit(40)} stretch">
      <div style="position:absolute;left:${designUnit(5)};top:${designUnit(28)};width:${designUnit(320)};font:700 ${designUnit(24)}/1.45 'PingFang TC','Noto Sans TC',sans-serif;color:#fff;white-space:pre-wrap">${text}</div>
      ${buttonHtml}
    </div>`;
  element.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: dialogTiming.fadeInMs,
  });
  const button = element.querySelector("button");
  const confirmed = new Promise<void>((resolve) => {
    if (!button) return;
    button.addEventListener(
      "pointerdown",
      () => (button.style.backgroundImage = `url(${buttonPressedUrl})`),
    );
    button.addEventListener("pointerup", () => resolve());
  });
  return { element, confirmed };
}

// ---------- JSON 教學步驟 ----------
/** 一個教學步驟：一個物件，第一個認得的欄位決定種類，其他欄位是參數 */
export type TutorialStep = Record<string, unknown>;
/** 各畫面自己的步驟：欄位名稱 → 執行函式 */
export type TutorialStepHandlers = Record<
  string,
  (step: TutorialStep) => unknown
>;

/** JSON 裡的遮罩參數（say、tap 共用） */
const spotlightOf = (step: TutorialStep): SayOptions => ({
  highlight: step.highlight as TutorialTarget | TutorialTarget[] | undefined,
  dimArea: step.dimArea as TutorialTarget | undefined,
  dim: step.dim as number | undefined,
  padding: step.padding as number | undefined,
  radius: step.radius as number | undefined,
  touchable: step.touchable as TutorialTarget | undefined,
  expression: step.expression === "smile" ? "smile" : undefined,
  hideNavigator: step.hideNavigator === true,
});

/**
 * 依序執行教學步驟。共用步驟：
 *   { "say": 台詞, "highlight"?: 元件 id、{x,y,w,h} 或它們的陣列, "dim"?: 0.5, "dimArea"?, "padding"?, "radius"?,
 *     "touchable"?: 可操作範圍, "expression"?: "smile", "hideNavigator"?: true }   玲玲對話，點「確定」繼續
 *   { "tap": 元件 id 或 {x,y,w,h}, "text"?: 說明, "touchHint"?: false, 其他同 say }   只能點那裡，點了才繼續（點擊照常生效）；
 *     高亮右邊會有手指按下的提示與「タッチ!」（touchHint: false 不顯示）；有 text 才顯示玲玲與說明窗
 *   { "wait": 毫秒 }　{ "save": { 存檔欄位: 值 } }　{ "goto": 場景 id }
 * handlers：該畫面自己的步驟（例：戰鬥的 guidedMove、wave），同名時優先於共用步驟。
 */
export async function runTutorialSteps(
  steps: TutorialStep[],
  overlay: TutorialOverlay,
  handlers: TutorialStepHandlers = {},
  isActive: () => boolean = () => true,
) {
  const common: TutorialStepHandlers = {
    say: (step) => overlay.say(String(step.say), spotlightOf(step)),
    tap: (step) =>
      overlay.tap(step.tap as TutorialTarget, {
        ...spotlightOf(step),
        text: step.text === undefined ? undefined : String(step.text),
        touchHint: step.touchHint !== false,
      }),
    wait: (step) => wait(Number(step.wait)),
    save: (step) => {
      saveStore.update((data) => Object.assign(data, step.save));
    },
    goto: (step) => {
      sceneRouter.replace(String(step.goto));
    },
  };
  const all = { ...common, ...handlers };
  for (const step of steps) {
    if (!isActive()) return;
    const kind = Object.keys(step).find((key) => key in all);
    if (!kind) throw new Error(`不認得的教學步驟：${JSON.stringify(step)}`);
    await all[kind]!(step);
  }
}
