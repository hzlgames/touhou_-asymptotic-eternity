import React, { useMemo } from 'react';
import { MapData, TileType, MapEntity } from '../../types';
import { CANVAS_WIDTH } from '../../constants';

export const TILE_SIZE = 48; // Larger tiles for better detail

// --- MAP DATA GENERATION ---
const MAP_WIDTH = 30;
const MAP_HEIGHT = 40;

// Helper to generate the static map layout
export const getStage1Data = (onReimuInteract: () => void): MapData => {
  const tiles: number[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // 1. Base Ground (Empty/Grass)
      let tile = TileType.EMPTY;

      // 2. The Main Road (Center strip)
      if (x >= 13 && x <= 16) {
        tile = TileType.PATH;
      }
      
      // 3. The Shrine Approach (Top area)
      if (y < 8 && x > 5 && x < 24) {
         tile = TileType.PATH;
      }

      // 4. Houses/Walls (Grid pattern on sides)
      if (y > 8 && y < 35) {
         // Side blocks
         if ((x < 11 || x > 18) && y % 5 !== 0) {
             // Leave gaps for alleys
             if (x % 4 !== 0) {
                 tile = TileType.WALL;
             }
         }
      }

      // 5. Perimeters (Forest/Walls)
      if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
        tile = TileType.WALL;
      }

      row.push(tile);
    }
    tiles.push(row);
  }

  // --- ENTITIES ---
  const entities: MapEntity[] = [
    {
      id: 'reimu_boss',
      x: 14.5, // Centered on road
      y: 4,
      name: 'Greedy Reimu',
      color: '#ff0000',
      interactionType: 'BATTLE',
      isSolid: true,
      visibleIn: 'BOTH',
      onInteract: onReimuInteract
    },
    {
        id: 'donation_box',
        x: 13,
        y: 4,
        name: 'Donation Box',
        color: '#8B4513',
        interactionType: 'DIALOGUE',
        isSolid: true,
        visibleIn: 'BOTH',
        onInteract: () => alert("It's empty... Reimu took everything.")
    }
  ];

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    entities,
    triggers: {},
    spawnPoint: { x: 15, y: 38 },
    objectiveText: "Confront Reimu at the shrine."
  };
};

interface Stage1Props {
    mapData: MapData;
}

// --- VISUAL COMPONENT ---
// This component renders the "World" inside the scrolling viewport
const Stage1Village: React.FC<Stage1Props> = ({ mapData }) => {
  
  // Render specific tile visuals based on type
  const renderTile = (type: number, x: number, y: number) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: x * TILE_SIZE,
        top: y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
    };

    switch (type) {
        case TileType.WALL: // Houses
            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#1a1a2e] border-b-4 border-r-4 border-[#000]">
                    {/* Roof visual */}
                    <div className="w-full h-1/2 bg-[#2a2a4e] border-b border-black"></div>
                    <div className="w-full h-1/2 bg-[#3e3e5e] flex justify-around items-end pb-1">
                        <div className="w-2 h-4 bg-yellow-900/50"></div>
                        <div className="w-2 h-4 bg-yellow-900/50"></div>
                    </div>
                </div>
            );
        case TileType.PATH: // Cobblestone Road
            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#2a2a35]">
                    <div className="w-full h-full opacity-30" style={{
                        backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%, transparent 75%, #444 75%, #444), linear-gradient(45deg, #444 25%, transparent 25%, transparent 75%, #444 75%, #444)',
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 10px 10px'
                    }}></div>
                </div>
            );
        case TileType.EMPTY: // Dirt/Grass
        default:
            return null; // Transparent to show background
    }
  };

  return (
    <div 
        className="relative"
        style={{
            width: mapData.width * TILE_SIZE,
            height: mapData.height * TILE_SIZE,
        }}
    >
        {/* 1. Base Layer (Tiles) */}
        {mapData.tiles.map((row, y) => 
            row.map((type, x) => renderTile(type, x, y))
        )}

        {/* 2. Decor Layer (Torii Gates, etc) */}
        <div 
            className="absolute z-10 pointer-events-none"
            style={{ left: 13 * TILE_SIZE, top: 15 * TILE_SIZE, width: 4 * TILE_SIZE, height: 10 }}
        >
             {/* Simple CSS Torii Gate */}
             <div className="absolute top-0 left-0 w-4 h-32 bg-red-800 border-l-2 border-black"></div>
             <div className="absolute top-0 right-0 w-4 h-32 bg-red-800 border-r-2 border-black"></div>
             <div className="absolute top-4 -left-4 w-[120%] h-4 bg-red-600 shadow-md"></div>
             <div className="absolute top-10 left-0 w-full h-3 bg-red-700"></div>
        </div>

        {/* 3. Entity Layer */}
        {mapData.entities.map(entity => (
            <div
                key={entity.id}
                className="absolute flex flex-col items-center justify-center z-20"
                style={{
                    left: entity.x * TILE_SIZE,
                    top: entity.y * TILE_SIZE,
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                }}
            >
                {/* Sprite Placeholder or Image */}
                {entity.id === 'reimu_boss' ? (
                    <div className="relative group">
                         {/* Reimu Pixel Art Placeholder */}
                         <div className="w-10 h-10 bg-red-500 rounded-full border-2 border-white shadow-[0_0_15px_red] animate-pulse relative">
                            <div className="absolute -top-2 left-2 w-6 h-4 bg-red-700 rounded-t-lg"></div> {/* Bow */}
                            <div className="absolute bottom-0 w-full h-1/2 bg-white rounded-b-full"></div>
                         </div>
                         <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            BOSS: Greedy Reimu
                         </div>
                         {/* Quest Marker */}
                         <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400 text-xl font-bold animate-bounce">!</div>
                    </div>
                ) : (
                    <div style={{ backgroundColor: entity.color }} className="w-8 h-8 rounded-sm shadow-sm" />
                )}
            </div>
        ))}
    </div>
  );
};

export default Stage1Village;