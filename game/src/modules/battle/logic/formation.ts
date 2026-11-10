/**
 * 敵人的大小與站位（純函式，有測試）：
 *   scaleOfStars    星數 → 立繪縮放
 *   arrangeRows     依星數決定誰是主將、誰站前排／後排
 *   arrangeEnemies  左右位置（依看得到的寬度分配可視寬度）
 */
export type Row = "front" | "back";

/** 主將的星數門檻：有 5★ 以上時只算 5★ 以上；否則 4★ 算主將；都低於 4★ 時沒有主將（Infinity） */
export function mainGeneralThreshold(stars: number[]) {
  const top = Math.max(...stars);
  return top >= 5 ? 5 : top >= 4 ? 4 : Infinity;
}

/**
 * 依星數決定前後排（JSON 裡敵人的順序＝由左到右）：
 *   「主將」＝最高星數的敵人（有 5★ 以上時只算 5★ 以上；否則 4★ 算主將；都低於 4★ 時沒有主將）。
 *   沒有主將：1 人前排；2 人前前；3 人後前後；4 人後前前後；5 人後前後前後；更多則前後交錯。
 *   有主將：主將並排在中間、站後排；其他人分到兩側、都站前排（蓋在主將前面，才不會被比較大的主將整個蓋住）
 *     （例：1 主將＋2 人＝前〔後〕前；1 主將＋4 人＝前前〔後〕前前）。只有主將時站前排。
 */
export function arrangeRows(stars: number[]): Row[] {
  const bigThreshold = mainGeneralThreshold(stars);
  const isBig = stars.map((star) => star >= bigThreshold);
  const bigCount = isBig.filter(Boolean).length;
  if (!bigCount) {
    const patterns: Record<number, Row[]> = {
      1: ["front"],
      2: ["front", "front"],
      3: ["back", "front", "back"],
      4: ["back", "front", "front", "back"],
      5: ["back", "front", "back", "front", "back"],
    };
    return (
      patterns[stars.length] ??
      stars.map((_, index): Row => (index % 2 ? "front" : "back"))
    );
  }
  // 有主將：依原本的順序把小兵分到左右兩側（左邊多一個），主將放中間
  const smallIndexes = stars.flatMap((_, index) =>
    isBig[index] ? [] : [index],
  );
  const rows: Row[] = [];
  // 主將比較大：站後排，低星站前排蓋在主將前面（才不會被主將整個蓋住）；沒有低星時主將站前排
  stars.forEach((_, index) => {
    if (isBig[index]) rows[index] = smallIndexes.length ? "back" : "front";
    else rows[index] = "front";
  });
  return rows;
}

// ---------- 大小 ----------
/** 立繪中看得到的部分：左右邊界（原圖像素）與點擊判定用的透明度遮罩（縮小 step 倍，1＝看得到） */
export interface ArtBounds {
  left: number;
  right: number;
  mask?: { width: number; height: number; step: number; opaque: Uint8Array };
}

/** 可視寬度（設計單位） */
export const VISIBLE_WIDTH = 640;
/** 1★、2★ 的立繪縮放（立繪原圖高 470）；其他星數是它的倍數（STAR_RATIOS） */
const BASE_SCALE = 0.3;
/** 星數 → 相對 1★ 的大小：1★、2★ 1.0，3★ 1.15，4★ 1.5，5★ 1.75，6★ 以上 2.0 */
const STAR_RATIOS = [1, 1, 1.15, 1.5, 1.75, 2];

/**
 * 星數 → 立繪縮放（還沒套用上下空間的限制，見 arrangeEnemies）：BASE_SCALE × STAR_RATIOS。
 * 6★ 以上另外再放大到看得到的寬度＝可視寬度 640（visibleWidth＝原圖像素），兩者取大；太高時 arrangeEnemies 會往下移或縮小。
 */
export function scaleOfStars(stars: number, visibleWidth: number) {
  const index =
    Math.min(STAR_RATIOS.length, Math.max(1, Math.round(stars))) - 1;
  const scale = BASE_SCALE * STAR_RATIOS[index]!;
  return stars >= 6 ? Math.max(scale, VISIBLE_WIDTH / visibleWidth) : scale;
}

