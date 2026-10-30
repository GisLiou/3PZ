/**
 * 拖曳捲動（手機遊戲式）：手指按住拖動內容，放開後有慣性與邊界回彈。
 * - 不使用瀏覽器原生捲軸（touch-action:none），所以在網頁與 App 裡手感一致
 * - 拖動超過 TAP_SLOP_PX 後，放開時不會觸發子元素的點擊（避免拖動時誤點按鈕）
 * - 只能用拖曳捲動，沒有「點一下捲動」的按鈕
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

const TAP_SLOP_PX = 8; // 超過即視為拖動
const FRICTION_PER_16MS = 0.94; // 每 16ms 的速度衰減
const RUBBER_BAND_DAMPING = 0.35; // 超出邊界時的阻尼

export interface DragScrollProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 捲動位置變化（px），給捲軸指示器用 */
  onScroll?: (scrollTop: number, maxScrollTop: number) => void;
}

interface DragState { pointerId: number; startY: number; lastY: number; lastTime: number; startScrollTop: number; moved: boolean }

export function DragScroll({ children, className, style, onScroll }: DragScrollProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current!, content = contentRef.current!;
    let scrollTop = 0, velocity = 0, frameId = 0;
    let drag: DragState | null = null;
    let suppressClick = false;

    const maxScrollTop = () => Math.max(0, content.scrollHeight - viewport.clientHeight);
    const render = () => {
      content.style.transform = `translate3d(0,${-scrollTop}px,0)`;
      onScroll?.(scrollTop, maxScrollTop());
    };
    const applyRubberBand = (value: number) => {
      const max = maxScrollTop();
      if (value < 0) return value * RUBBER_BAND_DAMPING;
      if (value > max) return max + (value - max) * RUBBER_BAND_DAMPING;
      return value;
    };
    /** 放開後的慣性與回彈 */
    const step = () => {
      const max = maxScrollTop();
      if (Math.abs(velocity) > 0.05 && scrollTop >= 0 && scrollTop <= max) {
        scrollTop += velocity * 16; velocity *= FRICTION_PER_16MS;
        if (scrollTop < 0 || scrollTop > max) velocity *= 0.5;
      } else {
        const target = Math.max(0, Math.min(max, scrollTop));
        scrollTop += (target - scrollTop) * 0.2; velocity = 0;
        if (Math.abs(target - scrollTop) < 0.5) { scrollTop = target; render(); frameId = 0; return; }
      }
      render();
      frameId = requestAnimationFrame(step);
    };

    const onPointerDown = (event: PointerEvent) => {
      cancelAnimationFrame(frameId); frameId = 0; velocity = 0;
      drag = { pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY, lastTime: performance.now(), startScrollTop: scrollTop, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const deltaY = event.clientY - drag.startY;
      if (!drag.moved && Math.abs(deltaY) > TAP_SLOP_PX) {
        drag.moved = true;
        viewport.setPointerCapture(event.pointerId);
      }
      if (!drag.moved) return;
      const now = performance.now();
      velocity = (drag.lastY - event.clientY) / Math.max(1, now - drag.lastTime);
      drag.lastY = event.clientY; drag.lastTime = now;
      scrollTop = applyRubberBand(drag.startScrollTop - deltaY);
      render();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      suppressClick = drag.moved;
      drag = null;
      if (!frameId) frameId = requestAnimationFrame(step);
    };
    const onClickCapture = (event: MouseEvent) => {
      if (suppressClick) { event.stopPropagation(); event.preventDefault(); suppressClick = false; }
    };

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('click', onClickCapture, true);
    const resizeObserver = new ResizeObserver(() => { scrollTop = Math.min(scrollTop, maxScrollTop()); render(); });
    resizeObserver.observe(content); resizeObserver.observe(viewport);
    return () => {
      cancelAnimationFrame(frameId); resizeObserver.disconnect();
      viewport.removeEventListener('pointerdown', onPointerDown); viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp); viewport.removeEventListener('pointercancel', onPointerUp);
      viewport.removeEventListener('click', onClickCapture, true);
    };
  }, [onScroll]);

  return (
    <div ref={viewportRef} className={className} style={{ position: 'relative', overflow: 'hidden', touchAction: 'none', ...style }}>
      <div ref={contentRef} style={{ willChange: 'transform' }}>{children}</div>
    </div>
  );
}
