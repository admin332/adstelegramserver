import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import pako from 'pako';

interface TgsStickerProps {
  src: string;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  style?: React.CSSProperties;
}

export const TgsSticker = ({ 
  src, 
  className, 
  loop = true, 
  autoplay = true,
  style 
}: TgsStickerProps) => {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    const loadTgs = async () => {
      try {
        const response = await fetch(src);
        const buffer = await response.arrayBuffer();
        const decompressed = pako.ungzip(new Uint8Array(buffer), { to: 'string' });
        const json = JSON.parse(decompressed);
        setAnimationData(json);
      } catch (error) {
        console.error('Failed to load TGS sticker:', error);
      }
    };
    
    loadTgs();
  }, [src]);

  if (!animationData) return null;

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoPlay={autoplay}
      className={className}
      style={style}
    />
  );
};