// ---------- 左右位置 ----------
/** 前排、後排的腳底 y（v5 量測：1 人 146 281 ms、5 人 240 128 ms） */
const FRONT = 340,
  BACK = 301;

/**
 * 敵人可以用的上下範圍（<Enemies> 內的座標）：
 *   top     立繪頂端最高到哪（Menu 按鈕下緣再往下留「殘 N」的高度）
 *   bottom  腳底最低到哪（我方頭像上緣再往上留 HP 條的高度）
 * 實際值由 EnemyLayer.verticalLimits() 依畫面上 Menu 與頭像的位置量出來。
 */
export interface VerticalLimits {
  top: number;
  bottom: number;
}
/** 量不到時用的範圍（16:9 手機） */
export const DEFAULT_VERTICAL_LIMITS: VerticalLimits = { top: 0, bottom: 430 };
/** 整排兩端離畫面邊緣留多少 */
const SIDE_MARGIN = 8;
/** 高星之間不重疊時，兩人看得到的部分之間留的空隙 */
const HIGH_STAR_SPACING = 6;
/** 空間有剩時，相鄰兩人之間最多再拉開多少（人少時不會分散到兩邊、中間空一大塊） */
const MAX_EXTRA_GAP = 60;
/** 空間不夠時，可以重疊的兩人最多靠到「邊緣相接」距離的幾倍 */
const MIN_FLEX_SQUEEZE = 0.4;

/**
 * 兩個相鄰高星（4★ 以上）是否不能重疊：一般不能；5★ 以上配 4★ 可以（5★ 以上幾乎占滿畫面，不可能不蓋到）
 */
function mustNotOverlap(a: number, b: number) {
  if (a < 4 || b < 4) return false;
  const low = Math.min(a, b),
    high = Math.max(a, b);
  return !(low < 5 && high >= 5);
}

/**
 * 左右位置（x＝看得到的部分的中心，<Enemies> 內的座標，畫面中心 320）。
 *   順序：主將在中間，低星依 JSON 順序分到左右兩側（見 arrangeRows）。
 *   先讓相鄰兩人看得到的部分「邊緣相接」，再分配可視寬度（640，兩邊各留 SIDE_MARGIN）：
 *     有剩：平均分給每個間隔（每個最多 MAX_EXTRA_GAP），整排撐開、不會看起來空空的；
 *     不夠：先讓可以重疊的兩人平均靠近（低星在前排，蓋在高星前面），
 *           高星之間（mustNotOverlap）保持不重疊；還是不夠就把這些高星縮小到放得下。
 *   整排以看得到的左右兩端置中。
 * 上下：立繪頂端不能超過 limits.top（不蓋到 Menu）。太高時整排一起往下移（最多到腳底 limits.bottom，不蓋到我方頭像），
 *   還是放不下才把那個敵人縮小。回傳每個敵人的腳底位置與最後的縮放。
 */
