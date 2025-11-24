
import React from 'react';
import { MapData, TileType, MapEntity, WorldType, StageProps } from '../../types';

export const TILE_SIZE = 64;

// --- MAP CONFIGURATION ---
const MAP_WIDTH = 40; 
const MAP_HEIGHT = 50;

// The Corridor Loop Logic
// Main Corridor is X=18 to X=22
const LOOP_REGION_Y_START = 10;
const LOOP_REGION_Y_END = 25;
// Teleports player back if they try to walk North through the corridor without the Secret Path
const LOOP_TRIGGER_Y = 12; 
const LOOP_TARGET_Y = 24;

export const getStage1Data = (
    flags: Set<string>,
    inventory: Set<string>,
    onReimuInteract: () => void
): MapData => {
  const tiles: number[][] = [];
  const entities: MapEntity[] = [];
  const triggers: Record<string, any> = {};

  // -- PUZZLE STATE --
  const paintingTorn = flags.has('PAINTING_TORN');
  const moonGateOpen = flags.has('MOON_GATE_OPEN');
  
  // Count Fragments
  const fragments = ['Fragment (Full)', 'Fragment (Waning)', 'Fragment (New)', 'Fragment (Waxing)'];
  const heldFragments = fragments.filter(f => inventory.has(f)).length;

  // Objective Logic
  let objectiveText = "Escape the eternal night.";
  if (heldFragments < 4) objectiveText = `Find the 4 Jade Fragments hidden in reality. Use the Lens to spot them. (${heldFragments}/4)`;
  else if (!moonGateOpen) objectiveText = "The Moon Gate awaits. Arrange the phases in reverse time.";
  else if (!paintingTorn) objectiveText = "The corridor is endless. Find the lie in the gallery.";
  else objectiveText = "The loop is broken. Confront the Mastermind.";

  // --- 1. BUILD GEOMETRY ---
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let tile = TileType.VOID;

      // 1. MAIN HALL & CROSSROADS (Center)
      if (x >= 15 && x <= 25 && y >= 25 && y <= 45) {
          tile = TileType.FLOOR; // Will render as Wood(Reality) or Gold(Inner)
          if (x === 15 || x === 25 || y === 45) tile = TileType.WALL;
      }

      // 2. WEST WING: The Archives (Fragment 1 & Note)
      if (x >= 2 && x < 15 && y >= 30 && y <= 42) {
          tile = TileType.FLOOR;
          if (x === 2 || y === 30 || y === 42) tile = TileType.WALL;
          if (x === 14 && y === 36) tile = TileType.FLOOR; // Door
          
          // Bookshelves
          if (x > 4 && x < 12 && y % 3 === 0) tile = TileType.BOOKSHELF;
      }

      // 3. EAST WING: The Storehouse (Fragment 2 & Stash)
      if (x > 25 && x <= 38 && y >= 30 && y <= 42) {
          tile = TileType.FLOOR;
          if (x === 38 || y === 30 || y === 42) tile = TileType.WALL;
          if (x === 26 && y === 36) tile = TileType.FLOOR; // Door
      }

      // 4. THE INFINITE CORRIDOR (North)
      if (x >= 18 && x <= 22 && y >= 5 && y < 25) {
          tile = TileType.FLOOR;
          // Walls
          if (x === 18 || x === 22) tile = TileType.WALL;
          
          // The Secret Door (West Wall of Corridor)
          if (x === 18 && y === 15) {
              tile = paintingTorn ? TileType.SECRET_DOOR : TileType.PAINTING;
          }
      }

      // 5. THE SECRET PATH (Bypasses Loop)
      // A narrow passage behind the painting
      if (x >= 14 && x <= 17 && y >= 8 && y <= 15) {
          tile = TileType.VOID;
          if (x === 17 && y >= 8 && y <= 15) tile = TileType.PATH; // The path
          if (x === 17 && y === 8) tile = TileType.FLOOR; // Re-entry
      }
      // Connector back to main path at Y=8 (Past the loop trigger)
      if (x === 18 && y === 8) tile = TileType.SECRET_DOOR;

      // 6. BOSS ANTECHAMBER (Northmost)
      if (x >= 15 && x <= 25 && y >= 0 && y < 5) {
          tile = TileType.FLOOR;
          if (y === 5) tile = TileType.MOON_GATE; // The Gate
      }

      row.push(tile);
    }
    tiles.push(row);
  }

  // --- 2. ENTITIES ---

  // -- STARTING NOTE --
  if (!inventory.has("Doctor's Note")) {
      entities.push({
          id: 'doc_note', x: 20, y: 42, name: 'Torn Note', color: '#fff', interactionType: 'READ', isSolid: true, visibleIn: 'BOTH',
          onInteract: ({ addItem }) => {
              addItem("Doctor's Note", "Doctor's Note");
              alert("HANDWRITTEN NOTE: 'The stagnation is spreading. My attempt to build a vessel failed. The key to the Moon Gate lies in reversing the flow of time: Full -> Waning -> New -> Waxing. -Eirin'");
          }
      });
  }

  // -- THE 4 JADE FRAGMENTS --
  // Mechanic: Red Glow in Inner World (Hint), Invisible but clickable in Reality.
  
  const fragmentLocations = [
      { id: 'Fragment (Full)', x: 6, y: 32, hint: "Archives Top" }, // West Wing
      { id: 'Fragment (Waning)', x: 35, y: 40, hint: "Storehouse Bottom" }, // East Wing
      { id: 'Fragment (New)', x: 24, y: 26, hint: "Crossroads Right" }, // Hub
      { id: 'Fragment (Waxing)', x: 16, y: 26, hint: "Crossroads Left" }, // Hub
  ];

  fragmentLocations.forEach(frag => {
      if (!inventory.has(frag.id)) {
          // 1. Inner World Indicator (Visual Only)
          entities.push({
              id: `hint_${frag.id}`, x: frag.x, y: frag.y, 
              name: 'Resonance', color: 'red', interactionType: 'DIALOGUE', isSolid: false, visibleIn: WorldType.INNER_WORLD,
              onInteract: () => alert("A strong spiritual resonance... Something is hidden here in reality.")
          });

          // 2. Reality Pickup (Invisible)
          entities.push({
              id: `pickup_${frag.id}`, x: frag.x, y: frag.y,
              name: '???', color: 'transparent', interactionType: 'ITEM', isSolid: false, visibleIn: WorldType.REALITY,
              onInteract: ({ addItem }) => {
                  addItem(frag.id, frag.id);
                  alert(`You found: ${frag.id}. It feels cold to the touch.`);
              }
          });
      }
  });

  // -- KAGUYA'S SECRET STASH --
  if (!inventory.has("Secret Stash")) {
      entities.push({
          id: 'stash', x: 32, y: 32, name: 'Fancy Box', color: 'gold', interactionType: 'ITEM', isSolid: true, visibleIn: 'BOTH',
          onInteract: ({ addItem, worldType }) => {
              if (worldType === WorldType.INNER_WORLD) {
                  addItem("Secret Stash", "Donation Ticket");
                  alert("Obtained 'Donation Ticket'. Wait, this is just a coupon for the Hakurei Shrine?!");
              } else {
                  addItem("Secret Stash", "Kaguya's Stash");
                  alert("Obtained 'Kaguya's Secret Stash'. It looks valuable.");
              }
          }
      });
  }

  // -- CLOCKWORK RABBITS (Hazards) --
  // Located in Inner World, blocking easy paths
  const rabbits = [
      { x: 20, y: 30 }, { x: 10, y: 36 }, { x: 30, y: 36 }
  ];
  rabbits.forEach((r, i) => {
      entities.push({
          id: `rabbit_${i}`, x: r.x, y: r.y, name: 'Clockwork Rabbit', color: '#ff00ff', interactionType: 'DIALOGUE', isSolid: true, visibleIn: WorldType.INNER_WORLD,
          onInteract: ({ worldType }) => {
               // Only dangerous in Inner World
               alert("TARGET ACQUIRED. INTRUDER DETECTED. (The mechanical rabbit blocks the way. Switch to Reality to bypass it.)");
          }
      });
  });

  // -- MOON GATE PUZZLE --
  // Located at Y=5. Blocking the boss.
  if (!moonGateOpen) {
      entities.push({
          id: 'moon_gate_lock', x: 20, y: 5, name: 'Moon Gate', color: '#333', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: ({ hasItem, setFlag }) => {
              if (heldFragments < 4) {
                  alert("The gate has 4 empty recesses. It seems to require Jade Fragments.");
                  return;
              }
              // Simple simulation of the puzzle input
              const answer = window.prompt("Arrange the phases (Enter numbers 1-4):\n1. New Moon (朔)\n2. Waxing Moon (上弦)\n3. Full Moon (望)\n4. Waning Moon (下弦)\n\nClue: 'Reverse the flow of time.'");
              
              // Correct Order: Full(3) -> Waning(4) -> New(1) -> Waxing(2)
              // OR strictly reverse cycle: Full -> Waning -> New -> Waxing.
              // Let's accept "3412" based on the prompt "望→下弦→朔→上弦"
              if (answer === "3412" || answer === "3,4,1,2") {
                  setFlag("MOON_GATE_OPEN");
                  alert("The jade fragments glow in reverse order. Time seems to flow backward for a moment. The gate opens.");
              } else {
                  alert("The mechanism jams. That is not the correct order of time.");
              }
          }
      });
  }

  // -- THE PAINTING & LOOP --
  // Painting at (18, 15).
  if (!paintingTorn) {
      entities.push({
          id: 'magic_painting', x: 18, y: 15, name: 'Painting', color: '#888', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: ({ setFlag, worldType }) => {
              if (worldType === WorldType.REALITY) {
                  alert("A painting of 'Thirty-six Views of Mount Fuji'. It looks normal.");
              } else {
                  // Inner World
                  const choice = window.confirm("The painting shows 'Reimu Worshipping Money'. It looks like a cheap sticker covering the wall. Tear it off?");
                  if (choice) {
                      setFlag("PAINTING_TORN");
                      alert("You tear down the poster! A cold wind blows from the hole in the wall.");
                  }
              }
          }
      });

      // LOOP TRIGGERS
      // If player crosses Y=12 in the corridor (X 18-22), teleport back to Y=24
      // BUT, we must allow them to enter the SECRET PATH (X=17).
      for (let x = 18; x <= 22; x++) {
          triggers[`${x},${LOOP_TRIGGER_Y}`] = {
              type: 'TELEPORT', targetX: x, targetY: LOOP_TARGET_Y, flashEffect: true,
              message: "You walked forward, but found yourself back at the start..."
          };
      }
  }

  // -- BOSS --
  if (moonGateOpen) {
       entities.push({
          id: 'reimu_boss', x: 20, y: 2, name: 'Greedy Reimu', color: '#ff0000', interactionType: 'BATTLE', isSolid: true, visibleIn: 'BOTH',
          onInteract: onReimuInteract
      });
  }

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    entities,
    triggers,
    spawnPoint: { x: 20, y: 44 },
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

    // --- FLOOR RENDERING ---
    if (type === TileType.FLOOR || type === TileType.PATH || type === TileType.SECRET_DOOR) {
        // REALITY: Old Wood / Dust
        if (isReality) {
             return (
                <div key={`${x}-${y}`} style={style} className="bg-[#2d241b] border-r border-b border-[#1a1510] relative">
                    <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1h2v2H1V1zm4 4h2v2H5V5zm4 4h2v2H9V9zm4 4h2v2h-2v-2zm4 4h2v2h-2v-2z\' fill=\'%23ffffff\' fill-opacity=\'0.2\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'}}></div>
                </div>
             );
        } 
        // INNER WORLD: Gold Bricks
        else {
             return (
                <div key={`${x}-${y}`} style={style} className="bg-[#aa8800] border border-[#ffd700] shadow-[inset_0_0_10px_#664400]">
                    <div className="w-full h-full opacity-20 flex items-center justify-center text-4xl text-yellow-200">
                        ¥
                    </div>
                </div>
             );
        }
    }
    
    // --- WALL RENDERING ---
    if (type === TileType.WALL || type === TileType.MOON_GATE || type === TileType.PAINTING || type === TileType.BOOKSHELF) {
        // REALITY: Shoji Screen / Wood Wall
        if (isReality) {
            if (type === TileType.PAINTING) {
                 return (
                    <div key={`${x}-${y}`} style={style} className="bg-[#1a1510] border border-gray-800 flex items-center justify-center">
                        <div className="w-3/4 h-3/4 bg-blue-900 border-4 border-yellow-900 overflow-hidden relative">
                             <div className="absolute bottom-0 w-full h-1/2 bg-white/20 transform skew-y-12"></div> {/* Mt Fuji hint */}
                        </div>
                    </div>
                );
            }
            if (type === TileType.MOON_GATE) {
                return <div key={`${x}-${y}`} style={style} className="bg-gray-900 border-4 border-gray-600 flex items-center justify-center text-gray-500 font-serif text-xs">MOON GATE</div>;
            }

            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#1a110d] border-b-4 border-black">
                     <div className="w-full h-full border-x-8 border-[#2d241b] opacity-50"></div>
                </div>
            );
        } 
        // INNER WORLD: Red Charms / Gold Wall
        else {
             if (type === TileType.PAINTING) {
                 return (
                    <div key={`${x}-${y}`} style={style} className="bg-[#aa8800] border border-yellow-500 flex items-center justify-center">
                        <div className="w-full h-full bg-red-600 flex items-center justify-center border-4 border-gold text-white font-bold text-xs text-center p-1">
                             REIMU SHRINE DONATE NOW
                        </div>
                    </div>
                );
            }
            if (type === TileType.MOON_GATE) {
                return <div key={`${x}-${y}`} style={style} className="bg-[#330000] border-4 border-[#FFD700] shadow-[0_0_20px_red] z-10"></div>;
            }

            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#440000] border border-yellow-600 overflow-hidden">
                    <div className="absolute top-1 left-1 w-4 h-6 bg-yellow-200 text-[8px] text-red-900 text-center leading-none border border-red-900">大吉</div>
                    <div className="absolute bottom-2 right-2 w-4 h-6 bg-yellow-200 text-[8px] text-red-900 text-center leading-none border border-red-900">封</div>
                </div>
            );
        }
    }

    return null;
  };

  return (
    <div className="relative shadow-2xl" style={{ width: mapData.width * TILE_SIZE, height: mapData.height * TILE_SIZE }}>
        {mapData.tiles.map((row, y) => row.map((type, x) => renderTile(type, x, y)))}

        {mapData.entities.map(entity => {
            if (entity.visibleIn !== 'BOTH' && entity.visibleIn !== worldType) return null;
            
            // Custom Visuals for Fragments
            if (entity.id.includes("pickup_Fragment")) {
                 if (isReality) {
                     // Invisible but interactable hint
                     return (
                         <div key={entity.id} 
                              className="absolute z-30 w-16 h-16 hover:bg-white/10 cursor-pointer rounded-full"
                              style={{ left: entity.x * TILE_SIZE, top: entity.y * TILE_SIZE }}
                         />
                     );
                 }
            }

            // General Entity Rendering
            let innerContent = null;
            if (entity.id.includes('hint_Fragment')) innerContent = <div className="w-full h-full rounded-full border-4 border-red-500 animate-ping opacity-50"></div>;
            else if (entity.id.includes('rabbit')) innerContent = <div className="text-4xl animate-bounce">🐇</div>;
            else if (entity.id === 'reimu_boss') innerContent = <div className="text-5xl drop-shadow-[0_0_10px_red]">⛩️</div>;
            else if (entity.interactionType === 'ITEM') innerContent = <div className="text-2xl animate-pulse">📦</div>;
            else if (entity.interactionType === 'READ') innerContent = <div className="text-2xl bg-white text-black px-1">📄</div>;
            
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
        
        {/* Dynamic Atmosphere Overlay */}
        <div className={`absolute inset-0 pointer-events-none mix-blend-overlay transition-colors duration-1000 ${isReality ? 'bg-black/40' : 'bg-yellow-500/10'}`}></div>
        {!isReality && <div className="absolute inset-0 pointer-events-none opacity-20" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #ffd700 10px, #ffd700 11px)'}}></div>}
    </div>
  );
};

export default Stage1Eientei;
