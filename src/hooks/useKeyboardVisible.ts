import { useState, useEffect } from 'react';

export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    
    if (viewport) {
      const handleResize = () => {
        const heightDiff = window.innerHeight - viewport.height;
        setIsKeyboardVisible(heightDiff > 150);
      };

      viewport.addEventListener('resize', handleResize);
      return () => viewport.removeEventListener('resize', handleResize);
    }

    // Fallback for browsers without visualViewport
    const handleFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        setIsKeyboardVisible(true);
      }
    };

    const handleBlur = () => {
      setIsKeyboardVisible(false);
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
