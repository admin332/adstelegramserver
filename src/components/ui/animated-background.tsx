import React from 'react';

const AnimatedBackground: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 z-0"
      style={{
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(0, 102, 255, 0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 50%, rgba(51, 153, 255, 0.15) 0%, transparent 40%),
          radial-gradient(ellipse at 20% 80%, rgba(0, 80, 200, 0.15) 0%, transparent 40%),
          linear-gradient(180deg, hsl(220, 80%, 8%) 0%, hsl(220, 70%, 4%) 100%)
        `
      }}
    />
  );
};

export default AnimatedBackground;
