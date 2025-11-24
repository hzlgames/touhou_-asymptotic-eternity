
export enum GameState {
  MENU = 'MENU',
  EXPLORATION = 'EXPLORATION',
  BATTLE = 'BATTLE',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum CharacterId {
  KAGUYA = 'KAGUYA',
  MOKOU = 'MOKOU'
}

export interface Character {
  id: CharacterId;
  name: string;
  description: string;
  visualPrompt?: string; 
  pixelColor: string; 
  bulletColor: string;
  speed: number;
  focusSpeed: number;
  pixelSpriteUrl: string; 
  pixelSpriteUrlWalk: string; 
  portraitUrl: string; 
}

export interface Enemy {
  name: string;
  hp: number;
  maxHp: number;
  description: string;
  visualPrompt?: string; 
  spellCardName: string;
  flavorText: string;
  difficulty: number; 
  pixelSpriteUrl: string;
  backgroundUrl: string;
}

export interface Scenario {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    themeColor: string;
    locationName: string;
    locationVisualPrompt: string;
    enemies: Enemy[];
}

export enum BulletType {
  DOT = 'DOT',
  RICE = 'RICE',      
  ORB = 'ORB',        
  BIG = 'BIG',        
  KNIFE = 'KNIFE',    
  STAR = 'STAR'       
}

export interface Bullet {
  x: number;
  y: number;
  speed: number;      
  angle: number;      
  accel: number;      
  angularVelocity: number; 
  
  vx?: number;        
  vy?: number;
  
  color: string;
  radius: number;
  type: BulletType;
  isEnemy: boolean;
  id: number;
  grazed: boolean;    
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  alpha: number;
}

// --- NEW MAP SYSTEM TYPES ---

export enum TileType {
  EMPTY = 0,
  WALL = 1,
  FLOOR = 2,
  DECORATION = 3,
  DOOR = 4,
  VOID = 5,
  PATH = 6,
  LOCKED_DOOR = 7,
  PILLAR = 8,
  
  // Advanced Puzzle Tiles
  LANTERN = 9,     
  SEAL = 10,       
  WATER = 11,
  BRIDGE = 12,
  BOOKSHELF = 13,
  FURNACE = 14,
  STATUE = 15,
  ASHES = 16,

  // Kaguya Route Specific
  GOLD_FLOOR = 17,
  CHARM_WALL = 18,
  MOON_GATE = 19,
  PAINTING = 20,
  SECRET_DOOR = 21
}

export enum WorldType {
  REALITY = 'REALITY',
  INNER_WORLD = 'INNER_WORLD' // The "Lens" view
}

export interface MapTrigger {
    type: 'TELEPORT' | 'DIALOGUE' | 'DAMAGE';
    targetX?: number;
    targetY?: number;
    message?: string;
    condition?: (flags: Set<string>) => boolean;
    flashEffect?: boolean;
}

export interface InteractionHelpers {
    setFlag: (f: string) => void;
    removeFlag: (f: string) => void; // New helper
    hasFlag: (f: string) => boolean;
    addItem: (id: string, name: string) => void;
    hasItem: (id: string) => boolean;
    worldType: WorldType;
}

export interface MapEntity {
  id: string;
  x: number; // Grid coordinates
  y: number;
  width?: number; // Size in tiles (default 1)
  height?: number;
  name: string;
  sprite?: string;
  color: string;
  interactionType: 'DIALOGUE' | 'BATTLE' | 'ITEM' | 'PUZZLE' | 'READ';
  onInteract?: (helpers: InteractionHelpers) => void;
  isSolid: boolean;
  visibleIn: WorldType | 'BOTH'; // Which world is this entity visible in?
  reqFlag?: string; // Only visible if flag exists
  hideFlag?: string; // Hidden if flag exists
  
  // Custom Data for Puzzles
  rotation?: number; // 0=Up, 1=Right, 2=Down, 3=Left
}

export interface MapData {
  width: number;
  height: number;
  tiles: number[][]; // [y][x]
  entities: MapEntity[];
  triggers: Record<string, MapTrigger>; // Key: "x,y"
  spawnPoint: { x: number, y: number };
  objectiveText: string; // New: Current goal guidance
}

export interface StageProps {
    mapData: MapData;
    worldType: WorldType;
}
