import React, { useEffect, useRef, useState } from 'react';

const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Try WebGL2 first, then WebGL1
    let gl: WebGLRenderingContext | null = null;
    gl = canvas.getContext('webgl2') as WebGLRenderingContext;
    if (!gl) {
      gl = canvas.getContext('webgl');
    }
    if (!gl) {
      console.warn('[AnimatedBackground] WebGL not supported');
      setWebglFailed(true);
      return;
    }

    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Use mediump for better mobile compatibility
    const fsSource = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        
        float depth = 1.0 / (uv.y + 1.15);
        vec2 gridUv = vec2(uv.x * depth, depth + u_time * 0.05);
        
        float n = noise(gridUv * 3.5);
        float ripples = sin(gridUv.y * 18.0 + n * 8.0 + u_time * 0.15);
        
        float topoLine = smoothstep(0.03, 0.0, abs(ripples));
        
        vec3 baseColor = vec3(0.02, 0.04, 0.1);
        vec3 accentColor = vec3(0.0, 0.4, 1.0);
        vec3 neonColor = vec3(0.2, 0.6, 1.0);
        
        vec3 finalColor = mix(baseColor, accentColor, n * 0.6);
        finalColor += topoLine * neonColor * depth * 0.4;
        
        float fade = smoothstep(0.1, -1.0, uv.y);
        finalColor *= (1.0 - length(uv) * 0.45) * (1.0 - fade);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const createShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) {
        console.error('[AnimatedBackground] Failed to create shader');
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      // Check compilation status
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[AnimatedBackground] Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    if (!vertexShader || !fragmentShader) {
      console.error('[AnimatedBackground] Shader creation failed');
      setWebglFailed(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      console.error('[AnimatedBackground] Failed to create program');
      setWebglFailed(true);
      return;
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    // Check link status
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[AnimatedBackground] Program link error:', gl.getProgramInfoLog(program));
      setWebglFailed(true);
      return;
    }
    
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    const posAttrib = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posAttrib);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, "u_time");
    const resLoc = gl.getUniformLocation(program, "u_resolution");

    let animationFrameId: number;
    let isContextLost = false;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      cancelAnimationFrame(animationFrameId);
      console.warn('[AnimatedBackground] WebGL context lost');
    };

    const handleContextRestored = () => {
      isContextLost = false;
      console.log('[AnimatedBackground] WebGL context restored');
      // Would need to reinitialize - for simplicity, show fallback
      setWebglFailed(true);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const render = (time: number) => {
      if (isContextLost) return;
      
      const { innerWidth: width, innerHeight: height } = window;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvasWidth = Math.floor(width * dpr);
      const canvasHeight = Math.floor(height * dpr);
      
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        gl!.viewport(0, 0, canvasWidth, canvasHeight);
      }

      gl!.uniform1f(timeLoc, time * 0.001);
      gl!.uniform2f(resLoc, canvasWidth, canvasHeight);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    // Start with a small delay to ensure canvas is ready
    setTimeout(() => {
      if (!isContextLost) {
        animationFrameId = requestAnimationFrame(render);
      }
    }, 50);

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* CSS Fallback gradient - always rendered behind canvas */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(0, 102, 255, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 50%, rgba(51, 153, 255, 0.1) 0%, transparent 40%),
            radial-gradient(ellipse at 20% 80%, rgba(0, 80, 200, 0.12) 0%, transparent 40%),
            linear-gradient(180deg, hsl(220, 80%, 8%) 0%, hsl(220, 70%, 4%) 100%)
          `
        }}
      />
      {/* WebGL canvas - renders on top if working */}
      {!webglFailed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'auto' }}
        />
      )}
    </div>
  );
};

export default AnimatedBackground;
