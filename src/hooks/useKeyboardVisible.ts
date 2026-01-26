import { useState, useEffect } from 'react';

export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    
    if (viewport) {
      const handleResize = () => {
        // Уменьшаем порог до 100px для лучшего определения
        const heightDiff = window.innerHeight - viewport.height;
        setIsKeyboardVisible(heightDiff > 100);
      };

      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);
      
      return () => {
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      };
    }

    // Fallback для браузеров без visualViewport
    const handleFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        setIsKeyboardVisible(true);
      }
    };

    const handleBlur = () => {
      setTimeout(() => setIsKeyboardVisible(false), 100);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  return isKeyboardVisible;
};
