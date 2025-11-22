
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
  visualPrompt?: string; // Specific instructions for AI generation (e.g. "Old woman Mokou")
  pixelColor: string; // Fallback color
  bulletColor: string;
  speed: number;
  focusSpeed: number;
  pixelSpriteUrl: string; // Static Asset (Idle Frame)
  pixelSpriteUrlWalk: string; // Static Asset (Walk Frame)
  portraitUrl: string; // Static Asset
}

export interface Enemy {
  name: string;
  hp: number;
  maxHp: number;
  description: string;
  visualPrompt?: string; // Specific instructions for AI generation
  spellCardName: string;
  flavorText: string;
  difficulty: number; // 1-5
  pixelSpriteUrl: string;
  backgroundUrl: string;
}

export interface Scenario {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    themeColor: string;
    enemies: Enemy[];
}

export enum BulletType {
  DOT = 'DOT',
  RICE = 'RICE',      // Elongated, directional
  ORB = 'ORB',        // Glowing round
  BIG = 'BIG',        // Large Bubble
  KNIFE = 'KNIFE',    // Sakuya style
  STAR = 'STAR'       // Marisa style
}

export interface Bullet {
  x: number;
  y: number;
  speed: number;      // Polar physics
  angle: number;      // Polar physics in radians
  accel: number;      // Acceleration per frame
  angularVelocity: number; // Curving per frame
  
  vx?: number;        // Legacy support or linear override
  vy?: number;
  
  color: string;
  radius: number;
  type: BulletType;
  isEnemy: boolean;
  id: number;
  grazed: boolean;    // Track if player has grazed this bullet
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