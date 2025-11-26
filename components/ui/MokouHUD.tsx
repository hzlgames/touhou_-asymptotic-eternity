
import React, { useEffect, useState } from 'react';

interface MokouHUDProps {
    hp: number;
    maxHp: number;
    bombs: number;
    score: number;
    graze: number;
    sprites: Record<string, string>;
}

const MokouHUD: React.FC<MokouHUDProps> = ({ hp, maxHp, bombs, score, graze, sprites }) => {
    const [shake, setShake] = useState(0);

    useEffect(() => {
        setShake(5);
        const timer = setTimeout(() => setShake(0), 300);
        return () => clearTimeout(timer);
    }, [hp]);

    // Map HP to Clock Sprite
    const getClockSprite = () => {
        if (hp >= 3) return sprites['UI_MOKOU_CLOCK_12'];
        if (hp === 2) return sprites['UI_MOKOU_CLOCK_3'];
        if (hp === 1) return sprites['UI_MOKOU_CLOCK_6'];
        return sprites['UI_MOKOU_CLOCK_9'];
    };

    const clockUrl = getClockSprite();
    const wingUrl = sprites['UI_MOKOU_WING'];
    const borderUrl = sprites['UI_FRAME_BORDER'];

    return (
        <div className="w-[320px] h-full bg-[#1a0505] border-l-4 border-red-900 relative overflow-hidden flex flex-col p-6 font-mono text-red-100">
             {/* Background Texture */}
             <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>
             
             {/* Header */}
             <div className="relative z-10 mb-8 text-center border-b border-red-800/50 pb-4">
                <div className="text-xs tracking-[0.4em] text-red-500 mb-2">SYSTEM: DEATH_TIMER</div>
                <div className="text-3xl font-bold tracking-widest text-red-200 drop-shadow-[0_0_15px_red]">
                    {score.toLocaleString().padStart(9, '0')}
                </div>
            </div>

            {/* HP: The Clock */}
            <div className="flex flex-col items-center mb-10 relative">
                <div className="relative">
                    {/* Wings (Bombs) */}
                    {bombs > 0 && wingUrl && (
                        <>
                            <img 
                                src={wingUrl} 
                                className="absolute top-0 -left-20 w-24 h-48 object-contain opacity-80 animate-pulse drop-shadow-[0_0_10px_orange]" 
                                style={{ transform: 'scaleX(-1)' }} 
                            />
                             <img 
                                src={wingUrl} 
                                className="absolute top-0 -right-20 w-24 h-48 object-contain opacity-80 animate-pulse drop-shadow-[0_0_10px_orange]" 
                            />
                        </>
                    )}

                    <div 
                        className="w-48 h-48 relative transition-transform duration-100 z-10" 
                        style={{ transform: `translateX(${shake}px)` }}
                    >
                        {clockUrl ? (
                            <img src={clockUrl} className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,0,0,0.4)]" alt="Clock Life" />
                        ) : (
                            <div className="w-full h-full rounded-full border-4 border-red-600 bg-black flex items-center justify-center">
                                <div className="text-red-500 text-4xl">{hp}/{maxHp}</div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-4 text-xs text-red-400 tracking-widest uppercase">Resurrection Cycles Remaining</div>
            </div>

            {/* Info Panel */}
            <div className="mt-auto bg-black/50 p-4 border border-red-900 relative">
                 {borderUrl && (
                     <div className="absolute -top-2 left-0 right-0 h-2 overflow-hidden opacity-50 grayscale brightness-50">
                         <img src={borderUrl} className="w-full h-full object-cover" />
                     </div>
                 )}
                 <div className="flex justify-between items-center mb-2">
                     <span className="text-red-400 text-sm">VENDETTA (GRAZE)</span>
                     <span className="text-xl text-white">{graze}</span>
                 </div>
                 <div className="text-[10px] text-gray-500 leading-relaxed">
                     Pain Threshold: CRITICAL<br/>
                     Hourai Elixir: DETECTED<br/>
                     Ignition: {bombs > 0 ? 'READY' : 'DEPLETED'}
                 </div>
            </div>

        </div>
    );
};

export default MokouHUD;
