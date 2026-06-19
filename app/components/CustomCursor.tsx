import { useEffect, useState } from 'react';

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [trailingPosition, setTrailingPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName.toLowerCase() === 'button' ||
        target.tagName.toLowerCase() === 'a' ||
        target.tagName.toLowerCase() === 'input' ||
        target.tagName.toLowerCase() === 'label'
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  // 遅延して追従するアニメーション
  useEffect(() => {
    const followCursor = () => {
      setTrailingPosition((prev) => ({
        x: prev.x + (position.x - prev.x) * 0.15,
        y: prev.y + (position.y - prev.y) * 0.15,
      }));
    };
    const animationFrame = requestAnimationFrame(followCursor);
    return () => cancelAnimationFrame(animationFrame);
  }, [position, trailingPosition]);

  return (
    <>
      <div
        className="cursor-dot"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
      />
      <div
        className={`cursor-trailing ${isHovering ? 'hovering' : ''}`}
        style={{
          transform: `translate3d(${trailingPosition.x}px, ${trailingPosition.y}px, 0)`,
        }}
      />
      <style>{`
        /* カスタムカーソル全体で元のカーソルを隠しつつ独自表示 */
        @media (pointer: fine) {
          body {
            cursor: none;
          }
          button, a, input, label, select, textarea {
            cursor: none !important;
          }
          .cursor-dot {
            position: fixed;
            top: 0;
            left: 0;
            width: 8px;
            height: 8px;
            background-color: var(--accent-color);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            transform: translate(-50%, -50%);
            transition: width 0.2s, height 0.2s;
          }
          .cursor-trailing {
            position: fixed;
            top: 0;
            left: 0;
            width: 40px;
            height: 40px;
            background: transparent;
            box-shadow: 0 0 15px rgba(102, 126, 234, 0.3);
            border: 1px solid rgba(102, 126, 234, 0.2);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9998;
            margin-left: -20px;
            margin-top: -20px;
            transition: transform 0.1s, width 0.3s, height 0.3s, border-radius 0.3s, background-color 0.3s, box-shadow 0.3s;
          }
          .cursor-trailing.hovering {
            width: 50px;
            height: 50px;
            margin-left: -25px;
            margin-top: -25px;
            border-radius: 50%;
            background: rgba(102, 126, 234, 0.05);
            box-shadow: inset 0 0 15px rgba(102, 126, 234, 0.15), 0 0 10px rgba(102, 126, 234, 0.2);
            border-color: rgba(102, 126, 234, 0.4);
          }
        }
      `}</style>
    </>
  );
}
