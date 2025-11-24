
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
    worldType: WorldType
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
  let objectiveText = "Proceed to the Administration Desk (Shrine).";
  if (!lanternsLit) objectiveText = "A firewall (Data Stream) blocks the path. Activate the Auth Nodes in Reality.";
  else if (!hasKey) objectiveText = "Access the Archive Room. Incinerate the 'Corrupt Data' to find the admin key.";
  else if (!statuesCorrect) objectiveText = "The Security Drones are watching. Align their vision with the glitches.";
  else if (!paintingTorn) objectiveText = "Infinite Redirect Loop detected. Find the anomaly in the Compliance Posters.";
  else objectiveText = "Loop terminated. The texture of reality is peeling off. Enter the Breach.";

  // --- 1. BUILD GEOMETRY ---
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let tile = TileType.VOID;

      // -- AREAS --

      // 1. SOUTH SPAWN & GARDEN (y: 30-49)
      if (y >= 30) {
          if (x >= 10 && x <= 30) tile = TileType.FLOOR;
          
          // The River (y: 34-36) -> DATA STREAM
          if (y >= 34 && y <= 36) {
              tile = TileType.WATER; 
              if (lanternsLit && !isReality && (x === 15 || x === 25)) tile = TileType.BRIDGE;
          }
      }

      // 2. CENTRAL HUB (y: 20-30)
      if (y >= 20 && y < 30) {
          if (x >= 5 && x <= 35) tile = TileType.FLOOR; // Wide hub
      }

      // 3. WEST ARCHIVES (x: 2-12, y: 10-28) -> FILING ROOM
      if (x >= 2 && x <= 12 && y >= 10 && y <= 28) {
          tile = TileType.FLOOR;
          if (x === 2 || x === 12 || y === 10 || y === 28) tile = TileType.WALL;
          if (x === 12 && y === 24) tile = TileType.FLOOR; // Doorway
          if (tile === TileType.FLOOR && x > 3 && x < 11 && y % 3 === 0) tile = TileType.BOOKSHELF;
      }

      // 4. EAST STATUE HALL (x: 28-38, y: 10-28) -> DRONE HANGAR
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

  // === GARDEN PUZZLE (LANTERNS -> NODES) ===
  ['LANTERN_L', 'LANTERN_R'].forEach((id, idx) => {
      const lx = idx === 0 ? 14 : 26;
      entities.push({
          id, x: lx, y: 38, 
          name: 'Auth Node', 
          color: flags.has(id) ? '#00ff00' : '#333', 
          interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: ({ setFlag, worldType }) => {
              if (worldType === WorldType.REALITY) {
                  if (!flags.has(id)) {
                      setFlag(id);
                      alert("TERMINAL: Access Authorized. Debug bridge compilation started.");
                  } else {
                      alert("TERMINAL: System Normal. No irregularities found.");
                  }
              } else {
                  alert("ERROR: Hardware interaction required in Physical Layer.");
              }
          }
      });
  });

  // === ARCHIVE PUZZLE (BOOK -> ERROR LOG) ===
  if (!inventory.has('Error Log') && !bookBurned) {
      entities.push({
          id: 'dusty_book', x: 6, y: 15, 
          name: 'Corrupt File', color: 'transparent', interactionType: 'ITEM', isSolid: false, visibleIn: WorldType.REALITY,
          onInteract: ({ addItem }) => addItem('Error Log', 'Error Log')
      });
  }

  // **STORY ITEM: Eirin's Terminal**
  entities.push({
      id: 'eirin_log', x: 4, y: 27,
      name: 'Encrypted Tablet', color: '#888', interactionType: 'READ', isSolid: true, visibleIn: WorldType.REALITY,
      onInteract: () => {
          alert("LOG ENTRY #901 [Author: E. Yagokoro]\nSubject: Reimu Hakurei.\nObservation: In this mirror dimension, her 'laziness' variable has been inverted. The result is a hyper-efficient machine that views organic life as 'inefficiency'.\nConclusion: A perfect world is a dead world. Kaguya must realize this.");
      }
  });

  entities.push({
      id: 'furnace', x: 7, y: 12,
      name: 'System Recycler', color: '#555', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
      onInteract: ({ hasItem, setFlag, worldType, addItem }) => {
          if (worldType === WorldType.INNER_WORLD) {
              if (bookBurned) alert("RECYCLER: Empty.");
              else if (hasItem('Error Log')) {
                   setFlag('BOOK_BURNED');
                   alert("You drag the 'Error Log' into the Recycle Bin. It dissolves into binary dust, revealing a hidden keycode in the hex dump.");
              } else alert("RECYCLER: Awaiting corrupted data input.");
          } else {
              if (bookBurned && !inventory.has('Archive Key')) {
                  addItem('Archive Key', 'Admin Key');
                  alert("Recovered 'Admin Key' from deleted file metadata!");
              } else alert("A secure data shredder. It hums with the sound of a thousand deleted files.");
          }
      }
  });

  // === STATUE PUZZLE (STATUE -> DRONES) ===
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
          name: 'Security Drone', color: '#888', interactionType: 'PUZZLE', isSolid: true, visibleIn: WorldType.REALITY,
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

      // Inner World: Ghost Hint -> Glitch
      entities.push({
          id: `ghost_${s.id}`, x: s.x, y: s.y,
          name: 'Glitch Phantom', color: '#00ffff', interactionType: 'DIALOGUE', isSolid: true, visibleIn: WorldType.INNER_WORLD,
          rotation: s.correct, 
          onInteract: () => alert("The phantom whispers: 'The Admin watches... this way...'")
      });
  });

  // === LOOP & SECRET DOOR PUZZLE (PAINTING -> POSTER) ===
  
  // The Painting that hides the secret door
  if (hasKey && statuesCorrect) {
    if (!paintingTorn) {
        entities.push({
            id: 'secret_painting', x: 22, y: 20, // On the right wall of the corridor entrance
            name: 'Compliance Poster', color: '#ff00ff', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
            onInteract: ({ worldType, setFlag }) => {
                if (worldType === WorldType.INNER_WORLD) {
                    setFlag('PAINTING_TORN');
                    alert("You rip down the 'OBEY' poster. The wall behind it is untextured—a developer backdoor into the core.");
                } else {
                    alert("A poster that reads: 'REPORT BUGS IMMEDIATELY'. It hangs crooked, as if hiding a secret.");
                }
            }
        });
    }
  }

  // Loop Trigger Logic
  if (!paintingTorn) {
      for (let x = 18; x <= 22; x++) {
          triggers[`${x},${LOOP_TRIGGER_Y}`] = {
              type: 'TELEPORT', targetX: x, targetY: LOOP_RESET_Y, flashEffect: true,
              message: "REDIRECT: 302 FOUND. LOOPING..."
          };
      }
  }

  // === BOSS ===
  entities.push({
      id: 'boss', x: 20, y: 3, 
      name: 'Admin Reimu', color: 'red', interactionType: 'BATTLE', isSolid: true, visibleIn: 'BOTH',
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

  // -- VISUAL STYLES --
  // Reality: Construction site, Grey/Yellow, "Under Maintenance"
  // Inner: Red/Black, Glitches, "Fatal Error"

  const renderTile = (type: number, x: number, y: number) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: x * TILE_SIZE,
        top: y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
    };

    if (type === TileType.WATER) { // DATA STREAM
        return (
            <div key={`${x}-${y}`} style={style} className={`overflow-hidden transition-colors duration-1000 ${isReality ? 'bg-gray-800' : 'bg-black border border-red-500'}`}>
                {/* Rolling code effect */}
                <div className="w-full h-full opacity-50 flex flex-col text-[8px] leading-none font-mono text-green-500 animate-pulse">
                    {Array(10).fill(0).map((_, i) => <div key={i}>{Math.random().toString(36).substring(7)}</div>)}
                </div>
                {!isReality && <div className="absolute inset-0 bg-red-900/50 animate-pulse"></div>}
            </div>
        );
    }
    if (type === TileType.BRIDGE) {
        return (
            <div key={`${x}-${y}`} style={style} className="bg-blue-900/80 border-x-2 border-blue-400 shadow-[0_0_15px_blue] z-10 flex items-center justify-center">
                <div className="text-[10px] text-blue-200 font-mono">DEBUG<br/>BRIDGE</div>
            </div>
        );
    }
    if (type === TileType.SECRET_DOOR) {
        return (
            <div key={`${x}-${y}`} style={style} className="bg-black border-2 border-dashed border-green-500 z-0 flex items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-green-900/20 animate-pulse"></div>
                 <div className="text-xs text-green-500 font-mono animate-pulse z-10 relative text-center">
                    SYSTEM<br/>BREACH
                 </div>
            </div>
        );
    }
    if (type === TileType.PATH) {
        return (
            <div key={`${x}-${y}`} style={style} className="bg-[#111] shadow-inner border border-[#333]"></div>
        );
    }

    if (type === TileType.VOID) return null;

    if (type === TileType.FLOOR) {
         return (
            <div key={`${x}-${y}`} style={style} className={`
                ${isReality ? 'bg-[#e0e0e0]' : 'bg-[#2a0a0a]'} 
                border-r border-b border-black/10
            `}>
                {isReality && (x+y)%2===0 && (
                    <div className="w-full h-full border-4 border-yellow-500/20 box-border"></div>
                )}
            </div>
         );
    }
    
    if (type === TileType.WALL) {
        return (
            <div key={`${x}-${y}`} style={style} className={`
                ${isReality ? 'bg-gray-200' : 'bg-[#300]'}
                flex items-center justify-center overflow-hidden
            `}>
                {isReality ? (
                    // Reality: Caution Tape Wall
                    <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#facc15,#facc15_10px,#000_10px,#000_20px)] opacity-50"></div>
                ) : (
                    // Inner: Firewall
                    <div className="w-full h-full border border-red-600 shadow-[inset_0_0_10px_red]">
                        <div className="text-[8px] text-red-600 font-mono p-1">ACCESS DENIED</div>
                    </div>
                )}
            </div>
        );
    }

    if (type === TileType.BOOKSHELF) { // SERVERS / FILES
        return (
             <div key={`${x}-${y}`} style={style} className="bg-[#222] border border-gray-600 flex flex-col justify-end p-1">
                 {isReality ? (
                     <div className="flex flex-col gap-1">
                        <div className="h-1 bg-green-500 w-2 animate-pulse rounded-full self-end"></div>
                        <div className="h-1 bg-green-500 w-2 animate-pulse rounded-full self-end delay-75"></div>
                        <div className="text-[8px] text-gray-400 font-mono text-center">SRV-0{x}</div>
                     </div>
                 ) : (
                     <div className="text-[10px] text-red-500 font-mono break-all leading-none opacity-50 text-center animate-pulse">
                         ERROR<br/>404
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
          const isLit = entity.color === '#00ff00';
          return (
              <div key={entity.id} style={style} className="absolute z-20 flex justify-center items-end pb-2 pointer-events-none">
                  <div className={`w-8 h-12 bg-gray-800 border-2 ${isLit ? 'border-green-500 shadow-[0_0_15px_green]' : 'border-red-500'} flex flex-col items-center justify-center`}>
                      <div className={`w-6 h-6 rounded-full ${isLit ? 'bg-green-400 animate-pulse' : 'bg-red-900'}`}></div>
                  </div>
              </div>
          );
      }
      
      if (entity.id === 'secret_painting') {
          return (
            <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none">
                <div className={`w-12 h-16 bg-white border-2 border-black shadow-md flex flex-col items-center justify-center ${!isReality ? 'animate-pulse bg-red-100' : ''}`}>
                    <div className="text-[8px] font-bold">NOTICE</div>
                    <div className="w-8 h-8 border border-black flex items-center justify-center text-xs">👁️</div>
                </div>
            </div>
          );
      }

      if (entity.id === 'furnace') { // SHREDDER
          return (
            <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 bg-gray-700 rounded-sm border-t-4 border-black flex items-center justify-center">
                    <span className="text-xl">🗑️</span>
                </div>
            </div>
          );
      }

      if (entity.id === 'eirin_log') {
          return (
            <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-8 bg-blue-900 border border-blue-400 rounded flex items-center justify-center shadow-[0_0_10px_blue]">
                    <div className="text-[8px] text-blue-200 font-mono">LOG</div>
                </div>
            </div>
          );
      }

      if (entity.name.includes('Drone') || entity.name.includes('Glitch')) {
          const rotDeg = (entity.rotation || 0) * 90;
          return (
              <div key={entity.id} style={style} className="absolute z-20 flex justify-center items-center pointer-events-none">
                  <div 
                    className={`w-10 h-10 transition-transform duration-500 flex items-center justify-center
                        ${entity.name.includes('Glitch') ? 'opacity-80' : 'bg-white rounded-full border-4 border-gray-800'}
                    `}
                    style={{ transform: `rotate(${rotDeg}deg)` }}
                  >
                      {entity.name.includes('Glitch') ? (
                          <div className="text-3xl filter drop-shadow-[0_0_5px_cyan]">⚠️</div>
                      ) : (
                          // Drone Eye
                          <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_5px_red]"></div>
                      )}
                      <div className="absolute -top-6 text-[10px] font-bold text-white bg-black/80 px-1 font-mono">
                           CAM-{['N','E','S','W'][entity.rotation || 0]}
                      </div>
                  </div>
              </div>
          );
      }
      
      return (
          <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none text-2xl">
              {entity.interactionType === 'ITEM' ? '📄' : 
               entity.interactionType === 'BATTLE' ? '⛔' : 
               '❓'}
          </div>
      );
  };

  return (
    <div className="relative shadow-2xl" style={{ width: mapData.width * TILE_SIZE, height: mapData.height * TILE_SIZE }}>
        {mapData.tiles.map((row, y) => row.map((type, x) => renderTile(type, x, y)))}
        {mapData.entities.map(renderEntity)}
        
        {/* ATMOSPHERE OVERLAYS */}
        <div className={`absolute inset-0 pointer-events-none mix-blend-overlay transition-colors duration-1000 ${isReality ? 'bg-cyan-900/10' : 'bg-red-900/30'}`}></div>
        
        {/* Steam / Fog for Reality */}
        {isReality && (
             <div className="absolute inset-0 pointer-events-none bg-[url('https://media.giphy.com/media/26tP41tqF1T540c4o/giphy.gif')] opacity-10 mix-blend-screen bg-repeat"></div>
        )}

        {/* Glitch for Inner World */}
        {!isReality && (
             <div className="absolute inset-0 pointer-events-none opacity-20" style={{backgroundImage: 'linear-gradient(rgba(255, 0, 0, 0.1) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%'}}></div>
        )}
    </div>
  );
};

export default Stage1Eientei;
