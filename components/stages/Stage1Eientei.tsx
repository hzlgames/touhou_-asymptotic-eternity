
import React from 'react';
import { MapData, TileType, MapEntity, WorldType, StageProps } from '../../types';

export const TILE_SIZE = 64;

// --- MAP CONSTANTS ---
// We use a vertical corridor that feels infinite.
const MAP_WIDTH = 26; 
const MAP_HEIGHT = 40;

// Loop Boundaries
const LOOP_NORTH_TRIGGER_Y = 10;
const LOOP_NORTH_TARGET_Y = 26; // Teleports DOWN to keep player away from North

const LOOP_SOUTH_TRIGGER_Y = 27;
const LOOP_SOUTH_TARGET_Y = 11; // Teleports UP to keep player in the trap

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
  let objectiveText = "The corridor repeats. Find the source.";
  const shardCount = Array.from(inventory).filter(i => i.includes('Shard')).length;
  if (!inventory.has("Guide Note")) objectiveText = "Read the crumpled note on the floor.";
  else if (!paintingTorn) objectiveText = "Use the Lens [Space] to find the 'Odd Painting'.";
  else if (shardCount < 4) objectiveText = `Loop Broken! Find Jade Shards in the corners (${shardCount}/4).`;
  else if (!doorOpen) objectiveText = "Insert Shards into the Moon Door (North).";
  else objectiveText = "Enter the Courtyard.";

  // --- 1. BUILD GEOMETRY ---
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let tile = TileType.VOID;

      // GEOMETRY DEFINITIONS
      // Left Hall: x=4-6 (Main Loop)
      // Right Hall: x=19-21 (Has Painting)
      // Top Connect: y=8-10
      // Bottom Connect: y=30-32
      
      const isLeftHall = x >= 4 && x <= 6 && y >= 8 && y <= 32;
      const isRightHall = x >= 19 && x <= 21 && y >= 8 && y <= 32;
      const isTopHall = y >= 8 && y <= 10 && x >= 4 && x <= 21;
      const isBottomHall = y >= 30 && y <= 32 && x >= 4 && x <= 21;

      if (isLeftHall || isRightHall || isTopHall || isBottomHall) {
          tile = TileType.FLOOR;
          
          // Visual Loop Markers (Seals)
          // We place them exactly at the teleport lines so the player sees "The Boundary"
          if (isLeftHall || isRightHall) {
              if (y === LOOP_NORTH_TRIGGER_Y || y === LOOP_SOUTH_TRIGGER_Y) {
                  tile = TileType.SEAL;
              }
          }

          // Pillars & Lanterns for rhythm
          if ((isLeftHall || isRightHall) && x % 2 !== 0) {
             // Side Walls
             if (x === 4 || x === 6 || x === 19 || x === 21) {
                 if (y % 4 === 0) tile = TileType.PILLAR;
                 else if (y % 4 === 2) tile = TileType.LANTERN;
             }
          }
      }

      // ROOMS
      // Start Room (Bottom Center)
      if (y > 32 && y < 38 && x >= 10 && x <= 15) tile = TileType.FLOOR;
      
      // Shard Rooms (Corners)
      if (y < 8 && y > 4 && x < 8 && x > 2) tile = TileType.FLOOR; // TL
      if (y < 8 && y > 4 && x > 17 && x < 23) tile = TileType.FLOOR; // TR
      if (y > 32 && y < 36 && x < 8 && x > 2) tile = TileType.FLOOR; // BL
      if (y > 32 && y < 36 && x > 17 && x < 23) tile = TileType.FLOOR; // BR

      // Boss Courtyard (Top Center)
      if (y < 8 && x >= 10 && x <= 15) {
          if (y === 7) tile = doorOpen ? TileType.DOOR : TileType.LOCKED_DOOR;
          else tile = TileType.FLOOR;
      }

      // Secret Painting Room (Right Hall Wall)
      if (x === 22 && y === 18) tile = paintingTorn ? TileType.DOOR : TileType.WALL;
      if (x > 22 && x < 25 && y === 18) tile = TileType.FLOOR;

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
              alert("NOTE: 'I'm stuck. I walked North for hours, but I'm back here. The painting on the East wall... it looks at me.'");
          }
      });
  }

  // Puzzle Painting (Right Hall, Y=18)
  if (!paintingTorn) {
      entities.push({
          id: 'puzzle_painting',
          x: 21.5, y: 18, 
          name: 'Suspicious Painting',
          color: '#FFD700',
          interactionType: 'PUZZLE',
          isSolid: true,
          visibleIn: 'BOTH',
      });
  }

  // Moon Door
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
                  alert("A sealed door. It requires 4 phases of the moon (Jade Shards).");
              }
          }
      });
  }

  // Shards (Corner Rooms)
  const shardLocs = [
      { id: 'shard_1', name: 'Shard: Full Moon', x: 5, y: 6 },
      { id: 'shard_2', name: 'Shard: Waning Moon', x: 20, y: 6 },
      { id: 'shard_3', name: 'Shard: New Moon', x: 5, y: 34 },
      { id: 'shard_4', name: 'Shard: Waxing Moon', x: 23.5, y: 18 } // Secret Room
  ];

  shardLocs.forEach(shard => {
      if (!inventory.has(shard.name)) {
          entities.push({
              id: shard.id,
              x: shard.x, y: shard.y,
              name: shard.name,
              color: '#fff',
              interactionType: 'ITEM',
              isSolid: false,
              visibleIn: WorldType.REALITY,
              onInteract: ({ addItem }) => addItem(shard.id, shard.name)
          });
          entities.push({
              id: `${shard.id}_hint`,
              x: shard.x, y: shard.y,
              name: 'Red Glint',
              color: '#ff0000',
              interactionType: 'DIALOGUE',
              isSolid: false,
              visibleIn: WorldType.INNER_WORLD,
              onInteract: () => alert("An object exists here in Reality. Switch back [SPACE].")
          });
      }
  });

  // Boss & Mirror
  if (doorOpen) {
      entities.push({
          id: 'mirror_save', x: 12.5, y: 5,
          name: 'Large Mirror', color: 'blue', interactionType: 'DIALOGUE', isSolid: true, visibleIn: 'BOTH',
          onInteract: () => alert("You gaze into the mirror. A shadow stands behind you.")
      });
      entities.push({
          id: 'reimu_boss', x: 12.5, y: 3,
          name: 'Greedy Reimu', color: '#ff0000', interactionType: 'BATTLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: onReimuInteract
      });
  }

  // --- 3. TRIGGERS (THE INFINITE LOOP) ---
  // If Painting is NOT torn, the loops are active.
  // Left Hall & Right Hall
  const loopX = [4, 5, 6, 19, 20, 21];

  loopX.forEach(x => {
      // NORTH TRAP: Teleport Back South
      triggers[`${x},${LOOP_NORTH_TRIGGER_Y}`] = { 
          type: 'TELEPORT', 
          targetX: x, 
          targetY: LOOP_NORTH_TARGET_Y, 
          flashEffect: true,
          condition: (f) => !f.has('PAINTING_TORN')
      };
      
      // SOUTH TRAP: Teleport Back North
      triggers[`${x},${LOOP_SOUTH_TRIGGER_Y}`] = { 
          type: 'TELEPORT', 
          targetX: x, 
          targetY: LOOP_SOUTH_TARGET_Y, 
          flashEffect: true,
          condition: (f) => !f.has('PAINTING_TORN')
      };
  });

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

    // Common Textures
    const tatami = {backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 15px, #000 15px, #000 16px)'};
    const seal = {backgroundImage: 'radial-gradient(circle, transparent 40%, rgba(255,0,0,0.5) 50%, transparent 60%)'};

    if (isReality) {
        if (type === TileType.FLOOR || type === TileType.LANTERN || type === TileType.SEAL) {
            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#1e1a18] border-r border-[#2e2a25]">
                    <div className="w-full h-full opacity-10" style={tatami}></div>
                    
                    {type === TileType.SEAL && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-30">
                            <div className="w-full h-1 bg-red-900 blur-sm"></div>
                        </div>
                    )}
                    
                    {type === TileType.LANTERN && (
                        <div className="absolute top-2 left-2 w-8 h-12 bg-orange-900/50 rounded shadow-[0_0_10px_orange]"></div>
                    )}
                </div>
            );
        }
        if (type === TileType.PILLAR) return <div key={`${x}-${y}`} style={style} className="bg-[#0f0a0a] border-x border-gray-800" />;
        if (type === TileType.LOCKED_DOOR) return <div key={`${x}-${y}`} style={style} className="bg-[#1a0f0f] border-4 border-gray-600 flex items-center justify-center text-gray-500 text-xs">CLOSED</div>;
    } else {
        // Inner World
        if (type === TileType.FLOOR || type === TileType.LANTERN || type === TileType.SEAL) {
            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#4a0000] border-r border-[#FFD700]/30">
                     <div className="absolute inset-0 border border-[#FFD700]/10"></div>
                     
                     {type === TileType.SEAL && (
                        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                            <div className="text-[#FFD700] text-xl font-bold">🚫</div>
                        </div>
                    )}

                     {type === TileType.LANTERN && (
                        <div className="absolute top-2 left-2 w-8 h-12 bg-red-900 rounded border border-[#FFD700] flex items-center justify-center animate-pulse">
                            <div className="w-4 h-4 bg-black rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-red-500"></div></div>
                        </div>
                    )}
                </div>
            );
        }
        if (type === TileType.PILLAR) return <div key={`${x}-${y}`} style={style} className="bg-gradient-to-b from-[#FFD700] to-[#8B4513]" />;
        if (type === TileType.LOCKED_DOOR) return <div key={`${x}-${y}`} style={style} className="bg-red-900 border-4 border-[#FFD700] animate-pulse" />;
    }
    
    return <div key={`${x}-${y}`} style={style} className="bg-gray-800" />;
  };

  return (
    <div className="relative shadow-2xl" style={{ width: mapData.width * TILE_SIZE, height: mapData.height * TILE_SIZE }}>
        {mapData.tiles.map((row, y) => row.map((type, x) => renderTile(type, x, y)))}

        {mapData.entities.map(entity => {
            if (entity.visibleIn !== 'BOTH' && entity.visibleIn !== worldType) return null;
            return (
                <div key={entity.id}
                    className="absolute z-20 flex flex-col items-center justify-center transition-all duration-300 pointer-events-none"
                    style={{
                        left: entity.x * TILE_SIZE,
                        top: entity.y * TILE_SIZE,
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                    }}
                >
                    {entity.id === 'reimu_boss' && <div className="text-4xl">⛩️</div>}
                    {entity.id === 'puzzle_painting' && (
                        <div className={`w-10 h-14 border-2 ${isReality ? 'bg-blue-900 border-gray-500' : 'bg-red-700 border-[#FFD700] animate-pulse'}`}>
                             {!isReality && <div className="text-center text-[8px] text-yellow-300">TEAR</div>}
                        </div>
                    )}
                    {entity.id.includes('shard') && !entity.id.includes('hint') && (
                        <div className="w-4 h-4 bg-cyan-300 rounded-full shadow-[0_0_10px_cyan] animate-pulse" />
                    )}
                    {entity.id === 'start_note' && <div className="w-6 h-8 bg-white text-black text-[8px] flex items-center justify-center rotate-12">NOTE</div>}
                    {entity.id.includes('hint') && <div className="w-2 h-20 bg-red-500/50 animate-pulse -mt-10"></div>}
                </div>
            );
        })}
        
        <div className={`absolute inset-0 pointer-events-none mix-blend-multiply opacity-50 ${isReality ? 'bg-black' : 'bg-red-900'}`}></div>
    </div>
  );
};

export default Stage1Eientei;
