
import React, { useEffect, useState } from 'react';
import { MapData, TileType, MapEntity, WorldType, StageProps } from '../../types';

export const TILE_SIZE = 64;

// --- MAP CONFIGURATION ---
const MAP_WIDTH = 40; 
const MAP_HEIGHT = 50;

// The Loop
const LOOP_TRIGGER_Y = 14; // Moved down slightly to fit Torii
const LOOP_RESET_Y = 24;

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
  const hasKey = inventory.has('Admin Key'); 
  const hasLens = inventory.has('Obscure Lens');
  
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
  if (!hasLens) objectiveText = "Search the area for a way to perceive anomalies.";
  else if (!lanternsLit) objectiveText = "A firewall (Data Stream) blocks the path. Activate the Auth Nodes in Reality.";
  else if (!hasKey) objectiveText = "Access the Archive Room. Incinerate the 'Corrupt Data' to find the admin key.";
  else if (!statuesCorrect) objectiveText = "The Security Drones are watching. Align their vision with the glitches.";
  else if (!paintingTorn) objectiveText = "Infinite Redirect Loop detected. Find the anomaly in the Compliance Posters.";
  else objectiveText = "Loop terminated. Enter the System Breach to reach the Administrator.";

  // --- 1. BUILD GEOMETRY ---
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let tile = TileType.VOID;

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
          if (x >= 5 && x <= 35) tile = TileType.FLOOR; 
      }

      // 3. WEST ARCHIVES (x: 2-12, y: 15-28)
      if (x >= 2 && x <= 12 && y >= 15 && y <= 28) {
          tile = TileType.FLOOR;
          if (x === 2 || x === 12 || y === 15 || y === 28) tile = TileType.WALL;
          if (x === 12 && y === 24) tile = TileType.FLOOR; // Doorway
          if (tile === TileType.FLOOR && x > 3 && x < 11 && y % 3 === 0) tile = TileType.BOOKSHELF;
      }

      // 4. EAST STATUE HALL (x: 28-38, y: 15-28)
      if (x >= 28 && x <= 38 && y >= 15 && y <= 28) {
          tile = TileType.FLOOR;
          if (x === 28 || x === 38 || y === 15 || y === 28) tile = TileType.WALL;
          if (x === 28 && y === 24) tile = TileType.FLOOR; // Doorway
      }

      // 5. NORTH CORRIDOR (The Approach) (x: 18-22, y: 8-20)
      if (x >= 18 && x <= 22 && y < 20 && y >= 8) {
          tile = TileType.FLOOR;
          if (x === 18 || x === 22) tile = TileType.WALL;
      }

      // 6. SECRET PATH (x: 23, y: 8-20)
      if (paintingTorn) {
          if (x === 23 && y >= 8 && y <= 20) tile = TileType.PATH; 
          if (x === 23 && y === 20) tile = TileType.SECRET_DOOR;
      }

      // 7. BOSS ROOM (Admin Shrine) (y: 0-8)
      if (y < 8 && x >= 15 && x <= 25) {
           tile = TileType.FLOOR;
           // Checkerboard floor for boss room
           if ((x+y)%2 === 0) tile = TileType.GOLD_FLOOR;
      }

      row.push(tile);
    }
    tiles.push(row);
  }

  // --- 2. DECORATIVE ENTITIES ---
  
  // Asset Trees
  for (let y = 38; y < 48; y += 4) {
      entities.push({
          id: `tree_L_${y}`, x: 9, y: y,
          name: 'Asset Tree', color: 'green', interactionType: 'READ', isSolid: true, visibleIn: 'BOTH',
          onInteract: () => alert(`ASSET TAG: TREE_NATURAL_0${y}\nSTATUS: Awaiting pruning logic.`)
      });
      entities.push({
          id: `tree_R_${y}`, x: 31, y: y,
          name: 'Asset Tree', color: 'green', interactionType: 'READ', isSolid: true, visibleIn: 'BOTH',
          onInteract: () => alert(`ASSET TAG: TREE_NATURAL_0${y+1}\nSTATUS: Rendering...`)
      });
  }

  // Gohei Barriers
  for (let y = 30; y < 48; y+= 2) {
       if (y === 34 || y === 36) continue;
       entities.push({
           id: `gohei_L_${y}`, x: 10, y: y,
           name: 'Gohei Barrier', color: 'white', interactionType: 'READ', isSolid: false, visibleIn: WorldType.REALITY,
           onInteract: () => alert("A sacred wand repurposed as a construction fence.")
       });
       entities.push({
           id: `gohei_R_${y}`, x: 30, y: y,
           name: 'Gohei Barrier', color: 'white', interactionType: 'READ', isSolid: false, visibleIn: WorldType.REALITY,
           onInteract: () => alert("A sacred wand repurposed as a construction fence.")
       });
  }

  // === BOSS ROOM PROPS ===
  
  // 1. Digital Torii Gate (Entrance to Boss Room)
  entities.push({
      id: 'digital_torii', x: 20, y: 9,
      name: 'Digital Torii', color: 'blue', interactionType: 'READ', isSolid: false, visibleIn: 'BOTH',
      onInteract: () => alert("PROTOCOL GATEWAY: Enter to submit Ticket #001.")
  });

  // 2. The Shrine Office (Background)
  entities.push({
      id: 'shrine_desk', x: 20, y: 2,
      name: 'Shrine Office', color: 'red', interactionType: 'READ', isSolid: true, visibleIn: 'BOTH',
      onInteract: () => alert("The nerve center of Gensokyo's Reality Layer. It smells like ozone and old tea.")
  });

  // 3. The Shredder (Donation Box)
  entities.push({
      id: 'shredder', x: 24, y: 4,
      name: 'Donation Shredder', color: 'gray', interactionType: 'READ', isSolid: true, visibleIn: 'BOTH',
      onInteract: () => alert(isReality ? "A donation box modified into a paper shredder. It's aggressively chewing on a 'Feature Request' form." : "THE MAW. IT HUNGERS FOR DATA.")
  });


  // --- 3. INTERACTIVE ENTITIES & PUZZLES ---

  // === LENS ITEM (SPAWN) ===
  if (!inventory.has('Obscure Lens')) {
      entities.push({
          id: 'item_lens', x: 22, y: 46,
          name: 'Shard of Glass', color: '#ff00ff', interactionType: 'ITEM', isSolid: true, visibleIn: WorldType.REALITY,
          onInteract: ({ addItem }) => {
              addItem('Obscure Lens', 'Obscure Lens');
              alert("You picked up the [Obscure Lens].\n\nIt is cold to the touch. When you look through it, the world's colors invert.\n(Press SPACE to toggle the Inner World view).");
          }
      });
  }

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

  // === INNER WORLD DATA PACKETS (LORE) ===
  if (worldType === WorldType.INNER_WORLD) {
      const deletedFiles = [
          { x: 15, y: 37, name: 'trash_01.dat', text: "DELETED FILE: 'Tea_Break.exe'\nREASON: Inefficient use of processing time. 0.05% productivity loss detected." },
          { x: 25, y: 37, name: 'trash_02.dat', text: "DELETED FILE: 'Donation_Greed.wav'\nREASON: Emotional variance exceeds safety threshold. The Administrator does not need money. The Administrator needs RESULTS." },
          { x: 20, y: 33, name: 'trash_03.dat', text: "SYSTEM LOG: 'Reimu Hakurei' personality core has been archived. Loading 'Admin_Bot_v9.0'." }
      ];

      deletedFiles.forEach((file, i) => {
          entities.push({
              id: `del_data_${i}`, x: file.x, y: file.y,
              name: 'Corrupt Data Packet', color: '#ff0000', interactionType: 'READ', isSolid: true, visibleIn: WorldType.INNER_WORLD,
              onInteract: () => alert(file.text)
          });
      });
  }

  // === ARCHIVE PUZZLE (BOOK -> ERROR LOG) ===
  if (!inventory.has('Error Log') && !bookBurned) {
      entities.push({
          id: 'dusty_book', x: 6, y: 20, 
          name: 'Corrupt File', color: 'transparent', interactionType: 'ITEM', isSolid: false, visibleIn: WorldType.REALITY,
          onInteract: ({ addItem }) => addItem('Error Log', 'Error Log')
      });
  }

  entities.push({
      id: 'eirin_log', x: 4, y: 27,
      name: 'Encrypted Tablet', color: '#888', interactionType: 'READ', isSolid: true, visibleIn: WorldType.REALITY,
      onInteract: () => {
          alert("LOG ENTRY #901 [Author: E. Yagokoro]\nSubject: Reimu Hakurei.\nObservation: In this mirror dimension, her 'laziness' variable has been inverted. The result is a hyper-efficient machine that views organic life as 'inefficiency'.\nConclusion: A perfect world is a dead world. Kaguya must realize this.");
      }
  });

  entities.push({
      id: 'furnace', x: 7, y: 16,
      name: 'System Recycler', color: '#555', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
      onInteract: ({ hasItem, setFlag, worldType, addItem }) => {
          if (worldType === WorldType.INNER_WORLD) {
              if (bookBurned) alert("RECYCLER: Empty.");
              else if (hasItem('Error Log')) {
                   setFlag('BOOK_BURNED');
                   addItem('Admin Key', 'Admin Key'); 
                   alert("You drag the 'Error Log' into the Recycle Bin. It dissolves into binary dust, revealing a hidden keycode in the hex dump.");
              } else alert("RECYCLER: Awaiting corrupted data input.");
          } else {
              if (bookBurned && !inventory.has('Admin Key')) {
                  addItem('Admin Key', 'Admin Key');
                  alert("Recovered 'Admin Key' from deleted file metadata!");
              } else alert("A secure data shredder. It hums with the sound of a thousand deleted files.");
          }
      }
  });

  // === STATUE PUZZLE (STATUE -> DRONES) ===
  const statueConfig = [
      { id: 'STATUE_NW', x: 30, y: 18, correct: 1 }, 
      { id: 'STATUE_NE', x: 36, y: 18, correct: 2 }, 
      { id: 'STATUE_SW', x: 30, y: 24, correct: 0 }, 
      { id: 'STATUE_SE', x: 36, y: 24, correct: 3 }, 
  ];

  statueConfig.forEach(s => {
      const currentRot = getRotation(s.id);
      
      entities.push({
          id: s.id, x: s.x, y: s.y,
          name: 'Security Drone', color: '#888', interactionType: 'PUZZLE', isSolid: true, visibleIn: WorldType.REALITY,
          rotation: currentRot,
          onInteract: ({ setFlag, removeFlag }) => {
              const nextRot = (currentRot + 1) % 4;
              removeFlag(`${s.id}_ROT_0`);
              removeFlag(`${s.id}_ROT_1`);
              removeFlag(`${s.id}_ROT_2`);
              removeFlag(`${s.id}_ROT_3`);
              setFlag(`${s.id}_ROT_${nextRot}`);
              
              const dirs = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
              const isNowCorrect = nextRot === s.correct;
              const status = isNowCorrect ? "ALIGNMENT SIGNAL DETECTED" : "SEARCHING...";
              alert(`Servo motor whirs.\nCamera facing: ${dirs[nextRot]}\nSystem: ${status}`);
          }
      });

      entities.push({
          id: `ghost_${s.id}`, x: s.x, y: s.y,
          name: 'Glitch Phantom', color: '#00ffff', interactionType: 'DIALOGUE', isSolid: true, visibleIn: WorldType.INNER_WORLD,
          rotation: s.correct, 
          onInteract: () => alert("The phantom whispers: 'The Admin watches... this way...'")
      });
  });

  // === LOOP & SECRET DOOR PUZZLE ===
  if (!paintingTorn) {
      entities.push({
          id: 'secret_painting', x: 22, y: 19, 
          name: 'Compliance Poster', color: '#ff00ff', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: ({ worldType, setFlag }) => {
              if (worldType === WorldType.INNER_WORLD) {
                  if (hasKey && statuesCorrect) {
                      setFlag('PAINTING_TORN');
                      alert("You rip down the 'OBEY' poster. The wall behind it is untextured—a developer backdoor into the core.");
                  } else {
                      alert("A garish poster reading 'OBEY'. You notice the corner is loose, but something (Security Protocols) prevents you from defacing it.");
                  }
              } else {
                  alert("A poster that reads: 'REPORT BUGS IMMEDIATELY'. It hangs crooked, as if hiding a secret.");
              }
          }
      });
      
      // Loop Trigger
      for (let x = 18; x <= 22; x++) {
          triggers[`${x},${LOOP_TRIGGER_Y}`] = {
              type: 'TELEPORT', targetX: x, targetY: LOOP_RESET_Y, flashEffect: true,
              message: "REDIRECT: 302 FOUND. LOOPING..."
          };
      }
  }

  // === BOSS ENTITY ===
  entities.push({
      id: 'boss', x: 20, y: 4, 
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
const Stage1Eientei: React.FC<StageProps> = ({ mapData, worldType, propSprites }) => {
  const isReality = worldType === WorldType.REALITY;
  const [stamps, setStamps] = useState<{id: number, x: number, y: number, type: string}[]>([]);

  useEffect(() => {
      if (isReality) {
          setStamps([]);
          return;
      }
      const interval = setInterval(() => {
          if (Math.random() > 0.3) return; 
          const newStamp = {
              id: Date.now(),
              x: Math.random() * 100, 
              y: Math.random() * 100,
              type: Math.random() > 0.7 ? '处决' : (Math.random() > 0.5 ? '驳回' : '受理')
          };
          setStamps(prev => [...prev.slice(-5), newStamp]);
      }, 500);
      return () => clearInterval(interval);
  }, [isReality]);

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
            <div key={`${x}-${y}`} style={style} className={`overflow-hidden transition-colors duration-1000 ${isReality ? 'bg-gray-800' : 'bg-black border border-red-500'}`}>
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
            <div key={`${x}-${y}`} style={style} className="bg-purple-900/50 relative overflow-hidden">
                <div className="absolute inset-0 border border-green-500/30"></div>
                <div className="w-full h-full opacity-30" style={{
                        backgroundImage: 'linear-gradient(green 1px, transparent 1px), linear-gradient(90deg, green 1px, transparent 1px)',
                        backgroundSize: '16px 16px'
                }}></div>
            </div>
        );
    }

    if (type === TileType.VOID) return null;

    if (type === TileType.FLOOR || type === TileType.GOLD_FLOOR) {
         return (
            <div key={`${x}-${y}`} style={style} className={`
                ${isReality ? 'bg-[#e0e0e0]' : 'bg-[#2a0a0a]'} 
                border-r border-b border-black/10
            `}>
                {isReality && (x+y)%2===0 && type !== TileType.GOLD_FLOOR && (
                    <div className="w-full h-full border-4 border-yellow-500/20 box-border"></div>
                )}
                {type === TileType.GOLD_FLOOR && (
                    <div className={`w-full h-full opacity-50 ${isReality ? 'bg-blue-900' : 'bg-red-900'}`}></div>
                )}
            </div>
         );
    }
    
    if (type === TileType.WALL) {
        return (
            <div key={`${x}-${y}`} style={style} className={`
                ${isReality ? 'bg-gray-200' : 'bg-black'}
                flex items-center justify-center overflow-hidden relative
            `}>
                {isReality ? (
                    <>
                        <div className="absolute inset-0 bg-yellow-400"></div>
                        <div className="absolute inset-0" style={{
                            backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 10px, #fbbf24 10px, #fbbf24 20px)'
                        }}></div>
                        <div className="absolute bg-black text-yellow-400 text-[8px] font-bold px-1 border border-yellow-400 z-10">
                            KEEP OUT
                        </div>
                    </>
                ) : (
                    <>
                        <div className="absolute inset-0 bg-red-900/20"></div>
                        <div className="w-1 h-full bg-red-600 shadow-[0_0_10px_red] animate-pulse"></div>
                    </>
                )}
            </div>
        );
    }

    if (type === TileType.BOOKSHELF) {
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

      // --- NEW: DIGITAL TORII ---
      if (entity.name === 'Digital Torii') {
          const sprite = propSprites['PROP_DIGITAL_TORII'];
          return (
              <div key={entity.id} style={style} className="absolute z-30 flex justify-center items-end pointer-events-none">
                  {/* Oversized rendering */}
                  <div className="w-[300px] h-[300px] flex items-end justify-center -translate-y-4">
                      {sprite ? (
                          <img 
                            src={sprite} 
                            className={`w-full h-full object-contain drop-shadow-[0_0_15px_blue] ${!isReality ? 'hue-rotate-[140deg] brightness-75 contrast-125' : ''}`}
                            alt="Torii" 
                          />
                      ) : (
                          // Fallback
                          <div className="w-[200px] h-[150px] border-x-8 border-t-8 border-blue-500 relative">
                               <div className="absolute top-4 -left-4 w-[220px] h-4 bg-blue-400"></div>
                          </div>
                      )}
                  </div>
              </div>
          )
      }

      // --- NEW: SHRINE OFFICE DESK ---
      if (entity.name === 'Shrine Office') {
          const sprite = propSprites['PROP_SHRINE_OFFICE'];
          return (
              <div key={entity.id} style={style} className="absolute z-10 flex justify-center pointer-events-none">
                  <div className="w-[500px] h-[400px] flex items-center justify-center -translate-y-16">
                      {sprite ? (
                          <img 
                            src={sprite} 
                            className={`w-full h-full object-contain ${!isReality ? 'hue-rotate-[180deg] sepia contrast-125' : ''}`}
                            alt="Shrine Desk" 
                          />
                      ) : (
                          <div className="w-[300px] h-[200px] bg-gray-800 border-4 border-white flex items-center justify-center text-white">
                              ADMIN DESK
                          </div>
                      )}
                  </div>
              </div>
          )
      }

      // --- NEW: SHREDDER ---
      if (entity.name === 'Donation Shredder') {
          const sprite = propSprites['PROP_SHREDDER'];
          return (
              <div key={entity.id} style={style} className="absolute z-20 flex justify-center pointer-events-none">
                   <div className="w-full h-[96px] -translate-y-8 flex items-end justify-center">
                        {sprite ? (
                            <img 
                                src={sprite} 
                                className={`h-full object-contain ${!isReality ? 'animate-pulse drop-shadow-[0_0_10px_red]' : ''}`}
                                alt="Shredder" 
                            />
                        ) : (
                            <div className="w-12 h-12 bg-red-900 border-2 border-white"></div>
                        )}
                   </div>
                   {/* Paper particles effect if Inner World */}
                   {!isReality && <div className="absolute -top-4 w-1 h-1 bg-white animate-ping"></div>}
              </div>
          )
      }

      // --- BOSS / REIMU ---
      if (entity.name === 'Admin Reimu') {
          const sprite = propSprites['PROP_REIMU_WORK'];
          return (
               <div key={entity.id} style={style} className="absolute z-20 flex justify-center pointer-events-none">
                   {sprite ? (
                       <img 
                            src={sprite} 
                            className={`w-full h-full object-contain scale-125 ${!isReality ? 'brightness-50 grayscale border-red-500' : ''}`}
                            alt="Reimu" 
                       />
                   ) : (
                       <div className="w-10 h-10 bg-red-500 rounded-full border-2 border-white"></div>
                   )}
                   {/* Floating "Busy" Status */}
                   <div className="absolute -top-8 bg-black/80 text-white text-[8px] px-2 py-1 rounded font-mono animate-bounce border border-red-500 whitespace-nowrap">
                       STATUS: {isReality ? 'COMPILING...' : 'PURGING...'}
                   </div>
               </div>
          );
      }

      // --- ASSET TREES ---
      if (entity.name === 'Asset Tree') {
          const sprite = propSprites['PROP_ASSET_TREE'];
          const treeIdNum = entity.id.split('_').pop()?.padStart(3, '0') || '000';
          
          return (
               <div key={entity.id} style={style} className="absolute z-20 -top-16 w-full h-[128px] pointer-events-none flex justify-center">
                   {sprite ? (
                       <img 
                            src={sprite} 
                            className={`h-full object-contain ${!isReality ? 'grayscale brightness-50 contrast-150' : ''}`}
                            alt="Tree" 
                       />
                   ) : (
                       <div className="w-full h-full flex items-end justify-center pb-4 text-[10px] text-red-500 font-mono animate-pulse">
                           [ASSET MISSING]
                       </div>
                   )}
                   <div className="absolute bottom-8 bg-white border border-black text-[6px] font-mono px-1 shadow-[0_0_5px_white] rotate-12">
                      ID: {treeIdNum}
                   </div>
               </div>
          );
      }

      // --- GOHEI BARRIERS ---
      if (entity.name === 'Gohei Barrier') {
          const sprite = propSprites['PROP_GOHEI'];
          return (
               <div key={entity.id} style={style} className="absolute z-20 -top-8 w-full h-[96px] pointer-events-none flex justify-center items-end">
                   {sprite ? (
                       <img 
                            src={sprite} 
                            className="h-full object-contain"
                            alt="Gohei" 
                       />
                   ) : (
                        <div className="w-2 h-12 bg-red-900/50 animate-pulse"></div>
                   )}
                   {!isReality && <div className="absolute top-0 w-full h-full bg-red-500 blur-xl opacity-20 animate-pulse"></div>}
               </div>
          );
      }

      // --- GENERIC ENTITIES ---
      if (entity.name.includes('Data Packet')) {
          return (
            <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none animate-bounce">
                <div className="w-8 h-8 bg-red-900/80 border border-red-500 rotate-45 flex items-center justify-center shadow-[0_0_10px_red]">
                    <span className="text-xs text-white -rotate-45 font-mono">DEL</span>
                </div>
            </div>
          );
      }

      if (entity.id === 'item_lens') {
          return (
            <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none animate-pulse">
                 <div className="w-8 h-8 bg-black border-2 border-purple-500 rounded-full flex items-center justify-center shadow-[0_0_15px_purple]">
                     <span className="text-lg">👁️</span>
                 </div>
            </div>
          );
      }

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

      if (entity.id === 'furnace') { 
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
        
        {/* === ATMOSPHERE LAYERS === */}

        {isReality && (
            <>
                {/* Cold Blue Light Filter */}
                <div className="absolute inset-0 pointer-events-none bg-blue-100/10 mix-blend-screen"></div>
                
                {/* Steam/Fog Animation */}
                <div className="absolute inset-0 pointer-events-none opacity-30 overflow-hidden mix-blend-hard-light">
                    <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/26tP41tqF1T540c4o/giphy.gif')] bg-repeat opacity-40"></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                </div>
            </>
        )}

        {!isReality && (
            <>
                {/* Red Overlay */}
                <div className="absolute inset-0 pointer-events-none bg-red-900/20 mix-blend-overlay"></div>
                
                {/* Glitch Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-20" style={{
                    backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', 
                    backgroundSize: '100% 2px, 3px 100%'
                }}></div>

                {stamps.map(s => (
                    <div 
                        key={s.id}
                        className="absolute z-50 pointer-events-none text-red-600 font-black border-4 border-red-600 p-4 rounded-lg tracking-widest opacity-0 animate-[stampDrop_0.5s_forwards]"
                        style={{
                            left: `${s.x}%`,
                            top: `${s.y}%`,
                            transform: 'rotate(-15deg)',
                            fontSize: '32px',
                            textShadow: '2px 2px 0px black',
                            boxShadow: 'inset 0 0 20px red'
                        }}
                    >
                        {s.type}
                    </div>
                ))}
                <style>{`
                    @keyframes stampDrop {
                        0% { transform: scale(3) rotate(0deg); opacity: 0; }
                        80% { transform: scale(0.9) rotate(-15deg); opacity: 1; }
                        100% { transform: scale(1) rotate(-15deg); opacity: 0.8; }
                    }
                `}</style>
            </>
        )}
    </div>
  );
};

export default Stage1Eientei;
