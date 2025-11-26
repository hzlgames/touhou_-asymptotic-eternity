import React, { useEffect, useState } from 'react';

interface KaguyaHUDProps {
    hp: number;
    maxHp: number; // usually 3 for player
    bombs: number;
    score: number;
    graze: number;
    sprites: Record<string, string>;
}

const KaguyaHUD: React.FC<KaguyaHUDProps> = ({ hp, maxHp, bombs, score, graze, sprites }) => {
    const [shake, setShake] = useState(0);

    useEffect(() => {
        setShake(5);
        const timer = setTimeout(() => setShake(0), 300);
        return () => clearTimeout(timer);
    }, [hp]);

    // Map HP to Moon Phase Asset ID
    const getMoonSprite = () => {
        if (hp >= 3) return sprites['UI_KAGUYA_MOON_FULL'];
        if (hp === 2) return sprites['UI_KAGUYA_MOON_GIBBOUS'];
        if (hp === 1) return sprites['UI_KAGUYA_MOON_HALF'];
        if (hp === 0) return sprites['UI_KAGUYA_MOON_CRESCENT']; // Last stand
        return sprites['UI_KAGUYA_MOON_CRESCENT'];
    };

    const moonUrl = getMoonSprite();
    const jewelUrl = sprites['UI_KAGUYA_JEWEL'];
    const borderUrl = sprites['UI_FRAME_BORDER'];
    const cornerUrl = sprites['UI_FRAME_CORNER'];

    return (
        <div className="w-[320px] h-full bg-[#050510] relative overflow-hidden flex flex-col p-8 font-serif text-[#E0E0E6]">
            
            {/* === BORDERS & CORNERS === */}
            
            {/* CORNERS (64x64) */}
            {cornerUrl && (
                <>
                    {/* Top Left */}
                    <img src={cornerUrl} className="absolute top-0 left-0 w-16 h-16 z-30 pointer-events-none" alt="" />
                    {/* Top Right */}
                    <img src={cornerUrl} className="absolute top-0 right-0 w-16 h-16 z-30 transform scale-x-[-1] pointer-events-none" alt="" />
                    {/* Bottom Left */}
                    <img src={cornerUrl} className="absolute bottom-0 left-0 w-16 h-16 z-30 transform scale-y-[-1] pointer-events-none" alt="" />
                    {/* Bottom Right */}
                    <img src={cornerUrl} className="absolute bottom-0 right-0 w-16 h-16 z-30 transform rotate-180 pointer-events-none" alt="" />
                </>
            )}

            {/* BORDERS (16px thick) */}
            {borderUrl && (
                <>
                    {/* Left Border (Vertical) */}
                    <div 
                        className="absolute top-16 bottom-16 left-0 w-4 z-20 opacity-80 mix-blend-screen pointer-events-none"
                        style={{ 
                            backgroundImage: `url(${borderUrl})`,
                            backgroundSize: '100% auto', // Keep width, tile height
                            backgroundRepeat: 'repeat-y'
                        }}
                    />
                    {/* Right Border (Vertical) */}
                    <div 
                        className="absolute top-16 bottom-16 right-0 w-4 z-20 opacity-80 mix-blend-screen pointer-events-none"
                        style={{ 
                            backgroundImage: `url(${borderUrl})`,
                            backgroundSize: '100% auto',
                            backgroundRepeat: 'repeat-y'
                        }}
                    />
                    {/* Top Border (Horizontal) */}
                    <div 
                        className="absolute top-0 left-16 right-16 h-4 z-20 opacity-80 mix-blend-screen pointer-events-none"
                        style={{ 
                            backgroundImage: `url(${borderUrl})`,
                            backgroundSize: 'auto 100%', // Keep height, tile width
                            backgroundRepeat: 'repeat-x'
                        }}
                    />
                    {/* Bottom Border (Horizontal) */}
                    <div 
                        className="absolute bottom-0 left-16 right-16 h-4 z-20 opacity-80 mix-blend-screen pointer-events-none"
                        style={{ 
                            backgroundImage: `url(${borderUrl})`,
                            backgroundSize: 'auto 100%',
                            backgroundRepeat: 'repeat-x'
                        }}
                    />
                </>
            )}

            {/* Background Texture */}
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
            
            {/* Header / Score */}
            <div className="relative z-10 mb-8 text-center border-b border-white/20 pb-4 mx-4 mt-4">
                <div className="text-xs tracking-[0.4em] text-cyan-400 mb-2">SYSTEM: LUNAR_PHASE</div>
                <div className="text-3xl font-bold tracking-widest text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                    {score.toLocaleString().padStart(9, '0')}
                </div>
            </div>

            {/* HP: The Moon */}
            <div className="flex flex-col items-center mb-10 relative z-10">
                <div 
                    className="w-48 h-48 relative transition-transform duration-100" 
                    style={{ transform: `translateX(${shake}px)` }}
                >
                    {moonUrl ? (
                         <img src={moonUrl} className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(255,215,0,0.3)]" alt="Moon Phase" />
                    ) : (
                         <div className="w-full h-full rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-200 animate-pulse border-4 border-yellow-500"></div>
                    )}
                    
                    {/* Orbiting Jewels (Bombs) */}
                    {Array.from({ length: 5 }).map((_, i) => {
                        const active = i < bombs;
                        const angle = (i * (360 / 5)) * (Math.PI / 180);
                        const radius = 80; // Distance from center
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        
                        return (
                            <div 
                                key={i}
                                className={`absolute w-8 h-8 transition-all duration-500 ${active ? 'opacity-100 scale-100' : 'opacity-20 scale-75 grayscale'}`}
                                style={{ 
                                    top: `calc(50% + ${y}px - 16px)`, 
                                    left: `calc(50% + ${x}px - 16px)` 
                                }}
                            >
                                {jewelUrl ? (
                                    <img src={jewelUrl} className="w-full h-full object-contain drop-shadow-[0_0_10px_white]" alt="Jewel" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-cyan-400"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="mt-4 text-xs text-gray-400 tracking-widest">LIFE INTEGRITY</div>
            </div>

            {/* Graze / Info */}
            <div className="mt-auto bg-[#0B0B3B]/50 p-4 border border-cyan-900 relative z-10 mx-2 mb-4">
                 <div className="flex justify-between items-center mb-2">
                     <span className="text-cyan-400 text-sm">GRAZE</span>
                     <span className="text-xl">{graze}</span>
                 </div>
                 <div className="text-[10px] text-gray-500 leading-relaxed">
                     Impossible Request Protocol: ACTIVE<br/>
                     Eternity Engine: STABLE<br/>
                     Time Stagnation: {bombs > 0 ? 'READY' : 'OFFLINE'}
                 </div>
            </div>
        </div>
    );
};

export default KaguyaHUD;