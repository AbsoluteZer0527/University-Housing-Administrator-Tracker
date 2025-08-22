"use client";

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function FloatingBackground() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Add chaotic custom keyframes
    if (theme === 'crown') {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes chaoticFloat1 {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
          15% { transform: translate(-120px, -80px) rotate(72deg) scale(1.3); }
          30% { transform: translate(150px, -200px) rotate(144deg) scale(0.7); }
          45% { transform: translate(-200px, 100px) rotate(216deg) scale(1.5); }
          60% { transform: translate(250px, 150px) rotate(288deg) scale(0.8); }
          75% { transform: translate(-100px, -150px) rotate(360deg) scale(1.2); }
          90% { transform: translate(180px, -50px) rotate(432deg) scale(0.9); }
          100% { transform: translate(0px, 0px) rotate(504deg) scale(1); }
        }
        
        @keyframes chaoticFloat2 {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(1) skew(0deg); }
          12% { transform: translate(200px, -100px) rotate(-60deg) scale(1.4) skew(10deg); }
          25% { transform: translate(-150px, -250px) rotate(120deg) scale(0.6) skew(-15deg); }
          37% { transform: translate(300px, 50px) rotate(-180deg) scale(1.6) skew(20deg); }
          50% { transform: translate(-250px, 200px) rotate(240deg) scale(0.5) skew(-25deg); }
          62% { transform: translate(100px, -180px) rotate(-300deg) scale(1.3) skew(15deg); }
          75% { transform: translate(-180px, -50px) rotate(360deg) scale(0.8) skew(-10deg); }
          87% { transform: translate(220px, 180px) rotate(-420deg) scale(1.1) skew(30deg); }
          100% { transform: translate(0px, 0px) rotate(480deg) scale(1) skew(0deg); }
        }
        
        @keyframes chaoticFloat3 {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
          20% { transform: translate(-300px, 150px) rotate(144deg) scale(1.8); }
          40% { transform: translate(250px, -300px) rotate(-216deg) scale(0.4); }
          60% { transform: translate(-100px, 250px) rotate(360deg) scale(1.5); }
          80% { transform: translate(350px, -100px) rotate(-288deg) scale(0.7); }
          100% { transform: translate(0px, 0px) rotate(720deg) scale(1); }
        }
        
        @keyframes chaoticFloat4 {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(1) rotateY(0deg); }
          10% { transform: translate(80px, -200px) rotate(36deg) scale(1.2) rotateY(180deg); }
          20% { transform: translate(-160px, 120px) rotate(-72deg) scale(0.8) rotateY(360deg); }
          30% { transform: translate(240px, 80px) rotate(108deg) scale(1.4) rotateY(180deg); }
          40% { transform: translate(-120px, -160px) rotate(-144deg) scale(0.6) rotateY(0deg); }
          50% { transform: translate(320px, -80px) rotate(180deg) scale(1.6) rotateY(360deg); }
          60% { transform: translate(-240px, 200px) rotate(-216deg) scale(0.9) rotateY(180deg); }
          70% { transform: translate(160px, -240px) rotate(252deg) scale(1.1) rotateY(0deg); }
          80% { transform: translate(-320px, -40px) rotate(-288deg) scale(1.3) rotateY(180deg); }
          90% { transform: translate(200px, 160px) rotate(324deg) scale(0.7) rotateY(360deg); }
          100% { transform: translate(0px, 0px) rotate(360deg) scale(1) rotateY(0deg); }
        }
        
        @keyframes chaoticFloat5 {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(0.3); }
          5% { transform: translate(-50px, -80px) rotate(18deg) scale(2.5); }
          10% { transform: translate(120px, 30px) rotate(-36deg) scale(0.2); }
          15% { transform: translate(-180px, 120px) rotate(54deg) scale(2.8); }
          20% { transform: translate(200px, -150px) rotate(-72deg) scale(0.1); }
          25% { transform: translate(-100px, 80px) rotate(90deg) scale(3.2); }
          30% { transform: translate(250px, -30px) rotate(-108deg) scale(0.4); }
          35% { transform: translate(-220px, -100px) rotate(126deg) scale(2.2); }
          40% { transform: translate(80px, 200px) rotate(-144deg) scale(0.15); }
          45% { transform: translate(-180px, 60px) rotate(162deg) scale(2.7); }
          50% { transform: translate(300px, -100px) rotate(-180deg) scale(0.25); }
          55% { transform: translate(-120px, -180px) rotate(198deg) scale(3.0); }
          60% { transform: translate(150px, 180px) rotate(-216deg) scale(0.35); }
          65% { transform: translate(-250px, -20px) rotate(234deg) scale(2.4); }
          70% { transform: translate(180px, -120px) rotate(-252deg) scale(0.2); }
          75% { transform: translate(-80px, 150px) rotate(270deg) scale(2.9); }
          80% { transform: translate(220px, 40px) rotate(-288deg) scale(0.3); }
          85% { transform: translate(-150px, -150px) rotate(306deg) scale(2.6); }
          90% { transform: translate(100px, 120px) rotate(-324deg) scale(0.18); }
          95% { transform: translate(-200px, -60px) rotate(342deg) scale(3.1); }
          100% { transform: translate(0px, 0px) rotate(360deg) scale(0.3); }
        }
        
        .chaotic-1 { animation: chaoticFloat1 8s ease-in-out infinite; }
        .chaotic-2 { animation: chaoticFloat2 12s ease-in-out infinite; }
        .chaotic-3 { animation: chaoticFloat3 6s ease-in-out infinite; }
        .chaotic-4 { animation: chaoticFloat4 10s ease-in-out infinite; }
        .chaotic-5 { animation: chaoticFloat5 15s ease-in-out infinite; }
        
        .wobble {
          animation: wobble 2s ease-in-out infinite;
        }
        
        @keyframes wobble {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(5deg) scale(1.05); }
          50% { transform: rotate(0deg) scale(1); }
          75% { transform: rotate(-5deg) scale(0.95); }
          100% { transform: rotate(0deg); }
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }
  }, [theme]);

  if (!mounted || theme !== 'crown') return null;

  // Generate MANY more chaotic crowns
  const crowns = Array.from({ length: 25 }, (_, i) => {
    const animations = ['chaotic-1', 'chaotic-2', 'chaotic-3', 'chaotic-4', 'chaotic-5'];
    const animationClass = animations[i % 5];
    
    return {
      id: i,
      size: Math.random() * 80 + 30, // 30-110px
      left: Math.random() * 120 - 10, // -10% to 110% (off-screen)
      top: Math.random() * 120 - 10, // -10% to 110%
      animationClass,
      animationDelay: Math.random() * 20, // 0-20s delay
      animationDuration: 6 + Math.random() * 10, // 6-16s duration
      opacity: 0.03 + Math.random() * 0.08, // 0.03-0.11
      rotation: Math.random() * 360,
    };
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
      {/* Main chaotic layer */}
      {crowns.map((crown) => (
        <div
          key={crown.id}
          className={`absolute ${crown.animationClass}`}
          style={{
            left: `${crown.left}%`,
            top: `${crown.top}%`,
            width: `${crown.size}px`,
            height: `${crown.size}px`,
            backgroundImage: 'url(/crown_transparent.png)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: crown.opacity,
            animationDelay: `${crown.animationDelay}s`,
            animationDuration: `${crown.animationDuration}s`,
            animationDirection: crown.id % 3 === 0 ? 'reverse' : 'normal',
            animationTimingFunction: crown.id % 4 === 0 ? 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' : 'ease-in-out',
            transform: `rotate(${crown.rotation}deg)`,
          }}
        />
      ))}
      
      {/* Extra wobbling layer */}
      {crowns.slice(0, 15).map((crown) => (
        <div
          key={`wobble-${crown.id}`}
          className="absolute wobble animate-pulse"
          style={{
            left: `${(crown.left + Math.random() * 40 - 20) % 100}%`,
            top: `${(crown.top + Math.random() * 40 - 20) % 100}%`,
            width: `${crown.size * 0.6}px`,
            height: `${crown.size * 0.6}px`,
            backgroundImage: 'url(/crown_transparent.png)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: crown.opacity * 0.5,
            animationDelay: `${crown.animationDelay + 10}s`,
            animationDuration: `${crown.animationDuration * 1.5}s`,
            filter: `hue-rotate(${Math.random() * 60}deg) brightness(${0.8 + Math.random() * 0.4})`,
          }}
        />
      ))}
      
      {/* Spinning crazy layer */}
      {crowns.slice(0, 8).map((crown) => (
        <div
          key={`spin-${crown.id}`}
          className="absolute animate-spin"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${crown.size * 1.2}px`,
            height: `${crown.size * 1.2}px`,
            backgroundImage: 'url(/crown_transparent.png)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: crown.opacity * 0.3,
            animationDelay: `${crown.animationDelay + 5}s`,
            animationDuration: `${2 + Math.random() * 4}s`, // Fast spinning
            animationDirection: crown.id % 2 === 0 ? 'reverse' : 'normal',
            filter: `blur(${Math.random() * 1}px) saturate(${1.5 + Math.random()})`,
          }}
        />
      ))}
    </div>
  );
}