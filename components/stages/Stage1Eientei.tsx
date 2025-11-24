
import React from 'react';
import { MapData, TileType, MapEntity, WorldType, StageProps } from '../../types';

export const TILE_SIZE = 64;

// --- MAP CONFIGURATION ---
const MAP_WIDTH = 40; 
const MAP_HEIGHT = 50;

// The Loop
const LOOP_TRIGGER_Y = 8;
const LOOP_RESET_Y = 18;

export const getStage1Data = (
    flags: Set<string>,
    inventory: Set<string>,
    onReimuInteract: () => void,
    worldType: WorldType // Added to dynamically change tiles (Water -> Bridge)
): MapData => {
  const tiles: number[][] = [];
  const entities: MapEntity[] = [];
  const triggers: Record<string, any> = {};

  const isReality = worldType === WorldType.REALITY;

  // -- PUZZLE STATE CHECKERS --
  const lanternsLit = flags.has('LANTERN_L') && flags.has('LANTERN_R');
  const bookBurned = flags.has('BOOK_BURNED');
  const hasKey = inventory.has('Archive Key');
  
  // Statue Rotation State (Derived from flags for persistence)
  // Format: STATUE_{ID}_ROT_{0-3}
  const getRotation = (id: string) => {
      if (flags.has(`${id}_ROT_1`)) return 1;
      if (flags.has(`${id}_ROT_2`)) return 2;
      if (flags.has(`${id}_ROT_3`)) return 3;
      return 0;
  };

  // Check if statues are correct (Up, Right, Down, Left logic for example)
  // Puzzle Solution:
  // NE Statue: Ghost looks DOWN (2)
  // NW Statue: Ghost looks RIGHT (1)
  // SE Statue: Ghost looks LEFT (3)
  // SW Statue: Ghost looks UP (0)
  const statuesCorrect = 
      getRotation('STATUE_NE') === 2 &&
      getRotation('STATUE_NW') === 1 &&
      getRotation('STATUE_SE') === 3 &&
      getRotation('STATUE_SW') === 0;

  const loopBroken = hasKey && statuesCorrect;

  // Objective Logic
  let objectiveText = "Explore the courtyard.";
  if (!lanternsLit) objectiveText = "The river of blood blocks the way. Light the lanterns in reality.";
  else if (!hasKey) objectiveText = "Search the West Archives. Burn the past to find the key.";
  else if (!statuesCorrect) objectiveText = "The East Hall Statues whisper. Match the gaze of the dead.";
  else objectiveText = "The loop is broken. Proceed North.";

  // --- 1. BUILD GEOMETRY ---
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let tile = TileType.VOID;

      // -- AREAS --

      // 1. SOUTH SPAWN & GARDEN (y: 30-49)
      if (y >= 30) {
          if (x >= 10 && x <= 30) tile = TileType.FLOOR;
          
          // The River (y: 34-36)
          if (y >= 34 && y <= 36) {
              tile = TileType.WATER; // Default solid water
              
              // BRIDGE MECHANIC:
              // If lanterns lit AND we are in Inner World, specific spots become bridges
              if (lanternsLit && !isReality) {
                  if (x === 15 || x === 25) tile = TileType.BRIDGE;
              }
          }
      }

      // 2. CENTRAL HUB (y: 20-30)
      if (y >= 20 && y < 30) {
          if (x >= 5 && x <= 35) tile = TileType.FLOOR; // Wide hub
      }

      // 3. WEST ARCHIVES (x: 2-12, y: 10-28)
      if (x >= 2 && x <= 12 && y >= 10 && y <= 28) {
          tile = TileType.FLOOR;
          if (x === 2 || x === 12 || y === 10 || y === 28) tile = TileType.WALL;
          if (x === 12 && y === 24) tile = TileType.FLOOR; // Doorway
          
          // Bookshelves
          if (tile === TileType.FLOOR && x > 3 && x < 11 && y % 3 === 0) {
              tile = TileType.BOOKSHELF;
          }
      }

      // 4. EAST STATUE HALL (x: 28-38, y: 10-28)
      if (x >= 28 && x <= 38 && y >= 10 && y <= 28) {
          tile = TileType.FLOOR;
          if (x === 28 || x === 38 || y === 10 || y === 28) tile = TileType.WALL;
          if (x === 28 && y === 24) tile = TileType.FLOOR; // Doorway
      }

      // 5. NORTH CORRIDOR & BOSS (x: 18-22, y: 0-20)
      if (x >= 18 && x <= 22 && y < 20) {
          tile = TileType.FLOOR;
          if (x === 18 || x === 22) tile = TileType.WALL; // Walls
      }

      // 6. BOSS ROOM (y: 0-5)
      if (y <= 5 && x >= 15 && x <= 25) {
           tile = TileType.FLOOR;
      }

      row.push(tile);
    }
    tiles.push(row);
  }

  // --- 2. ENTITIES & PUZZLES ---

  // === GARDEN PUZZLE ===
  // Lanterns (Reality Only interact)
  ['LANTERN_L', 'LANTERN_R'].forEach((id, idx) => {
      const lx = idx === 0 ? 14 : 26;
      entities.push({
          id, x: lx, y: 38, 
          name: 'Stone Lantern', 
          color: flags.has(id) ? '#ffaa00' : '#555', 
          interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: ({ setFlag, worldType }) => {
              if (worldType === WorldType.REALITY) {
                  if (!flags.has(id)) {
                      setFlag(id);
                      alert("You light the lantern. The flame is weak, but it casts a strange shadow.");
                  } else {
                      alert("The lantern is already lit.");
                  }
              } else {
                  alert("A spiritual flame burns here, hardening the blood nearby.");
              }
          }
      });
  });

  // === ARCHIVE PUZZLE ===
  // 1. Dusty Book (Reality, hidden in shelf)
  if (!inventory.has('Dusty Book') && !bookBurned) {
      entities.push({
          id: 'dusty_book', x: 6, y: 15, 
          name: 'Dusty Shelf', color: 'transparent', interactionType: 'ITEM', isSolid: false, visibleIn: WorldType.REALITY,
          onInteract: ({ addItem }) => {
              addItem('Dusty Book', 'Dusty Book');
              alert("You found a book covered in thick dust. It's the only one with writing.");
          }
      });
  }

  // 2. Furnace (Inner World Only)
  entities.push({
      id: 'furnace', x: 7, y: 12,
      name: 'Cursed Furnace', color: '#aa0000', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
      onInteract: ({ hasItem, setFlag, worldType, addItem }) => {
          if (worldType === WorldType.INNER_WORLD) {
              if (bookBurned) {
                   alert("The fire has died down. Ashes remain.");
              } else if (hasItem('Dusty Book')) {
                   setFlag('BOOK_BURNED');
                   alert("You throw the book into the cursed fire. It screams as it burns to ash.");
              } else {
                   alert("A hungry fire. It demands knowledge.");
              }
          } else {
              // Reality: Check Ashes
              if (bookBurned && !inventory.has('Archive Key')) {
                  addItem('Archive Key', 'Archive Key');
                  alert("You sift through the cold ashes in the real world... You found a metal key!");
              } else {
                  alert("A cold stone fireplace.");
              }
          }
      }
  });

  // === STATUE PUZZLE ===
  const statueConfig = [
      { id: 'STATUE_NW', x: 30, y: 14, correct: 1 }, // Right
      { id: 'STATUE_NE', x: 36, y: 14, correct: 2 }, // Down
      { id: 'STATUE_SW', x: 30, y: 20, correct: 0 }, // Up
      { id: 'STATUE_SE', x: 36, y: 20, correct: 3 }, // Left
  ];

  statueConfig.forEach(s => {
      const currentRot = getRotation(s.id);
      
      // Reality: The Statue Entity
      entities.push({
          id: s.id, x: s.x, y: s.y,
          name: 'Rabbit Statue', color: '#888', interactionType: 'PUZZLE', isSolid: true, visibleIn: WorldType.REALITY,
          rotation: currentRot,
          onInteract: ({ setFlag }) => {
              // Cycle Rotation 0->1->2->3->0
              const nextRot = (currentRot + 1) % 4;
              // Clear old
              // NOTE: In a real app we'd have removeFlag, here we just set new valid one and ignore old
              setFlag(`${s.id}_ROT_${nextRot}`);
              // We can't unset previous flags with current helper, so we check priority in getRotation
              // To make this work with 'setFlag' only, we rely on the implementation of getRotation checking highest or specific logic
              // A better hack for this system: we just append flags. getRotation needs to find the *latest* or we just use modulo logic on a counter if we had one.
              // Since we only have `setFlag`, let's assume we can't unset. 
              // ACTUALLY: The helper `setFlag` just adds to a Set. 
              // Workaround: We will use a unique flag for every click? No, that's memory leak.
              // Let's assume for this game jam, we just add `STATUE_NW_ROT_1`. 
              // Logic fix: We can't clear flags. So we will rely on the UI/State in Exploration to handle this or just assume the last added flag in the set logic (which Set doesn't guarantee order).
              // ALTERNATIVE: Use `inventory` or just Alert for now?
              // Let's implement a 'smart' getRotation logic: We can't.
              // OKAY, REFACTOR: `Exploration` needs to handle rotation state? 
              // No, let's just say interacting toggles a visual but for the sake of XML constraints, 
              // I will use a simple hack: We assume the user cycles correctly.
              // Wait, I can trigger a `DIALOGUE` that asks "Rotate to which direction?" 
              const dir = window.prompt("Rotate Statue? (0: Up, 1: Right, 2: Down, 3: Left)", String(nextRot));
              if (dir && ['0','1','2','3'].includes(dir)) {
                  // We need to clear old flags. Since we can't, we will use a special flag syntax that Exploration understands?
                  // Or just accept that we add all flags.
                  // Let's just use `alert` to tell the player "It is now facing X". 
                  // And check `STATUE_NW_FACING_RIGHT` etc.
                  // For this implementation, let's just make it simple: 
                  // The prompt asks for input. If input matches correct, we set `STATUE_NW_CORRECT`.
                  if (parseInt(dir) === s.correct) {
                      setFlag(`${s.id}_CORRECT`);
                      alert("Click! The statue locks into place.");
                  } else {
                      alert("The statue turns, but feels loose.");
                  }
              }
          }
      });

      // Inner World: The Ghost Hint
      entities.push({
          id: `ghost_${s.id}`, x: s.x, y: s.y,
          name: 'Weeping Ghost', color: '#00ffff', interactionType: 'DIALOGUE', isSolid: true, visibleIn: WorldType.INNER_WORLD,
          rotation: s.correct, // The ghost faces the correct way
          onInteract: () => alert("The ghost is staring intensely in a specific direction...")
      });
  });

  // Override `statuesCorrect` for the hack above
  const realStatuesCorrect = 
      flags.has('STATUE_NW_CORRECT') && 
      flags.has('STATUE_NE_CORRECT') &&
      flags.has('STATUE_SW_CORRECT') &&
      flags.has('STATUE_SE_CORRECT');

  // === LOOP LOGIC ===
  if (!hasKey || !realStatuesCorrect) {
      // Loop Trigger at North Corridor
      for (let x = 18; x <= 22; x++) {
          triggers[`${x},${LOOP_TRIGGER_Y}`] = {
              type: 'TELEPORT', targetX: x, targetY: LOOP_RESET_Y, flashEffect: true,
              message: "You are lost in the infinite corridor. Solve the mysteries first."
          };
      }
  }

  // === BOSS ===
  entities.push({
      id: 'boss', x: 20, y: 3, 
      name: 'Greedy Reimu', color: 'red', interactionType: 'BATTLE', isSolid: true, visibleIn: 'BOTH',
      onInteract: onReimuInteract
  });

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    entities,
    triggers,
    spawnPoint: { x: 20, y: 48 },
    objectiveText
  };
};

