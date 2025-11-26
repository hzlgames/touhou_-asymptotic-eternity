
import React, { useEffect, useState } from 'react';

interface HoloScrollProps {
    title: string;
    text: string;
    portraitUrl?: string;
}

const HoloScroll: React.FC<HoloScrollProps> = ({ title, text, portraitUrl }) => {
    const [displayedText, setDisplayedText] = useState('');
    
    useEffect(() => {
        let i = 0;
        setDisplayedText('');
        const timer = setInterval(() => {
            if (i < text.length) {
                setDisplayedText(prev => prev + text.charAt(i));
                i++;
            } else {
                clearInterval(timer);
            }
        }, 30);
        return () => clearInterval(timer);
    }, [text]);

    return (
        <div className="absolute inset-x-0 bottom-0 min-h-[200px] bg-gradient-to-t from-black via-[#0B0B3B]/90 to-transparent z-[60] flex flex-col items-center justify-end pb-8 pointer-events-none">
            <div className="w-full max-w-4xl border-t-2 border-[#FFD700]/50 p-6 shadow-[0_-10px_40px_rgba(11,11,59,0.8)] backdrop-blur-md flex gap-6 pointer-events-auto relative overflow-hidden group">
                {/* Holographic Scanline Effect */}
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
                
                {portraitUrl && (
                    <div className="w-32 h-32 bg-[#050510] border border-cyan-500/50 shrink-0 overflow-hidden relative shadow-[0_0_15px_cyan]">
                         <img src={portraitUrl} className="w-full h-full object-cover contrast-125 sepia-[0.3]" alt="Speaker" />
                         <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/50 to-transparent"></div>
                    </div>
                )}
                
                <div className="flex-1 flex flex-col relative z-10">
                    <h3 className="text-cyan-300 text-lg mb-2 font-bold tracking-wider font-mono uppercase flex items-center gap-2">
                        <span className="w-2 h-2 bg-cyan-500 animate-pulse"></span>
                        {title}
                    </h3>
                    <p className="text-white text-xl leading-relaxed font-serif tracking-wide drop-shadow-md">
                        {displayedText}
                        <span className="inline-block w-2 h-5 bg-[#FFD700] ml-1 animate-pulse align-middle"></span>
                    </p>
                </div>

                {/* Corner Accents */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#FFD700]"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#FFD700]"></div>
            </div>
        </div>
    );
};

export default HoloScroll;
