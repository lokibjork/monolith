import { useState, useEffect } from 'react';

export const LogoMonolith = ({ className, animated = false }: { className?: string, animated?: boolean }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <path className={animated ? "outline" : ""} fill="none" stroke="currentColor" strokeWidth="3" d="M 5,25 L 25,5 L 95,5 L 95,75 L 75,95 L 5,95 Z" />
    <g className={animated ? "solid" : ""} fill="currentColor">
      <rect x="12" y="12" width="8" height="8" />
      <rect x="85" y="12" width="4" height="4" />
      <rect x="85" y="84" width="4" height="4" />
      <rect x="12" y="84" width="4" height="4" />
      <rect x="0" y="50" width="8" height="2" />
      <rect x="92" y="50" width="8" height="2" />
      <polygon points="20,80 20,35 45,65 30,80" />
      <polygon points="80,80 80,35 55,65 70,80" />
      <polygon points="50,20 62,45 50,85 38,45" />
    </g>
  </svg>
);

export const ScrambleText = ({ text }: { text: string }) => {
  const [display, setDisplay] = useState('');
  
  useEffect(() => {
    let iteration = 0;
    const chars = '!<>-_\\/[]{}—=+*^?#_010101';
    
    const interval = setInterval(() => {
      setDisplay(text.split('').map((_letter, index) => {
        if (index < iteration) return text[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      
      iteration += 1 / 3; 
      if (iteration >= text.length) clearInterval(interval);
    }, 30); 
    
    return () => clearInterval(interval);
  }, [text]);

  return <span>{display}</span>;
};