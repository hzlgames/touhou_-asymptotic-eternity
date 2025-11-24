
import React from 'react';
import { MapData, TileType, MapEntity, WorldType, StageProps } from '../../types';

export const TILE_SIZE = 64;

// --- MAP CONSTANTS ---
// Doubled height to make the vertical loop feel longer, but kept width tighter
const MAP_WIDTH = 26; 
const MAP_HEIGHT = 40;

export const getStage1Data = (
    flags: Set<string>,
    inventory: Set<string>,
    onReimuInteract: () => void
): MapData => {
  const tiles: number[][] = [];
  const entities: MapEntity[] = [];
  const triggers: Record<string, any> = {};

  const paintingTorn = flags.has('PAINTING_TORN');
  const doorOpen = flags.has('MOON_DOOR_OPEN');

  // Objective Logic
  let objectiveText = "Investigate the corridor.";
  const shardCount = Array.from(inventory).filter(i => i.includes('Shard')).length;
  if (!inventory.has("Guide Note")) objectiveText = "Check the paper on the floor.";
  else if (shardCount < 4) objectiveText = `Find Jade Shards (${shardCount}/4). Use the Lens [SPACE].`;
  else if (!doorOpen) objectiveText = "Insert Shards into the Moon Door.";
  else objectiveText = "Enter the Courtyard.";

  // --- 1. BUILD GEOMETRY ---
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let tile = TileType.VOID;

      // GEOMETRY DEFINITIONS
      // The Loop is a rectangle. 
      // Left Hall: x=4,5,6
      // Right Hall: x=19,20,21
      // Top Hall: y=8,9,10
      // Bottom Hall: y=30,31,32
      
      const isLeftHall = x >= 4 && x <= 6 && y >= 8 && y <= 32;
      const isRightHall = x >= 19 && x <= 21 && y >= 8 && y <= 32;
      const isTopHall = y >= 8 && y <= 10 && x >= 4 && x <= 21;
      const isBottomHall = y >= 30 && y <= 32 && x >= 4 && x <= 21;

      // CORRIDOR FLOOR
      if (isLeftHall || isRightHall || isTopHall || isBottomHall) {
          tile = TileType.FLOOR;
          
          // Add Pillars for rhythm/speed sensation in vertical halls
          if ((isLeftHall || isRightHall) && y % 5 === 0 && x % 2 !== 0) {
             // Place lantern/pillar on the walls (edges of hall)
             if (x === 4 || x === 6 || x === 19 || x === 21) {
                 tile = TileType.PILLAR;
             }
          }
          // Visual Anchors for Loop (Lanterns)
          if ((y === 12 || y === 24) && (x === 5 || x === 20)) {
              tile = TileType.LANTERN;
          }
      }

      // ROOMS
      // Start Room (Bottom Center)
      if (y > 32 && y < 38 && x >= 10 && x <= 15) {
          tile = TileType.FLOOR;
      }
      
      // Shard Rooms (Corners)
      // Top Left
      if (y < 8 && y > 4 && x < 8 && x > 2) tile = TileType.FLOOR;
      // Top Right
      if (y < 8 && y > 4 && x > 17 && x < 23) tile = TileType.FLOOR;
      // Bottom Left
      if (y > 32 && y < 36 && x < 8 && x > 2) tile = TileType.FLOOR;
      // Bottom Right
      if (y > 32 && y < 36 && x > 17 && x < 23) tile = TileType.FLOOR;

      // Boss Courtyard (Top Center)
      if (y < 8 && x >= 10 && x <= 15) {
          if (y === 7) {
              tile = doorOpen ? TileType.DOOR : TileType.LOCKED_DOOR;
          } else {
              tile = TileType.FLOOR;
          }
      }

      // Secret Painting Room (Right Hall Wall)
      if (x === 22 && y === 20) {
           tile = paintingTorn ? TileType.DOOR : TileType.WALL;
      }
      if (x > 22 && x < 25 && y === 20) {
          tile = TileType.FLOOR;
      }

      row.push(tile);
    }
    tiles.push(row);
  }

  // --- 2. ENTITIES ---

  // Start Note
  if (!inventory.has("Guide Note")) {
      entities.push({
          id: 'start_note',
          x: 12.5, y: 35,
          name: 'Crumpled Paper',
          color: 'white',
          interactionType: 'ITEM',
          isSolid: false,
          visibleIn: 'BOTH',
          onInteract: ({ addItem }) => {
              addItem("Guide Note", "Guide Note");
              alert("READ ME: 'The corridor is cursed. It repeats forever. If you want to find the hidden path, you must look through the [LENS] (Spacebar). Reality is a lie.'");
          }
      });
  }

  // Puzzle Painting (Right Hall)
  if (!paintingTorn) {
      entities.push({
          id: 'puzzle_painting',
          x: 21.5, y: 20, 
          name: 'Suspicious Painting',
          color: '#FFD700',
          interactionType: 'PUZZLE',
          isSolid: true,
          visibleIn: 'BOTH',
      });
  }

  // Moon Door (Top Center)
  if (!doorOpen) {
      entities.push({
          id: 'moon_door',
          x: 12.5, y: 8,
          name: 'Moon Phase Door',
          color: '#888',
          interactionType: 'PUZZLE',
          isSolid: true,
          visibleIn: 'BOTH',
          onInteract: ({ setFlag, hasItem }) => {
              if (hasItem("Shard: Full Moon") && hasItem("Shard: Waning Moon") && hasItem("Shard: New Moon") && hasItem("Shard: Waxing Moon")) {
                  alert("The 4 Shards glow in unison. The heavy doors grind open!");
                  setFlag('MOON_DOOR_OPEN');
              } else {
                  alert("A sealed door with 4 recesses. You need 4 Jade Shards to open it.");
              }
          }
      });
  }

  // Shards (Corner Rooms)
  const shardLocs = [
      { id: 'shard_1', name: 'Shard: Full Moon', x: 5, y: 6 },
      { id: 'shard_2', name: 'Shard: Waning Moon', x: 20, y: 6 },
      { id: 'shard_3', name: 'Shard: New Moon', x: 5, y: 34 },
      { id: 'shard_4', name: 'Shard: Waxing Moon', x: 23.5, y: 20 } // Secret Room
  ];

  shardLocs.forEach(shard => {
      if (!inventory.has(shard.name)) {
          // Reality: Hidden/Invisible item
          entities.push({
              id: shard.id,
              x: shard.x,
              y: shard.y,
              name: shard.name,
              color: '#fff',
              interactionType: 'ITEM',
              isSolid: false,
              visibleIn: WorldType.REALITY,
              onInteract: ({ addItem }) => addItem(shard.id, shard.name)
          });
          // Inner: Big Visual Cue
          entities.push({
              id: `${shard.id}_hint`,
              x: shard.x,
              y: shard.y,
              name: 'Red Glint',
              color: '#ff0000',
              interactionType: 'DIALOGUE',
              isSolid: false,
              visibleIn: WorldType.INNER_WORLD,
              onInteract: () => alert("An object exists here in the other world. Switch back to Reality [SPACE] to take it.")
          });
      }
  });

  // Boss & Mirror
  if (doorOpen) {
      entities.push({
          id: 'mirror_save',
          x: 12.5, y: 5,
          name: 'Large Mirror',
          color: 'blue',
          interactionType: 'DIALOGUE',
          isSolid: true,
          visibleIn: 'BOTH',
          onInteract: () => alert("HP Restored.")
      });
      entities.push({
          id: 'reimu_boss',
          x: 12.5, y: 3,
          name: 'Greedy Reimu',
          color: '#ff0000',
          interactionType: 'BATTLE',
          isSolid: true,
          visibleIn: 'BOTH',
          onInteract: onReimuInteract
      });
  }

  // --- 3. TRIGGERS (THE INFINITE LOOP) ---
  // The corridor is longer now (Y=8 to Y=32).
  // Midpoints are roughly Y=20.
  // We want to teleport from Top(10) to Bottom(30) and vice versa, 
  // keeping X relative.
  
  // Left Hall Loop (x 4,5,6)
  // If player walks UP past Y=12 -> Teleport to Y=28
  // If player walks DOWN past Y=28 -> Teleport to Y=12
  // We place triggers at specific Y levels.
  
  const LOOP_TOP_Y = 12;
  const LOOP_BOTTOM_Y = 28;
  const LEFT_X_START = 4;
  const LEFT_X_END = 6;
  const RIGHT_X_START = 19;
  const RIGHT_X_END = 21;

  for (let x = LEFT_X_START; x <= LEFT_X_END; x++) {
      triggers[`${x},${LOOP_TOP_Y}`] = { type: 'TELEPORT', targetX: x, targetY: LOOP_BOTTOM_Y, flashEffect: true };
      triggers[`${x},${LOOP_BOTTOM_Y + 1}`] = { type: 'TELEPORT', targetX: x, targetY: LOOP_TOP_Y + 1, flashEffect: true };
  }
  for (let x = RIGHT_X_START; x <= RIGHT_X_END; x++) {
      triggers[`${x},${LOOP_TOP_Y}`] = { type: 'TELEPORT', targetX: x, targetY: LOOP_BOTTOM_Y, flashEffect: true };
      triggers[`${x},${LOOP_BOTTOM_Y + 1}`] = { type: 'TELEPORT', targetX: x, targetY: LOOP_TOP_Y + 1, flashEffect: true };
  }


  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    entities,
    triggers,
    spawnPoint: { x: 12.5, y: 35 },
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
        transition: 'filter 0.3s ease',
    };

    if (type === TileType.VOID) return null;

    // --- REALITY ---
    if (isReality) {
        if (type === TileType.FLOOR || type === TileType.LANTERN) {
            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#1e1a18] border-r border-[#2e2a25]">
                    {/* Tatami Vertical Lines */}
                    <div className="w-full h-full opacity-10" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 15px, #000 15px, #000 16px)'}}></div>
                    
                    {/* Lantern Visual */}
                    {type === TileType.LANTERN && (
                        <div className="absolute top-2 left-4 w-8 h-12 bg-orange-900/50 rounded shadow-[0_0_10px_orange] flex items-center justify-center">
                            <div className="w-4 h-8 bg-yellow-900/80 animate-pulse"></div>
                        </div>
                    )}
                    
                    {/* Dust Motes (Random static noise) */}
                    {(x+y)%5 === 0 && <div className="absolute bottom-2 right-2 w-1 h-1 bg-white/20 rounded-full"></div>}
                </div>
            );
        }
        if (type === TileType.PILLAR) {
             return (
                 <div key={`${x}-${y}`} style={style} className="bg-[#0f0a0a] shadow-lg flex items-center justify-center">
                     <div className="w-4 h-full bg-[#1a1111] border-x border-gray-800"></div>
                 </div>
             );
        }
        if (type === TileType.LOCKED_DOOR) {
            return <div key={`${x}-${y}`} style={style} className="bg-[#1a0f0f] border-4 border-gray-600 flex items-center justify-center text-gray-500 text-xs font-mono">SEALED</div>;
        }
    } 
    // --- INNER WORLD ---
    else {
        if (type === TileType.FLOOR || type === TileType.LANTERN) {
            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#4a0000] overflow-hidden">
                     <div className="absolute inset-0 border border-[#FFD700]/20"></div>
                     
                     {/* Floating Text / Glitch */}
                     {(x * y) % 7 === 0 && (
                         <div className="absolute top-0 left-0 text-[#FFD700]/40 text-[10px] transform rotate-45 select-none">欲望</div>
                     )}
                     
                     {/* Lantern becomes Eye */}
                     {type === TileType.LANTERN && (
                        <div className="absolute top-2 left-4 w-8 h-12 bg-red-900 rounded border border-[#FFD700] flex items-center justify-center animate-pulse">
                            <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        if (type === TileType.PILLAR) {
             return (
                 <div key={`${x}-${y}`} style={style} className="bg-gradient-to-b from-[#FFD700] to-[#8B4513] shadow-lg flex items-center justify-center">
                     <div className="w-2 h-full bg-black"></div>
                 </div>
             );
        }
        if (type === TileType.LOCKED_DOOR) {
            return <div key={`${x}-${y}`} style={style} className="bg-red-900 border-4 border-[#FFD700] animate-pulse"></div>;
        }
    }
    
    // Default fallback
    return <div key={`${x}-${y}`} style={style} className="bg-gray-800" />;
  };

  return (
    <div className="relative shadow-2xl" style={{ width: mapData.width * TILE_SIZE, height: mapData.height * TILE_SIZE }}>
        
        {/* BASE LAYER */}
        {mapData.tiles.map((row, y) => row.map((type, x) => renderTile(type, x, y)))}

        {/* ENTITIES */}
        {mapData.entities.map(entity => {
            if (entity.visibleIn !== 'BOTH' && entity.visibleIn !== worldType) return null;
            
            return (
                <div key={entity.id}
                    className="absolute z-20 flex flex-col items-center justify-center transition-all duration-300 pointer-events-none" // pointer-events-none ensures clicks go to map logic
                    style={{
                        left: entity.x * TILE_SIZE,
                        top: entity.y * TILE_SIZE,
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                    }}
                >
                    {entity.id === 'reimu_boss' && (
                        <div className={`relative ${!isReality ? 'invert hue-rotate-180' : ''}`}>
                             <div className="w-16 h-16 bg-red-600 rounded-full border-4 border-[#FFD700] shadow-[0_0_20px_gold] animate-bounce flex items-center justify-center text-3xl">⛩️</div>
                        </div>
                    )}

                    {entity.id === 'puzzle_painting' && (
                        <div className="w-full h-full flex items-center justify-center">
                            {isReality ? (
                                <div className="w-10 h-14 bg-blue-900 border-2 border-gray-500 relative overflow-hidden">
                                    <div className="absolute top-2 w-full h-2 bg-white/20"></div> {/* Fuji Snow */}
                                </div>
                            ) : (
                                <div className="w-12 h-16 bg-red-700 border-2 border-[#FFD700] animate-pulse flex items-center justify-center">
                                    <span className="text-[8px] text-yellow-300 font-bold">¥¥¥</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {entity.id === 'start_note' && (
                         <div className="w-6 h-8 bg-white shadow-md rotate-12 flex items-center justify-center text-[8px] text-black">
                             !!!
                         </div>
                    )}

                    {/* Shards Visuals */}
                    {entity.id.includes('shard') && !entity.id.includes('hint') && (
                        <div className="w-4 h-4 bg-cyan-300 rounded-full shadow-[0_0_10px_cyan] animate-pulse" />
                    )}

                    {/* Hint Visuals (Inner World) */}
                    {entity.id.includes('hint') && (
                        <div className="absolute -top-10 w-2 h-20 bg-gradient-to-t from-red-500 to-transparent opacity-80 animate-pulse pointer-events-none"></div>
                    )}
                </div>
            );
        })}
        
        {/* ATMOSPHERE OVERLAY */}
        {isReality ? (
             <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-60 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)]"></div>
        ) : (
             <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 bg-yellow-600"></div>
        )}
    </div>
  );
};

export default Stage1Eientei;
