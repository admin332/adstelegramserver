import React from 'react';
import { Starfield } from './starfield';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <Starfield 
        mouseAdjust={true}
        hyperspace={true}
        speed={0.2}
        quantity={128}
        starColor="rgba(255,255,255,1)"
        bgColor="rgba(0,0,0,1)"
        warpFactor={3}
        opacity={1}
      />
    </div>
  );
};

export default AnimatedBackground;
