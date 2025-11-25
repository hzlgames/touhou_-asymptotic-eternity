
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Character, CharacterId, Enemy, MapData, MapEntity, TileType, WorldType, SaveData } from '../types';
import Stage1Eientei, { getStage1Data, TILE_SIZE } from './stages/Stage1Eientei';
import Stage1Bamboo, { getStage1BambooData } from './stages/Stage1Bamboo';

interface ExplorationProps {
  character: Character;
  scenarioEnemies: Enemy[];
  onEncounter: (enemy: Enemy, snapshot: SaveData) => void;
  onSave: (data: SaveData) => void;
  onQuit: () => void;
  backgroundUrl?: string;
  propSprites: Record<string, string>;
  initialState?: SaveData;
}

// Movement configuration
const TILES_PER_SECOND = 6; // Speed in tiles per second

const Exploration: React.FC<ExplorationProps> = ({ character, scenarioEnemies, onEncounter, onSave, onQuit, propSprites, initialState }) => {
  // --- STATE ---
  const [worldType, setWorldType] = useState<WorldType>(initialState?.worldType || WorldType.REALITY);
  const [sanity, setSanity] = useState(initialState?.sanity ?? 100);
  const [flags, setFlags] = useState<Set<string>>(initialState ? new Set(initialState.flags) : new Set());
  const [inventory, setInventory] = useState<Set<string>>(initialState ? new Set(initialState.inventory) : new Set());
  
  // Position State
  const [playerGridPos, setPlayerGridPos] = useState(initialState?.playerGridPos || { x: 0, y: 0 });
  const [mapData, setMapData] = useState<MapData | null>(null);
  
  // Visual Interpolation State
  // We track the visual position explicitly for the camera to follow
  const [visualPos, setVisualPos] = useState({ x: 0, y: 0 });

  // Movement Logic State
  const [isMoving, setIsMoving] = useState(false);
  const [targetGridPos, setTargetGridPos] = useState<{x:number, y:number} | null>(null);
  const [moveProgress, setMoveProgress] = useState(0); // 0.0 to 1.0

  // Animation State
  const [direction, setDirection] = useState(1); // 1 = Right, -1 = Left (Flipped)
  const [moveDir, setMoveDir] = useState<'UP'|'DOWN'|'SIDE'>('DOWN'); 
  const [animFrame, setAnimFrame] = useState(0); // 0 = Idle, 1/2 = Walk

  // UI State
  const [interactionTarget, setInteractionTarget] = useState<MapEntity | null>(null);
  const [dialogue, setDialogue] = useState<{title: string, text: string, choices?: string[]} | null>(null);
  const [flashOpacity, setFlashOpacity] = useState(0); 
  const [loopMessage, setLoopMessage] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [encounterTriggered, setEncounterTriggered] = useState(false);

  // --- REFS ---
  // Refs are used to access latest state inside the RequestAnimationFrame loop without re-binding
  const stateRef = useRef({
      playerGridPos,
      targetGridPos,
      moveProgress,
      isMoving,
      mapData,
      worldType,
      dialogue,
      isPaused,
      encounterTriggered,
      devMode,
      sanity,
      flashOpacity,
      lastFrameTime: 0,
      animTimer: 0
  });

  // Update refs when state changes
  useEffect(() => {
      stateRef.current.playerGridPos = playerGridPos;
      stateRef.current.targetGridPos = targetGridPos;
      stateRef.current.moveProgress = moveProgress;
      stateRef.current.isMoving = isMoving;
      stateRef.current.mapData = mapData;
      stateRef.current.worldType = worldType;
      stateRef.current.dialogue = dialogue;
      stateRef.current.isPaused = isPaused;
      stateRef.current.encounterTriggered = encounterTriggered;
      stateRef.current.devMode = devMode;
      stateRef.current.sanity = sanity;
      stateRef.current.flashOpacity = flashOpacity;
  }, [playerGridPos, targetGridPos, moveProgress, isMoving, mapData, worldType, dialogue, isPaused, encounterTriggered, devMode, sanity, flashOpacity]);

  const keysRef = useRef<Record<string, boolean>>({});

  // --- INITIALIZATION ---

  const handleReimuEncounter = useCallback(() => {
     setDialogue({
         title: "Administrator Reimu",
         text: "Unregistered Entity 'Kaguya Houraisan'. Your 'Eternity' parameter violates the static memory allocation of this sector. Executing forced deletion..."
     });
  }, []);

  const handleMarisaEncounter = useCallback(() => {
    setDialogue({
        title: "Depressed Marisa",
        text: "Oh... it's you, Mokou. Are you here to burn the forest too? Go ahead. Magic is just... false data."
    });
 }, []);

  const loadMap = useCallback(() => {
      if (character.id === CharacterId.KAGUYA) {
        return getStage1Data(flags, inventory, handleReimuEncounter, worldType);
      } else {
        return getStage1BambooData(flags, inventory, handleMarisaEncounter, worldType);
      }
  }, [flags, inventory, handleReimuEncounter, handleMarisaEncounter, worldType, character.id]);

  useEffect(() => {
    const data = loadMap();
    setMapData(data);
    if (playerGridPos.x === 0 && playerGridPos.y === 0 && !initialState) {
        setPlayerGridPos(data.spawnPoint);
        setVisualPos({ x: data.spawnPoint.x * TILE_SIZE, y: data.spawnPoint.y * TILE_SIZE });
    } else if (initialState) {
        setVisualPos({ x: initialState.playerGridPos.x * TILE_SIZE, y: initialState.playerGridPos.y * TILE_SIZE });
    }
  }, [loadMap]);

  // --- INPUT HANDLERS ---

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          keysRef.current[e.key] = true;

          // Global Toggles
          if (e.key === 'Tab') {
              e.preventDefault(); e.stopPropagation();
              if (showItemMenu) setShowItemMenu(false);
              else setIsPaused(prev => !prev);
              return;
          }

          if (isPaused) return;
          if (e.key === 'F9') setDevMode(prev => !prev);
          
          if ((e.code === 'Space' || e.key === ' ') && !dialogue) {
              if (inventory.has('Obscure Lens')) {
                  setWorldType(prev => prev === WorldType.REALITY ? WorldType.INNER_WORLD : WorldType.REALITY);
              } else {
                  setDialogue({ title: "System Restriction", text: "You sense a hidden layer to reality, but your naked eyes cannot perceive the 'Inner World'. You need a catalyst." });
              }
          }
          
          if ((e.key === 'z' || e.key === 'Enter')) {
               if (dialogue) handlersRef.current.handleDialogueAdvance();
               else if (interactionTarget && !targetGridPos) handlersRef.current.handleInteraction(interactionTarget);
          }
      };

      const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [isPaused, showItemMenu, dialogue, inventory, interactionTarget, targetGridPos]);

  // Stable Handlers for Input
  const handleDialogueAdvance = () => {
    if (!dialogue) return;
    let isBossTrigger = false;
    const isReimu = dialogue.title.includes("Reimu");
    const isMarisa = dialogue.title.includes("Marisa");

    if (isReimu || isMarisa) {
        const enemyName = isReimu ? 'Reimu' : 'Marisa';
        const enemy = scenarioEnemies.find(e => e.name.includes(enemyName));
        if (enemy) {
            isBossTrigger = true;
            if (!encounterTriggered) {
                setEncounterTriggered(true);
                setDialogue(null);
                onEncounter(enemy, createSnapshot());
            }
        }
    } 
    if (!isBossTrigger) setDialogue(null);
  };

  const handleInteraction = (entity: MapEntity) => {
      const helpers = {
          setFlag: (f: string) => setFlags(prev => new Set(prev).add(f)),
          removeFlag: (f: string) => setFlags(prev => { const next = new Set(prev); next.delete(f); return next; }),
          hasFlag: (f: string) => flags.has(f),
          addItem: (id: string, name: string) => { setInventory(prev => new Set(prev).add(name)); setDialogue({ title: "Item Get!", text: `You obtained: ${name}` }); },
          hasItem: (id: string) => inventory.has(id),
          worldType
      };
      if (entity.onInteract) entity.onInteract(helpers);
  };

  const createSnapshot = (): SaveData => ({
      characterId: character.id,
      playerGridPos,
      worldType,
      sanity,
      inventory: Array.from(inventory),
      flags: Array.from(flags),
      timestamp: Date.now()
  });

  const handlersRef = useRef({ handleDialogueAdvance, handleInteraction });
  useEffect(() => { handlersRef.current = { handleDialogueAdvance, handleInteraction }; });

  // --- GAME LOOP (RequestAnimationFrame) ---

  const getMoveInput = useCallback(() => {
      const k = keysRef.current;
      if (k['ArrowUp'] || k['w']) return { dx: 0, dy: -1, dir: 'UP' as const };
      if (k['ArrowDown'] || k['s']) return { dx: 0, dy: 1, dir: 'DOWN' as const };
      if (k['ArrowLeft'] || k['a']) return { dx: -1, dy: 0, dir: 'SIDE' as const, facing: -1 };
      if (k['ArrowRight'] || k['d']) return { dx: 1, dy: 0, dir: 'SIDE' as const, facing: 1 };
      return null;
  }, []);

  const checkTriggers = (x: number, y: number, data: MapData) => {
      const key = `${x},${y}`;
      const trigger = data.triggers[key];
      if (trigger) {
          if (trigger.condition && !trigger.condition(flags)) return;
          if (trigger.type === 'TELEPORT' && trigger.targetX !== undefined) {
              setPlayerGridPos({ x: trigger.targetX!, y: trigger.targetY || y });
              setTargetGridPos(null);
              setMoveProgress(0);
              setVisualPos({ x: trigger.targetX! * TILE_SIZE, y: (trigger.targetY || y) * TILE_SIZE });
              if (trigger.flashEffect) setFlashOpacity(1);
              if (trigger.message) {
                  setLoopMessage(trigger.message);
                  setTimeout(() => setLoopMessage(null), 3000);
              }
          }
      }
  };

  const isWalkable = (x: number, y: number, data: MapData, world: WorldType) => {
      if (x < 0 || x >= data.width || y < 0 || y >= data.height) return false;
      if (devMode) return true;
      const tile = data.tiles[y]?.[x];
      const blockers = [TileType.WALL, TileType.VOID, TileType.LOCKED_DOOR, TileType.PILLAR, TileType.BOOKSHELF, TileType.FURNACE];
      if (tile === TileType.WATER) return false;
      if (tile === TileType.SECRET_DOOR) return true;
      if (tile === TileType.PATH) return true; 
      if (blockers.includes(tile)) return false;

      for (const ent of data.entities) {
          if (ent.isSolid && (ent.visibleIn === 'BOTH' || ent.visibleIn === world)) {
              if (ent.hideFlag && flags.has(ent.hideFlag)) continue;
              if (ent.reqFlag && !flags.has(ent.reqFlag)) continue;
              if (ent.x === x && ent.y === y) return false;
          }
      }
      return true;
  };

  // MAIN LOOP
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
        const dt = time - lastTime; // Delta time in ms
        lastTime = time;

        const s = stateRef.current;
        
        // 1. Skip logic if paused/dialogue
        if (!s.mapData || s.dialogue || s.encounterTriggered || s.isPaused) {
            animationFrameId = requestAnimationFrame(loop);
            return;
        }

        // 2. Logic Updates (Sanity, Flash)
        if (s.flashOpacity > 0) setFlashOpacity(prev => Math.max(0, prev - 0.05));
        
        if (s.worldType === WorldType.INNER_WORLD && !s.devMode) {
             // Slower drain for gameplay balance
             if (Math.random() > 0.9) setSanity(prev => Math.max(0, prev - 0.1));
             if (s.sanity <= 0) {
                 setWorldType(WorldType.REALITY);
                 setDialogue({ title: "Sanity Depleted", text: "Forced back to reality." });
             }
        } else {
             setSanity(prev => Math.min(100, prev + 0.1));
        }

        // 3. Movement Logic
        let currentVisualX = 0;
        let currentVisualY = 0;

        if (s.targetGridPos) {
            // MOVING
            setIsMoving(true);
            
            // Calculate distance to move this frame
            const speed = s.devMode ? TILES_PER_SECOND * 3 : TILES_PER_SECOND;
            const step = (speed * dt) / 1000; // progress amount (0.0 to 1.0 based)
            
            const newProgress = s.moveProgress + step;

            if (newProgress >= 1.0) {
                // ARRIVED
                const finalPos = s.targetGridPos;
                setPlayerGridPos(finalPos);
                checkTriggers(finalPos.x, finalPos.y, s.mapData);

                // Continuous Movement Check
                const input = getMoveInput();
                if (input) {
                    const nextX = finalPos.x + input.dx;
                    const nextY = finalPos.y + input.dy;
                    if (isWalkable(nextX, nextY, s.mapData, s.worldType)) {
                        setTargetGridPos({ x: nextX, y: nextY });
                        setMoveProgress(0);
                        setMoveDir(input.dir);
                        if (input.facing) setDirection(input.facing);
                        
                        // Set visual pos to start of next tile for continuity
                        currentVisualX = finalPos.x * TILE_SIZE;
                        currentVisualY = finalPos.y * TILE_SIZE;
                    } else {
                        // Wall hit
                        setTargetGridPos(null);
                        setMoveProgress(0);
                        setIsMoving(false);
                        currentVisualX = finalPos.x * TILE_SIZE;
                        currentVisualY = finalPos.y * TILE_SIZE;
                    }
                } else {
                    // Stopped
                    setTargetGridPos(null);
                    setMoveProgress(0);
                    setIsMoving(false);
                    currentVisualX = finalPos.x * TILE_SIZE;
                    currentVisualY = finalPos.y * TILE_SIZE;
                }
            } else {
                // STILL MOVING (Interpolate)
                setMoveProgress(newProgress);
                
                // Lerp Math
                const startX = s.playerGridPos.x * TILE_SIZE;
                const startY = s.playerGridPos.y * TILE_SIZE;
                const endX = s.targetGridPos.x * TILE_SIZE;
                const endY = s.targetGridPos.y * TILE_SIZE;
                
                currentVisualX = startX + (endX - startX) * newProgress;
                currentVisualY = startY + (endY - startY) * newProgress;
            }
        } else {
            // STATIONARY
            const input = getMoveInput();
            if (input) {
                const nextX = s.playerGridPos.x + input.dx;
                const nextY = s.playerGridPos.y + input.dy;
                if (isWalkable(nextX, nextY, s.mapData, s.worldType)) {
                    setTargetGridPos({ x: nextX, y: nextY });
                    setMoveProgress(0);
                    setMoveDir(input.dir);
                    if (input.facing) setDirection(input.facing);
                    setIsMoving(true);
                }
            } else {
                setIsMoving(false);
            }
            
            // Snap to grid if stationary
            currentVisualX = s.playerGridPos.x * TILE_SIZE;
            currentVisualY = s.playerGridPos.y * TILE_SIZE;
        }
        
        // Update Visual Position State (This drives the camera)
        setVisualPos({ x: currentVisualX, y: currentVisualY });

        // Update Interaction Target (Nearest Entity)
        let nearest: MapEntity | null = null;
        let minDst = 1.5; 
        for (const ent of s.mapData.entities) {
            if (ent.visibleIn !== 'BOTH' && ent.visibleIn !== s.worldType) continue;
            if (ent.hideFlag && flags.has(ent.hideFlag)) continue;
            if (ent.reqFlag && !flags.has(ent.reqFlag)) continue;
            
            // Calc distance in Grid Units
            const dist = Math.sqrt(Math.pow((currentVisualX/TILE_SIZE) - ent.x, 2) + Math.pow((currentVisualY/TILE_SIZE) - ent.y, 2));
            if (dist < minDst) {
                minDst = dist;
                nearest = ent;
            }
        }
        setInteractionTarget(nearest);

        animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [getMoveInput]);

  // --- ANIMATION FRAME LOGIC ---
  useEffect(() => {
      // Logic: 
      // Idle = Frame 0.
      // Moving = Toggle Frame 1 and 2 every 300ms.
      
      if (!isMoving) {
          setAnimFrame(0);
          return;
      }

      // Initialize to frame 1 when starting movement
      setAnimFrame(prev => prev === 0 ? 1 : prev);

      const interval = setInterval(() => {
          setAnimFrame(prev => (prev === 1 ? 2 : 1));
      }, 300);

      return () => clearInterval(interval);
  }, [isMoving]);

  // --- CAMERA LOGIC ---
  // Calculates the transform required to center the camera on visualPos
  const getCameraTransform = () => {
      if (!mapData) return { x: 0, y: 0 };

      // Screen Dimensions
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      // Map Dimensions in Pixels
      const mapW = mapData.width * TILE_SIZE;
      const mapH = mapData.height * TILE_SIZE;

      // Center Point Target (The Player's Center)
      const targetX = visualPos.x + (TILE_SIZE / 2);
      const targetY = visualPos.y + (TILE_SIZE / 2);

      // Desired Camera Top-Left (Camera is essentially a window into the map)
      // CameraX = CenterScreen - PlayerX
      let camX = (screenW / 2) - targetX;
      let camY = (screenH / 2) - targetY;

      // Clamping: Ensure we don't show black void outside map
      // Max X is 0 (Left edge aligned)
      // Min X is ScreenW - MapW (Right edge aligned)
      const minX = screenW - mapW;
      const minY = screenH - mapH;

      // If map is smaller than screen, center it. Otherwise clamp.
      if (mapW < screenW) {
          camX = (screenW - mapW) / 2;
      } else {
          camX = Math.max(minX, Math.min(0, camX));
      }

      if (mapH < screenH) {
          camY = (screenH - mapH) / 2;
      } else {
          camY = Math.max(minY, Math.min(0, camY));
      }

      return { x: camX, y: camY };
  };

  const camera = getCameraTransform();

  if (!mapData) return <div>Loading...</div>;

  const renderPlayerSprite = () => {
      const isGrid = character.spriteSheetType === 'GRID_3x3';
      
      if (isGrid) {
          // Row 0: Front (Down)
          // Row 1: Side (Right) -> Flip for Left
          // Row 2: Back (Up)
          let row = 0;
          let flip = false;
          
          if (moveDir === 'UP') row = 2;
          else if (moveDir === 'DOWN') row = 0;
          else {
              row = 1;
              if (direction === -1) flip = true;
          }

          // Column Logic (Horizontal Position)
          // Index 0: Idle (0%)
          // Index 1: Walk A (50%)
          // Index 2: Walk B (100%)
          const xPos = animFrame * 50; 
          const yPos = row * 50;

          return (
              <div 
                  className={`w-full h-full drop-shadow-lg ${devMode ? 'opacity-50' : ''}`}
                  style={{
                      backgroundImage: `url(${character.pixelSpriteUrl})`,
                      backgroundSize: '300% 300%', 
                      backgroundPosition: `${xPos}% ${yPos}%`,
                      transform: flip ? 'scaleX(-1)' : 'none',
                      imageRendering: 'pixelated'
                  }}
              />
          );
      } else {
          return (
              <img 
                  src={character.pixelSpriteUrl} 
                  className={`w-full h-full object-contain drop-shadow-lg ${devMode ? 'opacity-50' : ''}`} 
                  style={{ transform: `scaleX(${direction})` }} 
                  alt="Player" 
              />
          );
      }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-serif outline-none" tabIndex={0}>
        {/* GAME WORLD CONTAINER - Hardware Accelerated */}
        <div 
            className="will-change-transform" 
            style={{ 
                transform: `translate3d(${camera.x}px, ${camera.y}px, 0)`,
                transition: 'none' // CRITICAL: Disable CSS transition for JS-driven movement
            }}
        >
            {character.id === CharacterId.KAGUYA ? (
                 <Stage1Eientei mapData={mapData} worldType={worldType} propSprites={propSprites} />
            ) : (
                 <Stage1Bamboo mapData={mapData} worldType={worldType} propSprites={propSprites} />
            )}
            
            {/* Player Render - Positioned absolutely based on visualPos */}
            <div 
                className="absolute z-30" 
                style={{ 
                    left: 0, 
                    top: 0, 
                    width: TILE_SIZE, 
                    height: TILE_SIZE,
                    transform: `translate3d(${visualPos.x}px, ${visualPos.y}px, 0)`
                }}
            >
                {renderPlayerSprite()}
            </div>
        </div>
        
        {/* --- HUD & UI LAYERS (Static Position) --- */}
        
        {/* STATUS BAR */}
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
            <h1 className="text-xl text-white bg-black/60 px-4 py-2 border-l-4 border-blue-500 font-mono">
                {character.id === CharacterId.KAGUYA ? "SECTOR 1: PROCESSING LANE" : "SECTOR 1: DECAYING FOREST"}
            </h1>
            <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-r-lg">
                <div className={`text-2xl ${worldType === 'INNER_WORLD' ? 'text-red-500 animate-pulse' : 'text-blue-200'}`}>{worldType === 'INNER_WORLD' ? '👁️' : '🧿'}</div>
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${sanity < 30 ? 'bg-red-600' : 'bg-blue-400'}`} style={{ width: `${sanity}%` }} />
                </div>
            </div>
        </div>
        
        {/* PAUSE MENU */}
        {isPaused && (
            <div className="absolute inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                {!showItemMenu ? (
                    <div className="flex flex-col gap-4 min-w-[300px]">
                        <h2 className="text-4xl text-[#FFD700] font-mono mb-8 tracking-[0.5em] text-center border-b border-gray-600 pb-4">PAUSED</h2>
                        <button onClick={() => setIsPaused(false)} className="px-8 py-3 bg-white/5 border border-white/20 text-white hover:bg-white hover:text-black font-mono transition-all">RESUME GAME</button>
                        <button onClick={() => setShowItemMenu(true)} className="px-8 py-3 bg-white/5 border border-white/20 text-white hover:bg-white hover:text-black font-mono transition-all">ITEM PROPERTIES</button>
                        <button onClick={() => { onSave(createSnapshot()); setIsPaused(false); alert("Game Saved."); }} className="px-8 py-3 bg-white/5 border border-white/20 text-green-400 hover:bg-green-500 hover:text-black font-mono transition-all">SAVE GAME</button>
                        <button onClick={onQuit} className="px-8 py-3 bg-white/5 border border-white/20 text-red-400 hover:bg-red-500 hover:text-black font-mono transition-all">RETURN TO TITLE</button>
                    </div>
                ) : (
                    <div className="bg-[#1a1a2e] border border-gray-500 p-8 max-w-2xl w-full">
                        <h3 className="text-2xl text-blue-200 mb-6 font-mono border-b border-gray-600 pb-2 flex justify-between">
                            <span>INVENTORY</span>
                            <span className="text-sm cursor-pointer hover:text-white" onClick={() => setShowItemMenu(false)}>[BACK]</span>
                        </h3>
                        {inventory.size === 0 ? (
                            <div className="text-gray-500 italic">No items collected.</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {Array.from(inventory).map(item => (
                                    <div key={item} className="flex gap-4 p-2 border border-gray-700 hover:bg-white/5">
                                        <div className="w-12 h-12 bg-black border border-gray-600 flex items-center justify-center text-2xl">📦</div>
                                        <div>
                                            <div className="font-bold text-[#FFD700]">{item}</div>
                                            <div className="text-sm text-gray-400">Key Item. Required for progression.</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* DEV OVERLAY */}
        {devMode && (
            <div className="absolute top-20 left-4 z-50 animate-pulse pointer-events-none">
                 <div className="bg-red-600/90 text-white font-mono text-xs border border-white px-2 py-1 shadow-[0_0_10px_red]">
                    [DEV MODE ACTIVE] <br/> SPEED: 300% <br/> CLIP: OFF
                 </div>
            </div>
        )}

        {loopMessage && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-pulse pointer-events-none">
                <div className="bg-red-900/80 border-y-2 border-[#FFD700] text-[#FFD700] px-8 py-2 font-bold tracking-[0.5em] shadow-[0_0_20px_red] font-mono">{loopMessage}</div>
            </div>
        )}

        {/* OBJECTIVE HUD */}
        <div className="absolute top-4 right-4 z-50 pointer-events-none">
            <div className="bg-black/80 border border-[#FFD700] p-3 rounded text-white min-w-[200px]">
                <h3 className="text-[#FFD700] text-xs font-bold uppercase tracking-widest mb-1 border-b border-gray-700 pb-1">Current Protocol</h3>
                <p className="text-sm font-mono text-green-400">{mapData.objectiveText}</p>
                {inventory.size > 0 && (
                     <div className="mt-2 pt-2 border-t border-gray-700">
                         <div className="text-xs text-gray-500">CACHE:</div>
                         <div className="flex gap-1 flex-wrap mt-1">
                             {Array.from(inventory).map((item, i) => <span key={i} className="text-xs bg-blue-900/50 px-1 border border-blue-500 rounded font-mono">{item}</span>)}
                         </div>
                     </div>
                )}
            </div>
        </div>

        {/* INTERACTION PROMPT */}
        {interactionTarget && !dialogue && !isPaused && !targetGridPos && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-none">
                <div className="bg-white text-black px-6 py-2 font-bold rounded-full shadow-[0_0_20px_white] flex items-center gap-2 cursor-pointer"><span>⚡</span> Z / ENTER</div>
            </div>
        )}

        {/* DIALOGUE BOX */}
        {dialogue && (
            <div className="absolute inset-x-0 bottom-0 min-h-[250px] bg-gradient-to-t from-black via-black/95 to-transparent z-[60] flex flex-col items-center justify-end pb-10 pointer-events-none">
                <div className="w-full max-w-4xl bg-[#1a0505] border-t-2 border-[#FFD700] p-6 shadow-2xl animate-slide-up flex gap-6 pointer-events-auto">
                    <div className="w-32 h-32 bg-black border border-white shrink-0 overflow-hidden relative">
                         <img src={character.portraitUrl} className="w-full h-full object-cover" alt="Portrait" />
                    </div>
                    <div className="flex-1 flex flex-col">
                        <h3 className="text-[#FFD700] text-lg mb-2 font-bold tracking-wider font-mono">{dialogue.title}</h3>
                        <p className="text-white text-xl leading-relaxed font-serif">{dialogue.text}</p>
                        <div className="mt-auto flex justify-end pt-4"><div className="text-gray-400 text-sm animate-pulse">[Press Z to Continue]</div></div>
                    </div>
                </div>
            </div>
        )}

        {/* FX OVERLAYS */}
        <div className="absolute inset-0 bg-white pointer-events-none z-[100] transition-opacity duration-300" style={{ opacity: flashOpacity }} />
        <div className={`absolute inset-0 pointer-events-none transition-all duration-700 z-40 ${worldType === 'INNER_WORLD' ? 'shadow-[inset_0_0_100px_rgba(255,0,0,0.5)] backdrop-contrast-125 backdrop-hue-rotate-15' : 'shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] backdrop-grayscale-[0.3]'}`} />
        {worldType === 'INNER_WORLD' && (
             <div className="absolute inset-0 z-30 pointer-events-none opacity-10 mix-blend-overlay" style={{backgroundImage: 'url(https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif)', backgroundSize: 'cover'}}></div>
        )}
    </div>
  );
};
export default Exploration;
