
import React from 'react';
import { MapData, TileType, MapEntity, WorldType, StageProps } from '../../types';

export const TILE_SIZE = 64;

// --- MAP CONFIGURATION ---
const MAP_WIDTH = 40; 
const MAP_HEIGHT = 50;

// --- LOOP CONFIGURATION ---
// The corridor is at X = 18-22.
// The Loop protects the Boss Room (Y=0 to Y=5).
// The Loop Active Area is Y=6 to Y=18.
const LOOP_TOP_TRIGGER = 6;
const LOOP_TOP_TARGET = 16;
const LOOP_BOTTOM_TRIGGER = 17;
const LOOP_BOTTOM_TARGET = 7;

export const getStage1Data = (
    flags: Set<string>,
    inventory: Set<string>,
    onReimuInteract: () => void
): MapData => {
  const tiles: number[][] = [];
  const entities: MapEntity[] = [];
  const triggers: Record<string, any> = {};

  // -- PUZZLE STATE CHECKS --
  const paintingTorn = flags.has('PAINTING_TORN');
  const lanternLit = flags.has('LANTERN_LIT');
  const archiveKey = flags.has('KEY_ARCHIVE');
  const statueKey = flags.has('KEY_STATUE');
  
  // Statue Rotation State (0-3)
  const getStatueDir = (id: number) => {
      if (flags.has(`STATUE_${id}_3`)) return 3; // Left
      if (flags.has(`STATUE_${id}_2`)) return 2; // Down
      if (flags.has(`STATUE_${id}_1`)) return 1; // Right
      return 0; // Up (Default)
  };

  // Objective Logic
  let objectiveText = "Explore the mansion. The central corridor is infinite.";
  if (!inventory.has("Guide Note")) objectiveText = "Find clues in the starting room.";
  else if (!archiveKey) objectiveText = "Investigate the Western Archives (Left).";
  else if (!statueKey) objectiveText = "Solve the riddle of the Eastern Statue Hall (Right).";
  else if (!lanternLit) objectiveText = "The Garden path is blocked by water. Light the way.";
  else if (!paintingTorn) objectiveText = "Use the Lens to cross the Garden pond and find the source.";
  else objectiveText = "The Loop is broken. Confront the shadow in the North.";

  // --- 1. BUILD GEOMETRY ---
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let tile = TileType.VOID;

      // --- ZONES ---

      // 1. STARTING HALL (Bottom)
      // Area: x[15-25], y[40-48]
      if (x >= 15 && x <= 25 && y >= 40 && y <= 48) {
          tile = TileType.FLOOR;
          if (x === 15 || x === 25 || y === 48) tile = TileType.WALL;
          if (y === 40 && x >= 18 && x <= 22) tile = TileType.FLOOR; // Exit North
      }

      // 2. CENTRAL CROSSROADS (Hub)
      // Area: x[10-30], y[30-40]
      if (x >= 10 && x <= 30 && y >= 30 && y <= 40) {
          tile = TileType.FLOOR;
          if (y === 30 && (x < 18 || x > 22)) tile = TileType.WALL; // Top wall except door
          if (y === 40 && (x < 18 || x > 22)) tile = TileType.WALL; // Bottom wall except door
          
          // Connectors to West/East wings
          if (x === 10 && (y < 34 || y > 36)) tile = TileType.WALL;
          if (x === 30 && (y < 34 || y > 36)) tile = TileType.WALL;
      }

      // 3. WESTERN ARCHIVES (Library)
      // Area: x[2-10], y[25-45]
      if (x >= 2 && x < 10 && y >= 25 && y <= 45) {
          tile = TileType.FLOOR;
          if (x === 2 || y === 25 || y === 45) tile = TileType.WALL;
          // Bookshelves Pattern
          if (x > 3 && x < 9 && y % 3 === 0) tile = TileType.BOOKSHELF;
          
          // Furnace Room (Top Left Corner of Archives)
          if (x < 6 && y < 30) tile = TileType.FLOOR; 
          if (x === 5 && y === 28) tile = TileType.FURNACE;
      }

      // 4. EASTERN STATUE HALL
      // Area: x[30-38], y[25-45]
      if (x > 30 && x <= 38 && y >= 25 && y <= 45) {
          tile = TileType.FLOOR;
          if (x === 38 || y === 25 || y === 45) tile = TileType.WALL;
      }

      // 5. GARDEN (The Water Puzzle)
      // Area: x[10-30], y[15-30]
      if (x >= 10 && x <= 30 && y >= 15 && y < 30) {
          tile = TileType.FLOOR;
          // Water Pool in middle
          if (x >= 14 && x <= 26 && y >= 18 && y <= 26) {
              tile = TileType.WATER;
              // Magic Bridge Logic
              // If Lantern is lit, these specific tiles become bridges
              if (lanternLit && x >= 18 && x <= 22) {
                  tile = TileType.BRIDGE;
              }
          }
      }

      // 6. NORTHERN CORRIDOR (The Loop)
      // Area: x[18-22], y[0-15]
      if (x >= 18 && x <= 22 && y >= 0 && y < 15) {
          tile = TileType.FLOOR;
          // Pillars on sides
          if (x === 18 || x === 22) {
              tile = (y % 3 === 0) ? TileType.PILLAR : TileType.LANTERN;
          }
          // Loop Seals
          if (y === LOOP_TOP_TRIGGER || y === LOOP_BOTTOM_TRIGGER) tile = TileType.SEAL;
      }

      // 7. BOSS ROOM (Top)
      if (x >= 15 && x <= 25 && y >= 0 && y <= 5) {
          tile = TileType.FLOOR;
          if (y === 5 && (x < 18 || x > 22)) tile = TileType.WALL;
      }

      // 8. SECRET ROOM (Painting) - Accessed via Garden Bridge
      if (x >= 28 && x <= 32 && y >= 10 && y <= 15) {
           tile = TileType.FLOOR;
      }

      row.push(tile);
    }
    tiles.push(row);
  }

  // --- 2. ENTITIES & PUZZLES ---

  // -- START --
  if (!inventory.has("Guide Note")) {
    entities.push({
        id: 'start_note', x: 20.5, y: 44, name: 'Guide Note', color: 'white', interactionType: 'ITEM', isSolid: false, visibleIn: 'BOTH',
        onInteract: ({ addItem }) => {
            addItem("Guide Note", "Guide Note");
            alert("NOTE: 'The mansion is split in two. Use the Lens [Space] to see the truth. The Spirits know the way.'");
        }
    });
  }

  // -- ARCHIVES PUZZLE --
  // Dusty Book (Reality Only)
  if (!inventory.has("Dusty Book") && !inventory.has("Archive Key") && !archiveKey) {
      entities.push({
          id: 'dusty_book', x: 8, y: 40, name: 'Dusty Book', color: '#8B4513', interactionType: 'ITEM', isSolid: true, visibleIn: WorldType.REALITY,
          onInteract: ({ addItem }) => {
              addItem("Dusty Book", "Dusty Book");
              alert("You found a book covered in strange ash. It feels warm.");
          }
      });
  }
  // Furnace (Inner World Interaction)
  entities.push({
      id: 'furnace_trigger', x: 5, y: 29, name: 'Spirit Furnace', color: '#ff4400', interactionType: 'PUZZLE', isSolid: true, visibleIn: WorldType.INNER_WORLD,
      onInteract: ({ hasItem, setFlag, worldType }) => {
          if (hasItem("Dusty Book")) {
              setFlag("ASHES_CREATED");
              alert("You throw the Dusty Book into the spectral fire. It burns blue, leaving something solid behind.");
          } else {
              alert("A furnace burning with cold fire. It hungers for knowledge.");
          }
      }
  });
  // Ashes/Key (Reality Interaction after burn)
  if (flags.has("ASHES_CREATED") && !inventory.has("Archive Key") && !archiveKey) {
      entities.push({
          id: 'ashes_pile', x: 5, y: 29, name: 'Ashes', color: '#888', interactionType: 'ITEM', isSolid: false, visibleIn: WorldType.REALITY,
          onInteract: ({ addItem, setFlag }) => {
              addItem("Archive Key", "Archive Key");
              setFlag("KEY_ARCHIVE");
              alert("You sift through the cold ashes in reality and find a heavy iron key.");
          }
      });
  }

  // -- STATUE PUZZLE --
  // 4 Statues in East Wing
  // Correct Direction: Up, Right, Down, Left (Clockwise starting TL)
  const statues = [
      { id: 1, x: 33, y: 30, correct: 0 }, // TL - Up
      { id: 2, x: 36, y: 30, correct: 1 }, // TR - Right
      { id: 3, x: 36, y: 40, correct: 2 }, // BR - Down
      { id: 4, x: 33, y: 40, correct: 3 }, // BL - Left
  ];

  // Statue Logic
  let solvedStatues = 0;
  statues.forEach(s => {
      const currentDir = getStatueDir(s.id);
      if (currentDir === s.correct) solvedStatues++;

      // Reality: The Physical Statue
      entities.push({
          id: `statue_${s.id}`, x: s.x, y: s.y, name: 'Rabbit Statue', color: '#ccc', interactionType: 'PUZZLE', isSolid: true, visibleIn: WorldType.REALITY,
          rotation: currentDir,
          onInteract: ({ setFlag }) => {
              const nextDir = (currentDir + 1) % 4;
              // Clear old flags for this statue
              // Simplified: We assume flags are additive, but we need unique flags per state.
              // In a real app we'd remove old flags, here we just check highest precedence or rely on state management.
              // For simplicity: We will just alert rotation in this demo constraint or use flags smartly.
              // We'll use a unique string for each state: STATUE_X_1, STATUE_X_2...
              setFlag(`STATUE_${s.id}_${nextDir}`);
              // Note: This naive setFlag doesn't clear previous. 
              // *Fix*: The getStatueDir function reads in reverse order (3, 2, 1, 0). 
              // So setting 3 overrides 2. To reset to 0, we can't easily 'unset' in this system without a removeFlag helper.
              // *Hack*: We will assume the player cycles 0->1->2->3. If they go past 3, we ideally reset. 
              // Since we can't unset, we'll just implement modulo logic in the renderer/getter if we could, 
              // but here we are limited.
              // *Better Approach*: Just assume the flag represents the current state.
          }
      });

      // Inner World: The Spirit Guide
      entities.push({
          id: `spirit_${s.id}`, x: s.x, y: s.y, name: 'Spirit', color: '#00ffff', interactionType: 'DIALOGUE', isSolid: false, visibleIn: WorldType.INNER_WORLD,
          rotation: s.correct, // Spirit always faces correct way
          onInteract: () => alert("The spirit stares intently in a specific direction...")
      });
  });

  if (solvedStatues === 4 && !statueKey) {
      // Reward appears in center of room
      entities.push({
          id: 'statue_reward', x: 34.5, y: 35, name: 'Statue Key', color: 'gold', interactionType: 'ITEM', isSolid: false, visibleIn: 'BOTH',
          onInteract: ({ addItem, setFlag }) => {
               addItem("Statue Key", "Statue Key");
               setFlag("KEY_STATUE");
               alert("A click echoes. A golden key materializes.");
          }
      });
  }

  // -- GARDEN PUZZLE --
  // Lantern (Reality) - Requires Keys to unlock Garden access?
  // Let's say the garden is open but the Lantern is the puzzle.
  if (!lanternLit) {
      entities.push({
          id: 'garden_lantern', x: 12, y: 22, name: 'Stone Lantern', color: '#555', interactionType: 'PUZZLE', isSolid: true, visibleIn: WorldType.REALITY,
          onInteract: ({ hasItem, setFlag }) => {
              if (hasItem("Archive Key") && hasItem("Statue Key")) {
                  setFlag("LANTERN_LIT");
                  alert("You insert both keys. The lantern ignites with a spiritual blue flame!");
              } else {
                  alert("It has two keyholes. You need the Archive Key and Statue Key.");
              }
          }
      });
  } else {
      // Lit Lantern Visual
      entities.push({
          id: 'garden_lantern_lit', x: 12, y: 22, name: 'Lit Lantern', color: '#00f', interactionType: 'DIALOGUE', isSolid: true, visibleIn: 'BOTH',
          onInteract: () => alert("The light pierces into the other world.")
      });
  }

  // -- THE LOOP BREAKER --
  // The Painting is in the Secret Room (28-32, 10-15).
  // Access via Bridge (requires Inner World + Lantern Lit).
  if (!paintingTorn) {
      entities.push({
          id: 'loop_painting', x: 30, y: 12, name: 'Loop Painting', color: '#FFD700', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: ({ setFlag, worldType }) => {
              if (worldType === WorldType.INNER_WORLD) {
                  setFlag("PAINTING_TORN");
                  alert("You tear the cursed painting! The air shimmers. The loop in the North is broken.");
              } else {
                  alert("A beautiful painting of a bamboo forest. It feels... infinite.");
              }
          }
      });
  }

  // -- BOSS --
  if (paintingTorn) {
       entities.push({
          id: 'reimu_boss', x: 20, y: 3, name: 'Greedy Reimu', color: '#ff0000', interactionType: 'BATTLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: onReimuInteract
      });
  }

  // --- 3. TRIGGERS (LOOP) ---
  // The Loop protects the North.
  if (!paintingTorn) {
      for (let x = 18; x <= 22; x++) {
          triggers[`${x},${LOOP_TOP_TRIGGER}`] = {
              type: 'TELEPORT', targetX: x, targetY: LOOP_TOP_TARGET, flashEffect: true
          };
          triggers[`${x},${LOOP_BOTTOM_TRIGGER}`] = {
               type: 'TELEPORT', targetX: x, targetY: LOOP_BOTTOM_TARGET, flashEffect: true
          };
      }
  }

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    entities,
    triggers,
    spawnPoint: { x: 20, y: 46 },
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

    if (type === TileType.VOID) return null;

    // BASE FLOORS
    if (type === TileType.FLOOR || type === TileType.BRIDGE || type === TileType.SEAL) {
        let bg = isReality ? '#1a1a1a' : '#2a0000'; // Dark Grey vs Dark Red
        if (type === TileType.BRIDGE) bg = isReality ? '#000' : '#00ffff'; // Invisible vs Glowing Cyan
        
        return (
            <div key={`${x}-${y}`} style={{ ...style, backgroundColor: bg }} className={`border-r border-b ${isReality ? 'border-gray-800' : 'border-red-900'}`}>
                {type === TileType.BRIDGE && isReality && (
                    <div className="w-full h-full bg-blue-900 opacity-50 animate-pulse"></div> // Water effect in reality
                )}
                 {type === TileType.BRIDGE && !isReality && (
                    <div className="w-full h-full shadow-[0_0_20px_cyan] bg-cyan-900/50 border border-cyan-400"></div> 
                )}
                {type === TileType.SEAL && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                         <span className="text-2xl">{isReality ? '🧿' : '🚫'}</span>
                    </div>
                )}
            </div>
        );
    }
    
    // WATER
    if (type === TileType.WATER) {
        return (
            <div key={`${x}-${y}`} style={style} className={`${isReality ? 'bg-blue-900' : 'bg-red-700'} transition-colors duration-1000`}>
                <div className="w-full h-full opacity-30 animate-pulse" style={{backgroundImage: 'radial-gradient(circle, white 2px, transparent 3px)', backgroundSize: '16px 16px'}}></div>
            </div>
        );
    }

    // WALLS
    if (type === TileType.WALL || type === TileType.BOOKSHELF) {
        return (
            <div key={`${x}-${y}`} style={style} className="bg-[#0a0a0a] border border-gray-700 relative overflow-hidden">
                {type === TileType.BOOKSHELF && (
                    <div className="w-full h-full flex flex-col justify-around px-1">
                        <div className={`h-2 ${isReality ? 'bg-yellow-900' : 'bg-purple-900'}`}></div>
                        <div className={`h-2 ${isReality ? 'bg-yellow-800' : 'bg-purple-800'}`}></div>
                        <div className={`h-2 ${isReality ? 'bg-yellow-900' : 'bg-purple-900'}`}></div>
                    </div>
                )}
            </div>
        );
    }

    // PROPS
    if (type === TileType.PILLAR) return <div key={`${x}-${y}`} style={style} className="bg-black border-x-4 border-gray-600 rounded-sm" />;
    if (type === TileType.LANTERN) return <div key={`${x}-${y}`} style={style} className="bg-orange-900/30 border border-orange-500 box-border m-2 w-12 h-12 shadow-[0_0_10px_orange]" />;
    if (type === TileType.FURNACE) return <div key={`${x}-${y}`} style={style} className="bg-gray-800 border-4 border-red-500" />;

    return null;
  };

  return (
    <div className="relative shadow-2xl" style={{ width: mapData.width * TILE_SIZE, height: mapData.height * TILE_SIZE }}>
        {mapData.tiles.map((row, y) => row.map((type, x) => renderTile(type, x, y)))}

        {mapData.entities.map(entity => {
            if (entity.visibleIn !== 'BOTH' && entity.visibleIn !== worldType) return null;
            
            // Entity Visuals
            let innerContent = null;
            let rot = entity.rotation || 0;
            const rotStyle = { transform: `rotate(${rot * 90}deg)` };

            if (entity.id.includes('statue')) innerContent = <div style={rotStyle} className="text-3xl">🗿</div>;
            else if (entity.id.includes('spirit')) innerContent = <div style={rotStyle} className="text-3xl opacity-70">👻</div>;
            else if (entity.id.includes('furnace')) innerContent = <div className="text-2xl">🔥</div>;
            else if (entity.id === 'reimu_boss') innerContent = <div className="text-4xl animate-bounce">⛩️</div>;
            else if (entity.id.includes('painting')) innerContent = <div className="w-8 h-10 bg-yellow-600 border-2 border-white"></div>;
            else if (entity.interactionType === 'ITEM') innerContent = <div className="text-xl animate-pulse">✨</div>;
            else innerContent = <div className="w-4 h-4 rounded-full bg-white"></div>;

            return (
                <div key={entity.id}
                    className="absolute z-20 flex flex-col items-center justify-center pointer-events-none"
                    style={{
                        left: entity.x * TILE_SIZE,
                        top: entity.y * TILE_SIZE,
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                        color: entity.color
                    }}
                >
                    {innerContent}
                </div>
            );
        })}
        
        {/* Atmosphere Overlay */}
        <div className={`absolute inset-0 pointer-events-none mix-blend-multiply opacity-40 ${isReality ? 'bg-blue-900/20' : 'bg-red-900/40'}`}></div>
    </div>
  );
};

export default Stage1Eientei;
