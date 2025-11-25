
import React from 'react';
import { MapData, TileType, MapEntity, WorldType, StageProps } from '../../types';
import { TILE_SIZE } from './Stage1Eientei';

const MAP_WIDTH = 40;
const MAP_HEIGHT = 50;

export const getStage1BambooData = (
    flags: Set<string>,
    inventory: Set<string>,
    onMarisaInteract: () => void,
    worldType: WorldType
): MapData => {
    const tiles: number[][] = [];
    const entities: MapEntity[] = [];
    const triggers: Record<string, any> = {};

    const isReality = worldType === WorldType.REALITY;
    const isInner = worldType === WorldType.INNER_WORLD;
    const hasLens = inventory.has('Obscure Lens');
    const talismansFound = flags.has('TALISMAN_1') && flags.has('TALISMAN_2') && flags.has('TALISMAN_3');
    const fireCleared = flags.has('FIRE_CLEARED');

    // Objective Logic
    let objectiveText = "Locate the source of the heat in the forest.";
    if (!hasLens) objectiveText = "The forest is an illusion. Find the [Obscure Lens] to see the truth.";
    else if (!talismansFound) objectiveText = "The path to the culprit is blocked by Blue Fire. Find 3 Sealed Talismans in the Inner World.";
    else if (!fireCleared) objectiveText = "You have the Talismans. Extinguish the barrier at the Shrine Entrance.";
    else objectiveText = "Confront the depressed magician.";

    // --- GENERATE TILES ---
    for (let y = 0; y < MAP_HEIGHT; y++) {
        const row: number[] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            let tile = TileType.WALL; // Default is thicket

            // 1. Central Path (Winding)
            const pathCenter = 20 + Math.sin(y * 0.2) * 4;
            if (x >= pathCenter - 2 && x <= pathCenter + 2) tile = TileType.FLOOR;

            // 2. Clearings
            if ((y === 45) || (y === 30 && x < 15) || (y === 15 && x > 25) || (y < 10)) {
                 if (x > 5 && x < 35) tile = TileType.FLOOR;
            }

            // 3. Blue Fire Barrier (The River equivalent)
            if (y === 10 && x > 10 && x < 30) {
                 if (!fireCleared) tile = TileType.WATER; // Visualized as fire
                 else tile = TileType.FLOOR;
            }

            row.push(tile);
        }
        tiles.push(row);
    }

    // --- ENTITIES ---

    // 1. Lens (Spawn)
    if (!inventory.has('Obscure Lens')) {
        entities.push({
            id: 'item_lens_bamboo', x: 20, y: 46,
            name: 'Shard of Glass', color: '#ff00ff', interactionType: 'ITEM', isSolid: true, visibleIn: WorldType.REALITY,
            onInteract: ({ addItem }) => {
                addItem('Obscure Lens', 'Obscure Lens');
                alert("You picked up the [Obscure Lens]. The forest seems to shift when you hold it.");
            }
        });
    }

    // 2. Talismans (Inner World Only)
    const talismans = [
        { id: 'TALISMAN_1', x: 10, y: 30, hint: "West Clearing" },
        { id: 'TALISMAN_2', x: 30, y: 15, hint: "East Clearing" },
        { id: 'TALISMAN_3', x: 20, y: 35, hint: "Center Path" }
    ];

    talismans.forEach(t => {
        if (!flags.has(t.id)) {
            entities.push({
                id: t.id, x: t.x, y: t.y,
                name: 'Sealed Talisman', color: '#00ffff', interactionType: 'ITEM', isSolid: true, visibleIn: WorldType.INNER_WORLD,
                onInteract: ({ setFlag }) => {
                    setFlag(t.id);
                    alert(`Picked up a Sealed Talisman. It feels cold.`);
                }
            });
            // Hint in Reality
            entities.push({
                id: `hint_${t.id}`, x: t.x, y: t.y,
                name: 'Scorched Ground', color: '#333', interactionType: 'READ', isSolid: false, visibleIn: WorldType.REALITY,
                onInteract: () => alert("The ground here is unnaturally cold. Something is hidden in the Inner World.")
            });
        }
    });

    // 3. Fire Barrier Interaction
    if (!fireCleared) {
         entities.push({
             id: 'fire_barrier', x: 20, y: 11,
             name: 'Blue Fire Barrier', color: 'blue', interactionType: 'PUZZLE', isSolid: true, visibleIn: 'BOTH',
             onInteract: ({ setFlag }) => {
                 if (talismansFound) {
                     setFlag('FIRE_CLEARED');
                     alert("You toss the 3 Talismans into the fire. The blue flames hiss and vanish.");
                 } else {
                     alert("A wall of cold blue fire blocks the path. You need spiritual containment (Talismans) to dispel it.");
                 }
             }
         });
    }

    // 4. Boss: Marisa
    entities.push({
        id: 'boss_marisa', x: 20, y: 5,
        name: 'Depressed Marisa', color: 'yellow', interactionType: 'BATTLE', isSolid: true, visibleIn: 'BOTH',
        onInteract: onMarisaInteract
    });

    // 5. Decor: Bamboo
    for (let i = 0; i < 30; i++) {
        const bx = Math.floor(Math.random() * MAP_WIDTH);
        const by = Math.floor(Math.random() * MAP_HEIGHT);
        if (tiles[by] && tiles[by][bx] === TileType.WALL) {
             entities.push({
                 id: `bamboo_${i}`, x: bx, y: by,
                 name: 'Bamboo', color: 'green', interactionType: 'READ', isSolid: true, visibleIn: 'BOTH',
                 onInteract: () => alert("It's burnt bamboo. It crumbles when touched.")
             });
        }
    }

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

