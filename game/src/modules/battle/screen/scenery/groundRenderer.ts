/**
 * 戰鬥地面：把 ground_000000（左半土路、右半草地）貼成有透視的地面。
 * 路寬曲線取自 v5 150 508 ms 的實測（遊戲區 360 寬 → ×1.778 設計單位）：
 *   地平線（y205）幾乎一點，到 y242 已寬 252，y284 寬 453，y405 起滿版。路中心 x320。
 * 每一列：土路圖 0～500 拉成該列路寬，草地圖 524～880 左右鏡射重複填滿兩側；
 * 貼圖縱向以「每列取 500/路寬 列」累加，讓近處的紋理不會被拉得過長。
 */
/** 地平線（設計單位 y，以底部 999 版面為準） */
export const GROUND_TOP = 205;
/** [y, 路寬] 實測點 */
const ROAD_WIDTH_SAMPLES: [number, number][] = [[205, 0], [213, 53], [242, 252], [256, 338], [270, 398], [284, 453], [313, 507], [341, 533], [370, 587], [405, 640], [540, 760]];

function roadWidth(y: number) {
  for (let i = 1; i < ROAD_WIDTH_SAMPLES.length; i++) {
    const [y1, w1] = ROAD_WIDTH_SAMPLES[i]!, [y0, w0] = ROAD_WIDTH_SAMPLES[i - 1]!;
    if (y <= y1) return w0 + (w1 - w0) * (y - y0) / (y1 - y0);
  }
  return 760;
}

/** 把地面畫到 canvas（寬 640、高 bottomY − GROUND_TOP，每設計單位一像素） */
export function drawGround(canvas: HTMLCanvasElement, groundImageUrl: string, bottomY: number) {
  const image = new Image();
  image.onload = () => {
    const height = bottomY - GROUND_TOP;
    canvas.width = 640; canvas.height = height;
    const context = canvas.getContext('2d')!;
    const roadCenterX = 320;
    let sourceY = 0;
    for (let row = 0; row < height; row++) {
      const y = GROUND_TOP + row + 0.5, width = Math.max(roadWidth(y), 24), scale = width / 500;
      sourceY += 1 / scale;
      const sourceRow = Math.floor(sourceY) % 1024;
      const roadLeft = roadCenterX - width / 2;
      context.drawImage(image, 0, sourceRow, 500, 1, roadLeft, row, width, 1);
      // 草地：往左、往右各鏡射重複
      const tileWidth = 356 * scale;
      for (const direction of [-1, 1]) {
        let x = direction < 0 ? roadLeft : roadLeft + width, mirrored = false;
        while (direction < 0 ? x > 0 : x < 640) {
          context.save();
          context.translate(x, 0);
          if (direction < 0) context.scale(-1, 1);
          if (mirrored) { context.translate(tileWidth, 0); context.scale(-1, 1); }
          context.drawImage(image, 524, sourceRow, 356, 1, 0, row, tileWidth, 1);
          context.restore();
          x += direction * tileWidth; mirrored = !mirrored;
        }
      }
    }
    // 地平線霧化
    const fog = context.createLinearGradient(0, 0, 0, 70);
    fog.addColorStop(0, 'rgba(150,185,215,.7)'); fog.addColorStop(1, 'rgba(150,185,215,0)');
    context.fillStyle = fog; context.fillRect(0, 0, 640, 70);
  };
  image.src = groundImageUrl;
}
