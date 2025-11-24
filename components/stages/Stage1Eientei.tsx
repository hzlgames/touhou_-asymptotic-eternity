
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
  const paintingTorn = flags.has('PAINTING_TORN');
  const hasKey = inventory.has('Archive Key');
  
  // Statue Rotation Helper
  const getRotation = (id: string) => {
      if (flags.has(`${id}_ROT_1`)) return 1;
      if (flags.has(`${id}_ROT_2`)) return 2;
      if (flags.has(`${id}_ROT_3`)) return 3;
      return 0; // Default ROT_0
  };

  const statuesCorrect = 
      getRotation('STATUE_NE') === 2 &&
      getRotation('STATUE_NW') === 1 &&
      getRotation('STATUE_SE') === 3 &&
      getRotation('STATUE_SW') === 0;

  // Objective Logic
  let objectiveText = "Explore the courtyard.";
  if (!lanternsLit) objectiveText = "The river of blood blocks the way. Light the lanterns in reality.";
  else if (!hasKey) objectiveText = "Search the West Archives. Burn the past to find the key.";
  else if (!statuesCorrect) objectiveText = "The East Hall Statues whisper. Match the gaze of the dead.";
  else if (!paintingTorn) objectiveText = "The path ahead is infinite. Search for a discrepancy in the Reality paintings.";
  else objectiveText = "The loop is broken. Enter the secret passage behind the painting.";

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
              tile = TileType.WATER; 
              if (lanternsLit && !isReality && (x === 15 || x === 25)) tile = TileType.BRIDGE;
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
          if (tile === TileType.FLOOR && x > 3 && x < 11 && y % 3 === 0) tile = TileType.BOOKSHELF;
      }

      // 4. EAST STATUE HALL (x: 28-38, y: 10-28)
      if (x >= 28 && x <= 38 && y >= 10 && y <= 28) {
          tile = TileType.FLOOR;
          if (x === 28 || x === 38 || y === 10 || y === 28) tile = TileType.WALL;
          if (x === 28 && y === 24) tile = TileType.FLOOR; // Doorway
      }

      // 5. NORTH CORRIDOR & BOSS (x: 18-22, y: 0-20)
      // The "Looping" Main Path
      if (x >= 18 && x <= 22 && y < 20) {
          tile = TileType.FLOOR;
          if (x === 18 || x === 22) tile = TileType.WALL;
      }

      // 6. SECRET PATH (x: 23, y: 5-20)
      // Only accessible if painting is torn
      if (paintingTorn) {
          if (x === 23 && y >= 5 && y <= 20) {
              tile = TileType.PATH; // Visual distinction
              if (x === 23 && y === 20) tile = TileType.SECRET_DOOR;
          }
      }

      // 7. BOSS ROOM (y: 0-5)
      if (y <= 5 && x >= 15 && x <= 25) {
           tile = TileType.FLOOR;
      }

      row.push(tile);
    }
    tiles.push(row);
  }

  // --- 2. ENTITIES & PUZZLES ---

  // === GARDEN PUZZLE ===
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
                  }
              } else {
                  alert("A spiritual flame burns here, hardening the blood nearby.");
              }
          }
      });
  });

  // === ARCHIVE PUZZLE ===
  if (!inventory.has('Dusty Book') && !bookBurned) {
      entities.push({
          id: 'dusty_book', x: 6, y: 15, 
          name: 'Dusty Shelf', color: 'transparent', interactionType: 'ITEM', isSolid: false, visibleIn: WorldType.REALITY,
          onInteract: ({ addItem }) => addItem('Dusty Book', 'Dusty Book')
      });
  }

  entities.push({
      id: 'furnace', x: 7, y: 12,
      name: 'Cursed Furnace', color: '#aa0000', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
      onInteract: ({ hasItem, setFlag, worldType, addItem }) => {
          if (worldType === WorldType.INNER_WORLD) {
              if (bookBurned) alert("The fire has died down. Ashes remain.");
              else if (hasItem('Dusty Book')) {
                   setFlag('BOOK_BURNED');
                   alert("You throw the book into the cursed fire. It screams as it burns to ash.");
              } else alert("A hungry fire. It demands knowledge.");
          } else {
              if (bookBurned && !inventory.has('Archive Key')) {
                  addItem('Archive Key', 'Archive Key');
                  alert("You sift through the cold ashes in the real world... You found a metal key!");
              } else alert("A cold stone fireplace.");
          }
      }
  });

  // === STATUE PUZZLE (ROTATION LOGIC IMPROVED) ===
  const statueConfig = [
      { id: 'STATUE_NW', x: 30, y: 14, correct: 1 }, 
      { id: 'STATUE_NE', x: 36, y: 14, correct: 2 }, 
      { id: 'STATUE_SW', x: 30, y: 20, correct: 0 }, 
      { id: 'STATUE_SE', x: 36, y: 20, correct: 3 }, 
  ];

  statueConfig.forEach(s => {
      const currentRot = getRotation(s.id);
      
      // Reality: Click to Rotate
      entities.push({
          id: s.id, x: s.x, y: s.y,
          name: 'Rabbit Statue', color: '#888', interactionType: 'PUZZLE', isSolid: true, visibleIn: WorldType.REALITY,
          rotation: currentRot,
          onInteract: ({ setFlag, removeFlag }) => {
              // Calculate next rotation
              const nextRot = (currentRot + 1) % 4;
              // Remove ALL previous rotation flags for this statue
              removeFlag(`${s.id}_ROT_0`);
              removeFlag(`${s.id}_ROT_1`);
              removeFlag(`${s.id}_ROT_2`);
              removeFlag(`${s.id}_ROT_3`);
              // Set new flag
              setFlag(`${s.id}_ROT_${nextRot}`);
          }
      });

      // Inner World: Ghost Hint
      entities.push({
          id: `ghost_${s.id}`, x: s.x, y: s.y,
          name: 'Weeping Ghost', color: '#00ffff', interactionType: 'DIALOGUE', isSolid: true, visibleIn: WorldType.INNER_WORLD,
          rotation: s.correct, 
          onInteract: () => alert("The ghost stares in a fixed direction...")
      });
  });

  // === LOOP & SECRET DOOR PUZZLE ===
  
  // The Painting that hides the secret door
  if (hasKey && statuesCorrect) {
    if (!paintingTorn) {
        entities.push({
            id: 'secret_painting', x: 22, y: 20, // On the right wall of the corridor entrance
            name: 'Suspicious Painting', color: '#ff00ff', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
            onInteract: ({ worldType, setFlag }) => {
                if (worldType === WorldType.INNER_WORLD) {
                    setFlag('PAINTING_TORN');
                    alert("You tear down the Talisman Poster. A cold draft blows from the wall behind it.");
                } else {
                    alert("A painting of 'The Great Wave'. It looks slightly askew.");
                }
            }
        });
    }
  }

  // Loop Trigger Logic: Only active in the main corridor (x=18-22)
  if (!paintingTorn) {
      for (let x = 18; x <= 22; x++) {
          triggers[`${x},${LOOP_TRIGGER_Y}`] = {
              type: 'TELEPORT', targetX: x, targetY: LOOP_RESET_Y, flashEffect: true,
              message: "The corridor stretches infinitely..."
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

    if (type === TileType.WATER) {
        return (
            <div key={`${x}-${y}`} style={style} className={`transition-colors duration-1000 ${isReality ? 'bg-blue-900/80' : 'bg-red-900 animate-pulse'}`}>
                <div className="w-full h-full opacity-50" style={{backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 2px, transparent 3px)', backgroundSize: '16px 16px'}}></div>
            </div>
        );
    }
    if (type === TileType.BRIDGE) {
        return (
            <div key={`${x}-${y}`} style={style} className="bg-red-950 border-x-2 border-red-500 shadow-[0_0_15px_red] z-10">
                <div className="text-center text-red-500 text-xs mt-2 font-mono">BRIDGE</div>
            </div>
        );
    }
    if (type === TileType.SECRET_DOOR) {
        return (
            <div key={`${x}-${y}`} style={style} className="bg-[#1a0505] border-2 border-dashed border-[#FFD700] z-0 flex items-center justify-center">
                 <div className="text-xs text-[#FFD700]">SECRET</div>
            </div>
        );
    }
    if (type === TileType.PATH) {
        // The hidden corridor floor
        return (
            <div key={`${x}-${y}`} style={style} className="bg-[#1a0505] shadow-inner"></div>
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
      
      if (entity.id === 'secret_painting') {
          return (
            <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none">
                <div className={`w-12 h-16 bg-white border-4 border-yellow-600 shadow-md ${!isReality ? 'animate-pulse border-red-500' : ''}`}>
                    {!isReality ? <span className="text-red-600 text-xs font-bold p-1">SEAL</span> : <span className="text-blue-900 text-xs">ART</span>}
                </div>
            </div>
          );
      }

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
                      <div className="absolute -top-4 text-xs font-bold text-white bg-black/50 px-1">
                           {['UP','RIGHT','DOWN','LEFT'][entity.rotation || 0]}
                      </div>
                  </div>
              </div>
          );
      }
      
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
        <div className={`absolute inset-0 pointer-events-none mix-blend-overlay transition-colors duration-1000 ${isReality ? 'bg-blue-900/10' : 'bg-red-900/20'}`}></div>
    </div>
  );
};

export default Stage1Eientei;
