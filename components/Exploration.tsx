
import React, { useEffect, useState, useRef } from 'react';
import { Character, Enemy } from '../types';

interface ExplorationProps {
  character: Character;
  scenarioEnemies: Enemy[];
  onEncounter: (enemy: Enemy) => void;
}

const MAP_SIZE = 20; // 20x20 grid
const TILE_SIZE = 30;

const Exploration: React.FC<ExplorationProps> = ({ character, scenarioEnemies, onEncounter }) => {
  const [pos, setPos] = useState({ x: 10, y: 10 });
  const [message, setMessage] = useState("Seek the broken mirror fragments...");
  const [isWalking, setIsWalking] = useState(false);
  const [direction, setDirection] = useState(1); // 1 right, -1 left
  
  // Animation State
  const [frame, setFrame] = useState(0); // 0: Idle, 1: Walk

  // Simple map generation (0: grass, 1: tree)
  const mapRef = useRef<number[][]>([]);

  useEffect(() => {
    const newMap = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      const row = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        // More walls/obstacles in mirror world
        row.push(Math.random() < 0.15 ? 1 : 0);
      }
      newMap.push(row);
    }
    mapRef.current = newMap;
  }, []);

  // Animation Loop
  useEffect(() => {
    if (!isWalking) {
        setFrame(0);
        return;
    }
    
    const interval = setInterval(() => {
        setFrame(prev => (prev === 0 ? 1 : 0));
    }, 200); // Switch frames every 200ms while walking

    return () => clearInterval(interval);
  }, [isWalking]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { key } = e;
      let dx = 0;
      let dy = 0;

      if (key === 'ArrowUp' || key === 'w') dy = -1;
      if (key === 'ArrowDown' || key === 's') dy = 1;
      if (key === 'ArrowLeft' || key === 'a') { dx = -1; setDirection(-1); }
      if (key === 'ArrowRight' || key === 'd') { dx = 1; setDirection(1); }

      if (dx === 0 && dy === 0) return;
      
      setIsWalking(true);

      setPos((prev) => {
        const nx = Math.max(0, Math.min(MAP_SIZE - 1, prev.x + dx));
        const ny = Math.max(0, Math.min(MAP_SIZE - 1, prev.y + dy));
        
        if (mapRef.current[ny] && mapRef.current[ny][nx] === 1) {
            return prev;
        }
        return { x: nx, y: ny };
      });

      // Encounter rate
      if (Math.random() < 0.08) { 
        triggerEncounter();
      }
    };

    const handleKeyUp = () => setIsWalking(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerEncounter = () => {
    // Progress through enemies sequentially or randomly for now? 
    // GDD implies sequential stages, but for open world feeling we'll random pick from list
    const randomEnemy = scenarioEnemies[Math.floor(Math.random() * scenarioEnemies.length)];
    setMessage(`Mirror Reflection Detected: ${randomEnemy.name}!`);
    setIsWalking(false);
    setTimeout(() => {
      onEncounter(randomEnemy);
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0B3B] text-white pixel-font">
      <h1 className="text-lg text-blue-200 mb-4 tracking-widest font-serif italic">EXPLORING THE MIRROR WORLD</h1>
      
      <div 
        className="relative bg-[#1a1a2e] border-4 border-[#C0C0C0] shadow-[0_0_20px_rgba(192,192,192,0.3)] overflow-hidden"
        style={{ 
          width: MAP_SIZE * TILE_SIZE, 
          height: MAP_SIZE * TILE_SIZE,
          imageRendering: 'pixelated'
        }}
      >
        {/* Render Map */}
        {mapRef.current.map((row, y) => (
          row.map((tile, x) => {
             if (tile === 1) {
               return (
                 <div 
                    key={`${x}-${y}`}
                    className="absolute bg-[#4A5568] opacity-80"
                    style={{
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                        left: x * TILE_SIZE,
                        top: y * TILE_SIZE,
                        boxShadow: 'inset 2px 2px 0px #718096',
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' // Crystal shape hint
                    }}
                 />
               )
             }
             return null;
          })
        ))}

        {/* Grid Overlay for Retro Feel */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px` }}>
        </div>

        {/* Render Player */}
        <div 
          className="absolute transition-all duration-200 ease-linear z-10"
          style={{
            width: TILE_SIZE,
            height: TILE_SIZE,
            left: pos.x * TILE_SIZE,
            top: pos.y * TILE_SIZE,
          }}
        >
            {character.pixelSpriteUrl ? (
                 <img 
                    src={frame === 0 ? character.pixelSpriteUrl : character.pixelSpriteUrlWalk} 
                    alt={character.name}
                    className="w-full h-full object-contain"
                    style={{ 
                        transform: `scaleX(${direction})`,
                        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' 
                    }}
                 />
            ) : (
                <div 
                    className="w-full h-full"
                    style={{
                        backgroundColor: character.pixelColor,
                        boxShadow: `0 0 10px ${character.pixelColor}`,
                        borderRadius: '50% 50% 0 0'
                    }}
                />
            )}
        </div>

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none z-20" 
             style={{
               background: 'radial-gradient(circle, transparent 40%, #000 100%)'
             }}
        />
      </div>

      <div className="mt-6 p-4 border-t-2 border-b-2 border-double border-[#C0C0C0] bg-black/60 w-[600px] min-h-[80px] flex items-center justify-center backdrop-blur-sm">
        <p className="text-sm font-mono text-blue-100">{message}</p>
      </div>
    </div>
  );
};

export default Exploration;