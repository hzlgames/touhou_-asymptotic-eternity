
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Character, Enemy, MapData, MapEntity, TileType, WorldType } from '../types';
import Stage1Eientei, { getStage1Data, TILE_SIZE } from './stages/Stage1Eientei';

interface ExplorationProps {
  character: Character;
  scenarioEnemies: Enemy[];
  onEncounter: (enemy: Enemy) => void;
  backgroundUrl?: string;
}

const Exploration: React.FC<ExplorationProps> = ({ character, scenarioEnemies, onEncounter, backgroundUrl }) => {
  // --- ENGINE STATE ---
  const [worldType, setWorldType] = useState<WorldType>(WorldType.REALITY);
  const [sanity, setSanity] = useState(100);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [inventory, setInventory] = useState<Set<string>>(new Set());
  const [mapData, setMapData] = useState<MapData | null>(null);
  
  // Physics & FX
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [isWalking, setIsWalking] = useState(false);
  const [direction, setDirection] = useState(1);
  const [interactionTarget, setInteractionTarget] = useState<MapEntity | null>(null);
  const [dialogue, setDialogue] = useState<{title: string, text: string, choices?: string[]} | null>(null);
  const [flashOpacity, setFlashOpacity] = useState(0); // Teleport effect
  const [loopMessage, setLoopMessage] = useState<string | null>(null); // Feedback for infinite loop

  // --- INITIALIZATION ---
  const handleReimuEncounter = useCallback(() => {
     setDialogue({
         title: "Greedy Reimu (Mirror)",
         text: "Hold it right there! You didn't think you could enter the Inner Sanctum without paying the entry fee, did you? Look at all this money! It's MINE!"
     });
  }, []);

  // Load Map Logic when flags change
  useEffect(() => {
    const data = getStage1Data(
        flags, 
        inventory,
        handleReimuEncounter
    );
    setMapData(data);
    
    // Set spawn only on first load
    if (playerPos.x === 0 && playerPos.y === 0) {
        setPlayerPos(data.spawnPoint);
    }
  }, [flags, inventory, handleReimuEncounter]); 

  // --- INPUT & GAME LOOP ---
  const keysRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        keysRef.current[e.key] = true;
        
        // Lens Toggle
        if (e.code === 'Space' && !dialogue) {
            setWorldType(prev => prev === WorldType.REALITY ? WorldType.INNER_WORLD : WorldType.REALITY);
        }
        
        // Interaction
        if ((e.key === 'z' || e.key === 'Enter') && !dialogue && interactionTarget) {
            handleInteraction(interactionTarget);
        }
        
        // Close Dialogue
        if ((e.key === 'z' || e.key === 'Enter') && dialogue) {
            if (dialogue.title.includes("Reimu")) {
                const reimu = scenarioEnemies.find(e => e.name.includes('Reimu'));
                if (reimu) onEncounter(reimu);
            } else {
                setDialogue(null);
            }
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // GAME LOOP
    const loop = setInterval(() => {
        if (!mapData || dialogue) return;

        // 0. FX Decay
        if (flashOpacity > 0) setFlashOpacity(prev => Math.max(0, prev - 0.1));
        if (loopMessage) {
             // Handled by CSS animation usually, but we can clear it if needed
             // For now we rely on the component redraw
        }

        // 1. Sanity Drain
        if (worldType === WorldType.INNER_WORLD) {
            setSanity(prev => Math.max(0, prev - 0.1));
             if (sanity <= 0) {
                 setWorldType(WorldType.REALITY);
                 setDialogue({ title: "Sanity Depleted", text: "The chaotic waves of the Inner World are too strong. You are forced back to reality." });
             }
        } else {
            setSanity(prev => Math.min(100, prev + 0.3));
        }

        // 2. Movement
        let dx = 0;
        let dy = 0;
        const speed = 0.15; // Slightly faster for better feel

        if (keysRef.current['ArrowUp'] || keysRef.current['w']) dy = -speed;
        if (keysRef.current['ArrowDown'] || keysRef.current['s']) dy = speed;
        if (keysRef.current['ArrowLeft'] || keysRef.current['a']) { dx = -speed; setDirection(-1); }
        if (keysRef.current['ArrowRight'] || keysRef.current['d']) { dx = speed; setDirection(1); }

        if (dx !== 0 || dy !== 0) {
            setIsWalking(true);
            const nextX = playerPos.x + dx;
            const nextY = playerPos.y + dy;

            // Collision Check (Hitbox based)
            if (isWalkable(nextX, nextY, mapData, worldType)) {
                setPlayerPos({ x: nextX, y: nextY });
                checkTriggers(nextX, nextY, mapData);
            } else if (isWalkable(nextX, playerPos.y, mapData, worldType)) {
                // Sliding along walls (X only)
                setPlayerPos({ x: nextX, y: playerPos.y });
                checkTriggers(nextX, playerPos.y, mapData);
            } else if (isWalkable(playerPos.x, nextY, mapData, worldType)) {
                // Sliding along walls (Y only)
                setPlayerPos({ x: playerPos.x, y: nextY });
                checkTriggers(playerPos.x, nextY, mapData);
            }
        } else {
            setIsWalking(false);
        }

        // 3. Target Finding
        updateInteractionTarget(playerPos, mapData, worldType);

    }, 16);

    return () => {
        clearInterval(loop);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mapData, playerPos, worldType, dialogue, interactionTarget, sanity, flashOpacity, loopMessage]);

  // --- LOGIC HELPERS ---

  const isWalkable = (x: number, y: number, data: MapData, world: WorldType) => {
      // Bounds
      if (x < 0 || x >= data.width || y < 0 || y >= data.height) return false;

      // Hitbox Size
      const hitBoxSize = 0.3; 
      
      const points = [
          { px: x - hitBoxSize, py: y - hitBoxSize },
          { px: x + hitBoxSize, py: y - hitBoxSize },
          { px: x - hitBoxSize, py: y + hitBoxSize },
          { px: x + hitBoxSize, py: y + hitBoxSize }
      ];

      for (const p of points) {
          const tileX = Math.floor(p.px);
          const tileY = Math.floor(p.py);
          const tile = data.tiles[tileY]?.[tileX];
          
          if (tile === TileType.WALL || tile === TileType.VOID || tile === TileType.LOCKED_DOOR || tile === TileType.PILLAR) return false;
      }

      // Entity Collision
      for (const ent of data.entities) {
          if (ent.isSolid && (ent.visibleIn === 'BOTH' || ent.visibleIn === world)) {
              if (ent.hideFlag && flags.has(ent.hideFlag)) continue;
              if (ent.reqFlag && !flags.has(ent.reqFlag)) continue;

              const dist = Math.sqrt(Math.pow(x - ent.x, 2) + Math.pow(y - ent.y, 2));
              if (dist < 0.6) return false; 
          }
      }
      return true;
  };

  const checkTriggers = (x: number, y: number, data: MapData) => {
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      const key = `${tileX},${tileY}`;
      const trigger = data.triggers[key];
      
      if (trigger) {
          // Check Condition (Crucial for breaking loops)
          if (trigger.condition && !trigger.condition(flags)) return;

          if (trigger.type === 'TELEPORT' && trigger.targetX !== undefined) {
              // Preserve decimal offset for smooth visual transition
              const offsetX = x - tileX;
              const offsetY = y - tileY;
              
              setPlayerPos({ 
                  x: trigger.targetX + offsetX, 
                  y: (trigger.targetY || tileY) + offsetY 
              });
              
              if (trigger.flashEffect) setFlashOpacity(1);
              
              // Show Feedback
              setLoopMessage("∞ ETERNITY LOOP DETECTED ∞");
              setTimeout(() => setLoopMessage(null), 2000);
          }
      }
  };

  const updateInteractionTarget = (pos: {x:number, y:number}, data: MapData, world: WorldType) => {
      let nearest: MapEntity | null = null;
      let minDst = 1.0;
      for (const ent of data.entities) {
          if (ent.visibleIn !== 'BOTH' && ent.visibleIn !== world) continue;
          if (ent.hideFlag && flags.has(ent.hideFlag)) continue;
          if (ent.reqFlag && !flags.has(ent.reqFlag)) continue;
          
          const dist = Math.sqrt(Math.pow(pos.x - ent.x, 2) + Math.pow(pos.y - ent.y, 2));
          if (dist < minDst) {
              minDst = dist;
              nearest = ent;
          }
      }
      setInteractionTarget(nearest);
  };

  const handleInteraction = (entity: MapEntity) => {
      const helpers = {
          setFlag: (f: string) => setFlags(prev => new Set(prev).add(f)),
          hasFlag: (f: string) => flags.has(f),
          addItem: (id: string, name: string) => {
              setInventory(prev => new Set(prev).add(name));
              setDialogue({ title: "Item Get!", text: `You obtained: ${name}` });
          },
          hasItem: (id: string) => inventory.has(id),
          worldType
      };

      if (entity.id === 'puzzle_painting') {
          if (worldType === WorldType.REALITY) {
              setDialogue({ title: "Painting", text: "A painting of 'Thirty-six Views of Mount Fuji'. The eyes seem to follow you." });
          } else {
              setDialogue({ title: "Odd Painting", text: "This painting has turned into a 'Hakurei Shrine Worship' poster. You tear it down in disgust." });
              setFlags(prev => new Set(prev).add('PAINTING_TORN'));
          }
      } 
      else if (entity.onInteract) {
          entity.onInteract(helpers);
      }
  };

  // --- CAMERA ---
  const getCameraOffset = () => {
      if (!mapData) return { x: 0, y: 0 };
      const cx = playerPos.x * TILE_SIZE - window.innerWidth / 2;
      const cy = playerPos.y * TILE_SIZE - window.innerHeight / 2;
      const maxW = mapData.width * TILE_SIZE - window.innerWidth;
      const maxH = mapData.height * TILE_SIZE - window.innerHeight;
      return {
          x: -Math.max(0, Math.min(cx, maxW)),
          y: -Math.max(0, Math.min(cy, maxH))
      };
  };
  const camera = getCameraOffset();

  if (!mapData) return <div>Loading...</div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-serif">
        
        {/* WORLD RENDERER */}
        <div 
            className="will-change-transform"
            style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0)` }}
        >
            <Stage1Eientei mapData={mapData} worldType={worldType} />

            {/* Player */}
            <div 
                className="absolute z-30 transition-none"
                style={{
                    left: (playerPos.x * TILE_SIZE) - (TILE_SIZE/2),
                    top: (playerPos.y * TILE_SIZE) - (TILE_SIZE),
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                }}
            >
                {character.pixelSpriteUrl ? (
                    <img 
                        src={isWalking ? character.pixelSpriteUrlWalk : character.pixelSpriteUrl} 
                        className="w-full h-full object-contain drop-shadow-lg"
                        style={{ transform: `scaleX(${direction})` }}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-end">
                        <div className="w-10 h-16 bg-pink-500 rounded-t-lg border-2 border-white"></div>
                    </div>
                )}
            </div>
        </div>

        {/* UI HUD */}
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
            <h1 className="text-xl text-white bg-black/60 px-4 py-2 border-l-4 border-blue-500">
                Stage 1: Eientei
            </h1>
            
            <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-r-lg">
                <div className={`text-2xl ${worldType === 'INNER_WORLD' ? 'text-red-500 animate-pulse' : 'text-blue-200'}`}>
                    {worldType === 'INNER_WORLD' ? '👁️' : '🧿'}
                </div>
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-300 ${sanity < 30 ? 'bg-red-600' : 'bg-blue-400'}`}
                        style={{ width: `${sanity}%` }}
                    />
                </div>
            </div>
            
            <div className="text-xs text-gray-400 mt-1 font-mono">
                [SPACE] Lens: {worldType}
            </div>
        </div>

        {/* LOOP NOTIFICATION */}
        {loopMessage && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-pulse">
                <div className="bg-red-900/80 border-y-2 border-[#FFD700] text-[#FFD700] px-8 py-2 font-bold tracking-[0.5em] shadow-[0_0_20px_red]">
                    {loopMessage}
                </div>
            </div>
        )}

        {/* OBJECTIVE HUD */}
        <div className="absolute top-4 right-4 z-50">
            <div className="bg-black/80 border border-[#FFD700] p-3 rounded text-white min-w-[200px]">
                <h3 className="text-[#FFD700] text-xs font-bold uppercase tracking-widest mb-1 border-b border-gray-700 pb-1">Current Objective</h3>
                <p className="text-sm font-serif italic">{mapData.objectiveText}</p>
                {inventory.size > 0 && (
                     <div className="mt-2 pt-2 border-t border-gray-700">
                         <div className="text-xs text-gray-500">Key Items:</div>
                         <div className="flex gap-1 flex-wrap mt-1">
                             {Array.from(inventory).map((item, i) => (
                                 <span key={i} className="text-xs bg-blue-900/50 px-1 border border-blue-500 rounded">{item.split(':')[0]}</span>
                             ))}
                         </div>
                     </div>
                )}
            </div>
        </div>

        {/* INTERACT PROMPT */}
        {interactionTarget && !dialogue && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                <div className="bg-white text-black px-6 py-2 font-bold rounded-full shadow-[0_0_20px_white] flex items-center gap-2">
                   <span>⚡</span> Z / ENTER
                </div>
            </div>
        )}

        {/* DIALOGUE BOX */}
        {dialogue && (
            <div className="absolute inset-x-0 bottom-0 min-h-[250px] bg-gradient-to-t from-black via-black/95 to-transparent z-[60] flex flex-col items-center justify-end pb-10">
                <div className="w-full max-w-4xl bg-[#1a0505] border-t-2 border-[#FFD700] p-6 shadow-2xl animate-slide-up flex gap-6">
                    <div className="w-32 h-32 bg-black border border-white shrink-0 overflow-hidden relative">
                         <img src={character.portraitUrl} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col">
                        <h3 className="text-[#FFD700] text-lg mb-2 font-bold tracking-wider">{dialogue.title}</h3>
                        <p className="text-white text-xl leading-relaxed font-serif">{dialogue.text}</p>
                        
                        <div className="mt-auto flex justify-end pt-4">
                             <div className="text-gray-400 text-sm animate-pulse">[Press Z to Continue]</div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TELEPORT FLASH EFFECT */}
        <div 
            className="absolute inset-0 bg-white pointer-events-none z-[100]"
            style={{ opacity: flashOpacity }}
        />

        {/* FULL SCREEN LENS EFFECT */}
        <div className={`absolute inset-0 pointer-events-none transition-all duration-700 z-40
            ${worldType === 'INNER_WORLD' 
                ? 'shadow-[inset_0_0_100px_rgba(255,0,0,0.5)] backdrop-contrast-125 backdrop-hue-rotate-15' 
                : 'shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] backdrop-brightness-75'
            }
        `} />
        
        {/* NOISE EFFECT FOR INNER WORLD */}
        {worldType === 'INNER_WORLD' && (
             <div className="absolute inset-0 z-30 pointer-events-none opacity-10 mix-blend-overlay" style={{backgroundImage: 'url(https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif)', backgroundSize: 'cover'}}></div>
        )}
    </div>
  );
};

export default Exploration;
