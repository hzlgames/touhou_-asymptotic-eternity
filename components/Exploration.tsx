
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Character, Enemy, MapData, MapEntity, TileType, WorldType } from '../types';
import Stage1Eientei, { getStage1Data, TILE_SIZE } from './stages/Stage1Eientei';

interface ExplorationProps {
  character: Character;
  scenarioEnemies: Enemy[];
  onEncounter: (enemy: Enemy) => void;
  backgroundUrl?: string;
  propSprites: Record<string, string>; // New Prop for generated assets
}

const MOVEMENT_SPEED_MS = 200; // Time to move one tile

const Exploration: React.FC<ExplorationProps> = ({ character, scenarioEnemies, onEncounter, backgroundUrl, propSprites }) => {
  // --- ENGINE STATE ---
  const [worldType, setWorldType] = useState<WorldType>(WorldType.REALITY);
  const [sanity, setSanity] = useState(100);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [inventory, setInventory] = useState<Set<string>>(new Set());
  const [mapData, setMapData] = useState<MapData | null>(null);
  
  // Physics & FX
  const [playerGridPos, setPlayerGridPos] = useState({ x: 0, y: 0 }); // Logical Grid Position
  const [isMoving, setIsMoving] = useState(false); // Lock input during movement animation
  const [direction, setDirection] = useState(1);
  const [interactionTarget, setInteractionTarget] = useState<MapEntity | null>(null);
  const [dialogue, setDialogue] = useState<{title: string, text: string, choices?: string[]} | null>(null);
  const [flashOpacity, setFlashOpacity] = useState(0); // Teleport effect
  const [loopMessage, setLoopMessage] = useState<string | null>(null); // Feedback for infinite loop

  // --- INITIALIZATION ---
  const handleReimuEncounter = useCallback(() => {
     setDialogue({
         title: "Administrator Reimu",
         text: "Unregistered Entity 'Kaguya Houraisan'. Your 'Eternity' parameter violates the static memory allocation of this sector. I don't have time for tea or duels. I have a deadline. Executing forced deletion..."
     });
  }, []);

  const loadMap = useCallback(() => {
      const data = getStage1Data(
        flags, 
        inventory,
        handleReimuEncounter,
        worldType 
    );
    setMapData(data);
    return data;
  }, [flags, inventory, handleReimuEncounter, worldType]);

  // Initial Load
  useEffect(() => {
    const data = loadMap();
    if (playerGridPos.x === 0 && playerGridPos.y === 0) {
        setPlayerGridPos(data.spawnPoint);
    }
  }, [loadMap]); // Dependency on loadMap handles re-renders on flag changes

  // --- INPUT & MOVEMENT LOGIC ---
  const keysRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        keysRef.current[e.key] = true;
        
        // Lens Toggle Logic (Requires Item)
        if (e.code === 'Space' && !dialogue) {
            if (inventory.has('Obscure Lens')) {
                setWorldType(prev => prev === WorldType.REALITY ? WorldType.INNER_WORLD : WorldType.REALITY);
            } else {
                setDialogue({
                    title: "System Restriction",
                    text: "You sense a hidden layer to reality, but your naked eyes cannot perceive the 'Inner World'. You need a catalyst."
                });
            }
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

    // GAME LOOP (Input Polling)
    const loop = setInterval(() => {
        if (!mapData || dialogue) return;

        // 0. FX Decay
        if (flashOpacity > 0) setFlashOpacity(prev => Math.max(0, prev - 0.1));

        // 1. Sanity Drain
        if (worldType === WorldType.INNER_WORLD) {
            setSanity(prev => Math.max(0, prev - 0.05)); 
             if (sanity <= 0) {
                 setWorldType(WorldType.REALITY);
                 setDialogue({ title: "Sanity Depleted", text: "The chaotic waves of the Inner World are too strong. You are forced back to reality." });
             }
        } else {
            setSanity(prev => Math.min(100, prev + 0.3));
        }

        // 2. Movement (Grid Based)
        if (!isMoving) {
            let dx = 0;
            let dy = 0;

            if (keysRef.current['ArrowUp'] || keysRef.current['w']) dy = -1;
            else if (keysRef.current['ArrowDown'] || keysRef.current['s']) dy = 1;
            else if (keysRef.current['ArrowLeft'] || keysRef.current['a']) { dx = -1; setDirection(-1); }
            else if (keysRef.current['ArrowRight'] || keysRef.current['d']) { dx = 1; setDirection(1); }

            if (dx !== 0 || dy !== 0) {
                const nextX = playerGridPos.x + dx;
                const nextY = playerGridPos.y + dy;

                if (isWalkable(nextX, nextY, mapData, worldType)) {
                    setIsMoving(true);
                    setPlayerGridPos({ x: nextX, y: nextY });
                    
                    // Trigger Logic
                    checkTriggers(nextX, nextY, mapData);

                    // Animation Lock
                    setTimeout(() => {
                        setIsMoving(false);
                    }, MOVEMENT_SPEED_MS);
                } else {
                    // Collision feedback?
                }
            }
        }

        // 3. Target Finding
        updateInteractionTarget(playerGridPos, mapData, worldType);

    }, 16);

    return () => {
        clearInterval(loop);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mapData, playerGridPos, worldType, dialogue, interactionTarget, sanity, flashOpacity, isMoving, inventory]);

  // --- LOGIC HELPERS ---

  const isWalkable = (x: number, y: number, data: MapData, world: WorldType) => {
      // Bounds
      if (x < 0 || x >= data.width || y < 0 || y >= data.height) return false;

      // Tile Checks
      const tile = data.tiles[y]?.[x];
      
      const blockers = [
          TileType.WALL, 
          TileType.VOID, 
          TileType.LOCKED_DOOR, 
          TileType.PILLAR, 
          TileType.BOOKSHELF, 
          TileType.FURNACE,
          TileType.WATER // Water is solid unless bridge
      ];

      // Special Case: Secret Door is walkable
      if (tile === TileType.SECRET_DOOR) return true;
      if (tile === TileType.PATH) return true; // Path is always walkable

      if (blockers.includes(tile)) return false;

      // Entity Collision
      for (const ent of data.entities) {
          if (ent.isSolid && (ent.visibleIn === 'BOTH' || ent.visibleIn === world)) {
              if (ent.hideFlag && flags.has(ent.hideFlag)) continue;
              if (ent.reqFlag && !flags.has(ent.reqFlag)) continue;

              // Grid exact match
              if (ent.x === x && ent.y === y) return false;
          }
      }
      return true;
  };

  const checkTriggers = (x: number, y: number, data: MapData) => {
      const key = `${x},${y}`;
      const trigger = data.triggers[key];
      
      if (trigger) {
          // Check Condition
          if (trigger.condition && !trigger.condition(flags)) return;

          if (trigger.type === 'TELEPORT' && trigger.targetX !== undefined) {
              // Delay teleport slightly to allow move animation to start/finish nicely
              setTimeout(() => {
                  setPlayerGridPos({ 
                      x: trigger.targetX!, 
                      y: trigger.targetY || y 
                  });
                  if (trigger.flashEffect) setFlashOpacity(1);
                  if (trigger.message) {
                      setLoopMessage(trigger.message);
                      setTimeout(() => setLoopMessage(null), 3000);
                  }
              }, 100); 
          }
      }
  };

  const updateInteractionTarget = (pos: {x:number, y:number}, data: MapData, world: WorldType) => {
      let nearest: MapEntity | null = null;
      let minDst = 1.5; // Slightly larger range for grid comfort
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
          removeFlag: (f: string) => setFlags(prev => {
              const next = new Set(prev);
              next.delete(f);
              return next;
          }),
          hasFlag: (f: string) => flags.has(f),
          addItem: (id: string, name: string) => {
              setInventory(prev => new Set(prev).add(name));
              setDialogue({ title: "Item Get!", text: `You obtained: ${name}` });
          },
          hasItem: (id: string) => inventory.has(id),
          worldType
      };

      if (entity.onInteract) {
          entity.onInteract(helpers);
      }
  };

  // --- CAMERA ---
  const getCameraOffset = () => {
      if (!mapData) return { x: 0, y: 0 };
      const cx = playerGridPos.x * TILE_SIZE - window.innerWidth / 2;
      const cy = playerGridPos.y * TILE_SIZE - window.innerHeight / 2;
      
      let tx = -cx;
      let ty = -cy;
      
      const minX = -(mapData.width * TILE_SIZE - window.innerWidth);
      const minY = -(mapData.height * TILE_SIZE - window.innerHeight);

      if (mapData.width * TILE_SIZE < window.innerWidth) tx = (window.innerWidth - mapData.width * TILE_SIZE) / 2;
      else tx = Math.max(minX, Math.min(0, tx));

      if (mapData.height * TILE_SIZE < window.innerHeight) ty = (window.innerHeight - mapData.height * TILE_SIZE) / 2;
      else ty = Math.max(minY, Math.min(0, ty));

      return { x: tx, y: ty };
  };
  const camera = getCameraOffset();

  if (!mapData) return <div>Loading...</div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-serif">
        
        {/* WORLD RENDERER */}
        <div 
            className="will-change-transform transition-transform duration-300 ease-out"
            style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0)` }}
        >
            <Stage1Eientei mapData={mapData} worldType={worldType} propSprites={propSprites} />

            {/* Player */}
            <div 
                className="absolute z-30"
                style={{
                    left: (playerGridPos.x * TILE_SIZE),
                    top: (playerGridPos.y * TILE_SIZE) - (TILE_SIZE * 0.5), // Offset slightly up for sprite height
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    transition: `left ${MOVEMENT_SPEED_MS}ms linear, top ${MOVEMENT_SPEED_MS}ms linear`
                }}
            >
                {character.pixelSpriteUrl ? (
                    <img 
                        src={isMoving ? character.pixelSpriteUrlWalk : character.pixelSpriteUrl} 
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
            <h1 className="text-xl text-white bg-black/60 px-4 py-2 border-l-4 border-blue-500 font-mono">
                SECTOR 1: PROCESSING LANE
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
                [SPACE] LENS: {inventory.has('Obscure Lens') ? worldType : 'MISSING'}
            </div>
        </div>

        {/* LOOP NOTIFICATION */}
        {loopMessage && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-pulse">
                <div className="bg-red-900/80 border-y-2 border-[#FFD700] text-[#FFD700] px-8 py-2 font-bold tracking-[0.5em] shadow-[0_0_20px_red] font-mono">
                    {loopMessage}
                </div>
            </div>
        )}

        {/* OBJECTIVE HUD */}
        <div className="absolute top-4 right-4 z-50">
            <div className="bg-black/80 border border-[#FFD700] p-3 rounded text-white min-w-[200px]">
                <h3 className="text-[#FFD700] text-xs font-bold uppercase tracking-widest mb-1 border-b border-gray-700 pb-1">Current Protocol</h3>
                <p className="text-sm font-mono text-green-400">{mapData.objectiveText}</p>
                {inventory.size > 0 && (
                     <div className="mt-2 pt-2 border-t border-gray-700">
                         <div className="text-xs text-gray-500">CACHE:</div>
                         <div className="flex gap-1 flex-wrap mt-1">
                             {Array.from(inventory).map((item, i) => (
                                 <span key={i} className="text-xs bg-blue-900/50 px-1 border border-blue-500 rounded font-mono">{item}</span>
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
                        <h3 className="text-[#FFD700] text-lg mb-2 font-bold tracking-wider font-mono">{dialogue.title}</h3>
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
            className="absolute inset-0 bg-white pointer-events-none z-[100] transition-opacity duration-300"
            style={{ opacity: flashOpacity }}
        />

        {/* FULL SCREEN LENS EFFECT */}
        <div className={`absolute inset-0 pointer-events-none transition-all duration-700 z-40
            ${worldType === 'INNER_WORLD' 
                ? 'shadow-[inset_0_0_100px_rgba(255,0,0,0.5)] backdrop-contrast-125 backdrop-hue-rotate-15' 
                : 'shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] backdrop-grayscale-[0.3]'
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
