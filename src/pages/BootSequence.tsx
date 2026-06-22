import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSound from 'use-sound';
import { LogoMonolith, ScrambleText } from '../components/UiElements';

export default function BootSequence() {
  const [bootLog, setBootLog] = useState<string[]>([]);
  const [showTitle, setShowTitle] = useState(false);
  const navigate = useNavigate();

  const [playBoot] = useSound('/sounds/boot.mp3', { volume: 0.8 });

  useEffect(() => {
    playBoot();
    setTimeout(() => setShowTitle(true), 1500);

    const msgs = [
      "INITIALIZING KERNEL_CORE...",
      "BYPASSING SECURITY PROTOCOLS [||||||....] 45%",
      "BYPASSING SECURITY PROTOCOLS [||||||||||] 100%",
      "ACCESSING MAIN_FRAME // NODE: PNCP_EXTRACTOR",
      "CONNECTING TO SUPABASE CLOUD...",
      "DECRYPTING VAULT CREDENTIALS...",
      "SYSTEM READY. ROUTING TO GATEWAY...",
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < msgs.length) { setBootLog(prev => [...prev, msgs[i]]); i++; }
    }, 550);

    const timer = setTimeout(() => navigate('/login'), 7500);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#050508] text-red-500 font-mono pointer-events-none fade-in-boot">
      <div className="absolute inset-0 scanline"></div>
      <div className="absolute inset-0 fundo-estrelas opacity-30"></div>

      <div className="hero-fly">
        <LogoMonolith animated={true} className="w-44 h-44 mb-8 text-red-600" />
        <div className="h-20 flex flex-col items-center justify-center">
          {showTitle && (
            <>
              <h1 className="text-5xl font-black tracking-[0.5em] text-zinc-100 logo-glow drop-shadow-md">
                <ScrambleText text="MONOLITH" />
              </h1>
              <p className="text-red-700 tracking-[0.4em] text-xs mt-3 font-bold uppercase">
                <ScrambleText text="Tactical Acquisition Node" />
              </p>
            </>
          )}
        </div>
      </div>

      <div className="absolute bottom-10 left-10 text-[10px] text-red-600 font-bold opacity-80 terminal-fade">
        {bootLog.map((log, index) => <p key={index} className="mb-1">{log}</p>)}
        <p className="animate-flicker mt-2 block">_</p>
      </div>

      <div className="absolute bottom-10 right-10 text-[9px] text-zinc-800 font-mono uppercase tracking-widest terminal-fade">
        v1.0.0 // PRISMA DISTRIBUIDORA
      </div>
    </div>
  );
}