// --- VISUAL COMPONENT ---
const Stage1Eientei: React.FC<StageProps> = ({ mapData, worldType }) => {
  const isReality = worldType === WorldType.REALITY;

  const renderTile = (type: number, x: number, y: number) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: x * TILE_SIZE,
        top: y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
    };

    // --- WATER / BLOOD ---
    if (type === TileType.WATER) {
        return (
            <div key={`${x}-${y}`} style={style} className={`transition-colors duration-1000 ${isReality ? 'bg-blue-900/80' : 'bg-red-900 animate-pulse'}`}>
                <div className="w-full h-full opacity-50" style={{backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 2px, transparent 3px)', backgroundSize: '16px 16px'}}></div>
            </div>
        );
    }
    // --- BRIDGE ---
    if (type === TileType.BRIDGE) {
        return (
            <div key={`${x}-${y}`} style={style} className="bg-red-950 border-x-2 border-red-500 shadow-[0_0_15px_red] z-10">
                <div className="text-center text-red-500 text-xs mt-2 font-mono">BRIDGE</div>
            </div>
        );
    }

    if (type === TileType.VOID) return null;

    if (type === TileType.FLOOR) {
         return (
            <div key={`${x}-${y}`} style={style} className={`${isReality ? 'bg-[#2d241b]' : 'bg-[#aa8800]'} border-r border-b border-black/20`}></div>
         );
    }
    
    if (type === TileType.WALL) {
        return (
            <div key={`${x}-${y}`} style={style} className="bg-[#1a110d] border-b-4 border-black"></div>
        );
    }

    if (type === TileType.BOOKSHELF) {
        return (
             <div key={`${x}-${y}`} style={style} className="bg-[#3e2723] flex flex-col justify-around px-1 border-x border-black">
                 {isReality ? (
                     <>
                        <div className="h-2 bg-[#5d4037] w-full mb-1"></div>
                        <div className="h-2 bg-[#5d4037] w-3/4 mb-1"></div>
                        <div className="h-2 bg-[#5d4037] w-full"></div>
                     </>
                 ) : (
                     <div className="text-[10px] text-red-500 font-mono break-all leading-none opacity-50">
                         DIE DIE DIE
                     </div>
                 )}
             </div>
        );
    }

    return null;
  };

  const renderEntity = (entity: MapEntity) => {
      if (entity.visibleIn !== 'BOTH' && entity.visibleIn !== worldType) return null;
      
      const style: React.CSSProperties = {
          left: entity.x * TILE_SIZE,
          top: entity.y * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE,
      };

      // LANTERN
      if (entity.id.includes('LANTERN')) {
          const isLit = entity.color === '#ffaa00';
          return (
              <div key={entity.id} style={style} className="absolute z-20 flex justify-center items-end pb-2 pointer-events-none">
                  <div className={`w-8 h-12 bg-stone-700 flex flex-col items-center ${isLit ? 'shadow-[0_0_30px_orange]' : ''}`}>
                      <div className="w-10 h-2 bg-stone-800"></div>
                      <div className={`w-4 h-4 mt-2 ${isLit ? 'bg-yellow-200 animate-pulse' : 'bg-black'}`}></div>
                  </div>
              </div>
          );
      }

      // STATUE / GHOST (Rotation)
      if (entity.name.includes('Statue') || entity.name.includes('Ghost')) {
          const rotDeg = (entity.rotation || 0) * 90;
          return (
              <div key={entity.id} style={style} className="absolute z-20 flex justify-center items-center pointer-events-none">
                  <div 
                    className={`w-10 h-10 transition-transform duration-500 flex items-center justify-center
                        ${entity.name.includes('Ghost') ? 'opacity-80' : 'bg-gray-400 rounded-sm'}
                    `}
                    style={{ transform: `rotate(${rotDeg}deg)` }}
                  >
                      {entity.name.includes('Ghost') ? (
                          <div className="text-3xl filter drop-shadow-[0_0_5px_cyan]">👻</div>
                      ) : (
                          <div className="text-2xl">🐰</div>
                      )}
                      {/* Direction Indicator */}
                      <div className="absolute -top-4 text-xs font-bold text-white bg-black/50 px-1">
                           {['UP','RIGHT','DOWN','LEFT'][entity.rotation || 0]}
                      </div>
                  </div>
              </div>
          );
      }
      
      // Default
      return (
          <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none text-2xl">
              {entity.interactionType === 'ITEM' ? '📦' : 
               entity.interactionType === 'BATTLE' ? '👹' : 
               entity.id === 'furnace' ? '🔥' : '❓'}
          </div>
      );
  };

  return (
    <div className="relative shadow-2xl" style={{ width: mapData.width * TILE_SIZE, height: mapData.height * TILE_SIZE }}>
        {mapData.tiles.map((row, y) => row.map((type, x) => renderTile(type, x, y)))}
        {mapData.entities.map(renderEntity)}
        
        {/* Overlay Effects */}
        <div className={`absolute inset-0 pointer-events-none mix-blend-overlay transition-colors duration-1000 ${isReality ? 'bg-blue-900/10' : 'bg-red-900/20'}`}></div>
    </div>
  );
};

export default Stage1Eientei;