const Stage1Bamboo: React.FC<StageProps> = ({ mapData, worldType, propSprites }) => {
    const isReality = worldType === WorldType.REALITY;
    
    const renderTile = (type: number, x: number, y: number) => {
        const style: React.CSSProperties = {
            position: 'absolute', left: x * TILE_SIZE, top: y * TILE_SIZE,
            width: TILE_SIZE, height: TILE_SIZE,
        };

        if (type === TileType.WATER) { // Blue Fire
            return (
                <div key={`${x}-${y}`} style={style} className="bg-blue-900 animate-pulse flex items-center justify-center overflow-hidden">
                     <div className="w-full h-full bg-blue-500 opacity-50 blur-sm animate-[ping_1s_infinite]"></div>
                     <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
            );
        }

        if (type === TileType.FLOOR) {
             return (
                 <div key={`${x}-${y}`} style={style} className="bg-[#1a0a0a] border border-[#2a1a1a]"></div>
             );
        }

        if (type === TileType.WALL) {
            return (
                <div key={`${x}-${y}`} style={style} className="bg-[#050505] relative overflow-hidden">
                     {/* Bamboo Stalks */}
                     <div className="absolute left-2 top-0 w-2 h-full bg-green-900 border-l border-green-700 opacity-50"></div>
                     <div className="absolute left-8 top-0 w-3 h-full bg-green-900 border-l border-green-700 opacity-30"></div>
                     <div className="absolute right-4 top-0 w-2 h-full bg-green-900 border-l border-green-700 opacity-60"></div>
                </div>
            );
        }

        return null;
    };

    const renderEntity = (entity: MapEntity) => {
        if (entity.visibleIn !== 'BOTH' && entity.visibleIn !== worldType) return null;
        const style: React.CSSProperties = {
            position: 'absolute', left: entity.x * TILE_SIZE, top: entity.y * TILE_SIZE,
            width: TILE_SIZE, height: TILE_SIZE, zIndex: 20
        };

        if (entity.name === 'Bamboo') {
             const sprite = propSprites['PROP_BAMBOO_TREE'];
             return (
                 <div key={entity.id} style={style} className="pointer-events-none -top-16 -left-4 w-[96px] h-[128px]">
                     {sprite ? <img src={sprite} className="w-full h-full object-contain brightness-50 sepia" alt="Bamboo" /> : <div className="w-full h-full bg-green-900/50"></div>}
                 </div>
             );
        }

        if (entity.name === 'Depressed Marisa') {
            const sprite = propSprites['PROP_MARISA_SAD'];
            return (
                 <div key={entity.id} style={style} className="pointer-events-none flex justify-center -top-8">
                     {sprite ? (
                         <img src={sprite} className={`w-[96px] h-[96px] object-contain ${!isReality ? 'invert filter drop-shadow-[0_0_10px_white]' : ''}`} alt="Marisa" />
                     ) : (
                         <div className="w-16 h-16 bg-yellow-600 rounded-full animate-bounce border-2 border-white"></div>
                     )}
                     <div className="absolute -top-12 bg-black/80 text-white text-[10px] px-2 rounded animate-bounce whitespace-nowrap">
                         Zzz... I want to go home...
                     </div>
                 </div>
            );
        }

        if (entity.name === 'Sealed Talisman') {
            return (
                <div key={entity.id} style={style} className="pointer-events-none flex justify-center items-center animate-bounce">
                    <div className="w-8 h-10 bg-yellow-200 border-2 border-red-500 text-red-500 font-bold text-[8px] flex items-center justify-center shadow-[0_0_15px_yellow]">
                        SEAL
                    </div>
                </div>
            );
        }
        
        if (entity.id === 'item_lens_bamboo') {
            return (
              <div key={entity.id} style={style} className="absolute z-20 flex items-center justify-center pointer-events-none animate-pulse">
                   <div className="w-8 h-8 bg-black border-2 border-purple-500 rounded-full flex items-center justify-center shadow-[0_0_15px_purple]">
                       <span className="text-lg">👁️</span>
                   </div>
              </div>
            );
        }

        return <div key={entity.id} style={style} className="flex items-center justify-center text-xl">?</div>;
    };

    return (
        <div className="relative shadow-2xl" style={{ width: mapData.width * TILE_SIZE, height: mapData.height * TILE_SIZE }}>
            {mapData.tiles.map((row, y) => row.map((type, x) => renderTile(type, x, y)))}
            {mapData.entities.map(renderEntity)}
            
            {/* Atmosphere */}
            <div className="absolute inset-0 pointer-events-none bg-red-900/10 mix-blend-multiply"></div>
            {/* Flying Embers */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                 <div className="absolute w-full h-full opacity-50 bg-[url('https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif')] mix-blend-screen"></div>
            </div>
            {!isReality && (
                <div className="absolute inset-0 bg-blue-900/30 mix-blend-color-dodge animate-pulse pointer-events-none"></div>
            )}
        </div>
    );
};

export default Stage1Bamboo;
