import { useState, useEffect } from 'react';

export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;

    const viewport = window.visualViewport;
    const initialHeight = viewport.height; // Сохраняем начальную высоту
    const threshold = 150; // Клавиатура обычно > 150px

    const handleResize = () => {
      const heightDiff = initialHeight - viewport.height;
      setIsKeyboardVisible(heightDiff > threshold);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  return isKeyboardVisible;
};