export function arrangeEnemies(
  input: Array<{
    stars: number;
    scale: number;
    visibleWidth: number;
    /** 立繪原圖高（像素） */
    artHeight: number;
  }>,
  limits: VerticalLimits = DEFAULT_VERTICAL_LIMITS,
) {
  const rows = arrangeRows(input.map((enemy) => enemy.stars));
  // ---- 上下 ----
  const baseY = rows.map((row) => (row === "front" ? FRONT : BACK));
  const heights = input.map((enemy) => enemy.artHeight * enemy.scale);
  const wantedDrop = Math.max(
    0,
    ...input.map((_, i) => limits.top + heights[i]! - baseY[i]!),
  );
  const drop = Math.max(
    0,
    Math.min(wantedDrop, limits.bottom - Math.max(...baseY)),
  );
  const enemies = input.map((enemy, i) => {
    const room = baseY[i]! + drop - limits.top,
      shrink = heights[i]! > room && room > 0 ? room / heights[i]! : 1;
    return {
      stars: enemy.stars,
      scale: enemy.scale * shrink,
      visibleWidth: enemy.visibleWidth * shrink,
    };
  });
  // ---- 左右 ----
  const bigThreshold = mainGeneralThreshold(
    enemies.map((enemy) => enemy.stars),
  );
  const indexes = enemies.map((_, index) => index);
  const bigs = indexes.filter((i) => enemies[i]!.stars >= bigThreshold);
  const smalls = indexes.filter((i) => enemies[i]!.stars < bigThreshold);
  const leftCount = bigs.length ? Math.ceil(smalls.length / 2) : smalls.length;
  const order = bigs.length
    ? [...smalls.slice(0, leftCount), ...bigs, ...smalls.slice(leftCount)]
    : indexes;
  const ordered = order.map((index) => enemies[index]!);
  const first = ordered[0]!,
    last = ordered[ordered.length - 1]!;
  /** 依目前的大小排一次：回傳相鄰兩人的中心距離，與排完後仍超出的寬度（0＝放得下） */
  const layout = () => {
    // natural＝邊緣相接（不能重疊的再加空隙），least＝最多靠到多近
    const gaps = ordered.slice(1).map((b, k) => {
      const a = ordered[k]!,
        touching = (a.visibleWidth + b.visibleWidth) / 2,
        fixed = mustNotOverlap(a.stars, b.stars);
      return fixed
        ? {
            distance: touching + HIGH_STAR_SPACING,
            least: touching + HIGH_STAR_SPACING,
            fixed,
          }
        : { distance: touching, least: touching * MIN_FLEX_SQUEEZE, fixed };
    });
    /** 中心到中心可以用的寬度 */
    const target =
      VISIBLE_WIDTH -
      SIDE_MARGIN * 2 -
      (first.visibleWidth + last.visibleWidth) / 2;
    const total = () => gaps.reduce((sum, gap) => sum + gap.distance, 0);
    const natural = total();
    if (natural <= target) {
      const extra = gaps.length
        ? Math.min(MAX_EXTRA_GAP, (target - natural) / gaps.length)
        : 0;
      gaps.forEach((gap) => (gap.distance += extra));
      return { gaps, target, over: 0 };
    }
    const reducible = gaps.reduce(
      (sum, gap) => sum + gap.distance - gap.least,
      0,
    );
    const ratio =
      reducible > 0 ? Math.min(1, (natural - target) / reducible) : 0;
    gaps.forEach((gap) => (gap.distance -= (gap.distance - gap.least) * ratio));
    return { gaps, target, over: Math.max(0, total() - target) };
  };
  // 可以重疊的都靠到最近了還是放不下：把不能重疊的高星縮小一點再排（寧可小一點也不要互相蓋住）
  let result = layout();
  for (let attempt = 0; attempt < 8 && result.over > 0.5; attempt++) {
    // 整排（含兩端的半個人）需要的寬度 vs 可用的寬度
    const ends = (first.visibleWidth + last.visibleWidth) / 2,
      available = result.target + ends,
      shrink = Math.max(0.5, available / (available + result.over));
    const crowded = new Set<number>();
    result.gaps.forEach((gap, k) => {
      if (gap.fixed) crowded.add(k).add(k + 1);
    });
    if (!crowded.size) break;
    crowded.forEach((k) => {
      ordered[k]!.scale *= shrink;
      ordered[k]!.visibleWidth *= shrink;
    });
    result = layout();
  }
  const { gaps } = result;
  // 還是放不下（例如沒有不能重疊的組合）：全部一起壓
  if (result.over > 0 && result.target > 0) {
    const span = result.target + result.over;
    gaps.forEach((gap) => (gap.distance *= result.target / span));
  }
  const xs = [0];
  gaps.forEach((gap, k) => xs.push(xs[k]! + gap.distance));
  // 以看得到的左右兩端置中
  const left = -first.visibleWidth / 2,
    right = xs[xs.length - 1]! + last.visibleWidth / 2,
    offset = VISIBLE_WIDTH / 2 - (left + right) / 2;
  const places: Array<{ x: number; y: number; scale: number }> = [];
  order.forEach((index, k) => {
    places[index] = {
      x: xs[k]! + offset,
      y: baseY[index]! + drop,
      scale: enemies[index]!.scale,
    };
  });
  return places;
}
