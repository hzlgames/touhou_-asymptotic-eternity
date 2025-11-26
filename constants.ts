
import { Character, CharacterId, Enemy, Scenario } from './types';

export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 800;

// Game Balance Constants
export const GLOBAL_SPEED_SCALE = 0.8; // Slows down all bullet movement

// Defines the directory names for the local file system
export const ASSET_DIRS = {
    ROOT: 'assets',
    SPRITES: 'sprites',
    PORTRAITS: 'portraits',
    BACKGROUNDS: 'backgrounds',
    AUDIO: 'audio',
    SAVES: 'saves',
    UI: 'DanmakuUI' // New Directory for UI Assets
};

export const FILE_EXT = '.png';
export const SAVE_EXT = '.json';

export const FALLBACK_SPRITE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAALUlEQVRYR+3QQREAAAgCQfYvrWNgBw+ZgS87JLVO056AAQIECBAgQIAAAQIECTwCTyAAyI9F5QAAAABJRU5ErkJggg=='; // Transparent 32x32

export const CHARACTERS: Record<CharacterId, Character> = {
  [CharacterId.KAGUYA]: {
    id: CharacterId.KAGUYA,
    name: 'Kaguya Houraisan',
    description: 'The Eternal Princess. Traditional Japanese hime-cut, multi-layered kimono (junihitoe).',
    visualPrompt: 'Kaguya Houraisan, anime style, wearing elaborate junihitoe kimono, long black hime-cut hair, mysterious smile, holding a stone bowl, moon theme, cyberpunk holographic elements.',
    pixelColor: '#f472b6', 
    bulletColor: '#a78bfa',
    speed: 4.5,
    focusSpeed: 1.5,
    pixelSpriteUrl: '', 
    pixelSpriteUrlWalk: '', 
    portraitUrl: '' 
  },
  [CharacterId.MOKOU]: {
    id: CharacterId.MOKOU,
    name: 'Fujiwara no Mokou',
    description: 'Figure of the Person of Hourai. White hair, red eyes, suspenders, red pants, covered in flame talismans.',
    visualPrompt: 'Fujiwara no Mokou, anime style, white hair, red eyes, wearing red pants and white shirt with suspenders, paper talismans floating around, engulfed in flames, defiant expression, cyberpunk debris background.',
    pixelColor: '#ef4444',
    bulletColor: '#fca5a5',
    speed: 7.5,
    focusSpeed: 3.5,
    pixelSpriteUrl: '',
    pixelSpriteUrlWalk: '',
    portraitUrl: ''
  }
};

// --- STAGE 1: THE OVERCLOCKED ADMINISTRATOR ---
const STAGE_1_REIMU: Enemy = {
    name: 'Administrator Reimu',
    hp: 3000,
    maxHp: 3000,
    description: 'A stressed, overworked Reimu who treats reality as a buggy system.',
    visualPrompt: 'Reimu Hakurei as a cyberpunk system administrator. Anime style. She looks extremely exhausted, dark circles under eyes, messy hair. Wearing a modified miko outfit with ID badges and data cables. Surrounded by floating holographic error windows and red "REJECTED" stamps. Background is a glitched digital shrine.',
    spellCardName: 'Overwork "Deadline Pressure"',
    flavorText: "Ticket #404: Anomaly detected. Executing forced deletion.",
    difficulty: 2,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};

const STAGE_1_MARISA: Enemy = {
    name: 'Depressed Marisa (Mirror)',
    hp: 3000,
    maxHp: 3000,
    description: 'A cowardly Marisa who gave up magic.',
    visualPrompt: 'Marisa Kirisame, anime style, looking depressed and scared, wearing plain brown villager clothes, no hat, holding a broken broom, sitting in a dark dusty library, crying.',
    spellCardName: 'Escape "Retreating Stardust"',
    flavorText: "Magic is too dangerous... I just want to go home...",
    difficulty: 2,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};

// --- STAGE 2: THE HATED RIVALS (ILLUSIONS) ---
const STAGE_2_MOKOU_ILLUSION: Enemy = {
    name: 'Vengeful Mokou (Illusion)',
    hp: 5000,
    maxHp: 5000,
    description: 'A twisted version of Mokou consumed by hatred.',
    visualPrompt: 'Fujiwara no Mokou, anime style, berserk mode, skin cracking with magma, eyes glowing pure white, surrounded by black flames, screaming in rage.',
    spellCardName: 'Curse "Everlasting Vendetta"',
    flavorText: "DIE! DIE! DIE! WHY WON'T YOU STAY DEAD!?",
    difficulty: 3,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};

const STAGE_2_KAGUYA_ILLUSION: Enemy = {
    name: 'Tyrant Kaguya (Illusion)',
    hp: 5000,
    maxHp: 5000,
    description: 'A cold, moon-obsessed version of Kaguya.',
    visualPrompt: 'Kaguya Houraisan, anime style, looking down with extreme contempt, eyes glowing cold blue, sitting on a throne of ice, radiating freezing aura.',
    spellCardName: 'Cold Moon "Absolute Submission"',
    flavorText: "Filthy earthling. Bow before the Moon.",
    difficulty: 3,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};

// --- STAGE 3 & 4: THE LUNAR CONSPIRACY ---
const STAGE_3_REISEN: Enemy = {
    name: 'Glitch Reisen (Insane)',
    hp: 8000,
    maxHp: 8000,
    description: 'Reisen with fractured sanity from parallel worlds.',
    visualPrompt: 'Reisen Udongein Inaba, anime style, glitch art effect, red eyes glowing intensely, multiple transparent arms, distorted reality background, holding a megaphone.',
    spellCardName: 'Wave Sign "Schrödinger\'s Pulse"',
    flavorText: "I can hear all the timelines... stop the noise...",
    difficulty: 4,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};

const STAGE_4_EIRIN: Enemy = {
    name: 'Shadow Eirin',
    hp: 10000,
    maxHp: 10000,
    description: 'A manifestation of Eirin\'s regret.',
    visualPrompt: 'Eirin Yagokoro, anime style, as a dark silhouette with glowing blue outline, surgical tools floating ominously, astronomical background, cold expression.',
    spellCardName: 'Forbidden Drug "Memory Erasure"',
    flavorText: "The impurity must be surgically removed.",
    difficulty: 4,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};

// --- STAGE 5: THE CRUEL ALTERNATIVES ---
const STAGE_5_HUMAN_MOKOU: Enemy = {
    name: 'Human Mokou (The End)',
    hp: 12000,
    maxHp: 12000,
    description: 'An elderly, happy version of Mokou who lived a normal life.',
    visualPrompt: 'Fujiwara no Mokou as an old grandmother, anime style, white hair tied in a bun, wrinkles on face, peaceful kind smile, wearing simple peasant clothes, sitting in a rocking chair knitting. Warm lighting.',
    spellCardName: 'Life End "Peaceful Death"',
    flavorText: "Oh, Kaguya-sama? I've lived a good life. Please, let me rest.",
    difficulty: 5,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};

const STAGE_5_MOON_KAGUYA: Enemy = {
    name: 'Moon Princess Kaguya',
    hp: 12000,
    maxHp: 12000,
    description: 'Kaguya returning to the moon, leaving the earth behind.',
    visualPrompt: 'Kaguya Houraisan, anime style, ascending to the sky on a glowing cloud, wearing magnificent celestial robes, looking back with a tearful but distant expression, full moon background.',
    spellCardName: 'Farewell "Return to the Capital"',
    flavorText: "Goodbye, Mokou. I am going back to where I belong.",
    difficulty: 5,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};

// --- STAGE 6: THE FINAL TRUTH ---
const STAGE_6_CONCEPT: Enemy = {
    name: 'Hourai Gestalt',
    hp: 20000,
    maxHp: 20000,
    description: 'The fusion of Kaguya and Mokou in the mirror.',
    visualPrompt: 'Abstract fusion of Kaguya and Mokou, anime style, half body fire and half body moon light, cosmic background, holding a broken mirror, god-like entity.',
    spellCardName: 'Last Word "Dance on the Burning Moon"',
    flavorText: "We are the asymptotic lines. We burn forever.",
    difficulty: 6,
    pixelSpriteUrl: '',
    backgroundUrl: ''
};


// --- SCENARIO CONFIGURATIONS ---

export const SCENARIOS: Record<CharacterId, Scenario> = {
    [CharacterId.KAGUYA]: {
        id: 'BLUE_CHAPTER',
        title: 'Blue Chapter',
        subtitle: 'The Loss of Eternity',
        description: 'Explore the "Admin District" where Reimu enforces absolute order with bureaucratic rage.',
        themeColor: '#0B0B3B',
        locationName: 'Admin District: Route 404',
        locationVisualPrompt: 'Anime background art of the Hakurei Shrine path converted into a high-tech bureaucratic construction site. Yellow caution tape everywhere. Numbered trees. White steam rising. Fluorescent lighting. Oppressive atmosphere.',
        enemies: [
            STAGE_1_REIMU,
            STAGE_2_MOKOU_ILLUSION,
            STAGE_3_REISEN,
            STAGE_4_EIRIN,
            STAGE_5_HUMAN_MOKOU,
            STAGE_6_CONCEPT
        ]
    },
    [CharacterId.MOKOU]: {
        id: 'RED_CHAPTER',
        title: 'Red Chapter',
        subtitle: 'The Illusion of Death',
        description: 'Hunt the culprit in a nightmare where you might actually die. You despise the "Easy Way Out".',
        themeColor: '#2A0A0A',
        locationName: 'Burning Bamboo Forest',
        locationVisualPrompt: 'Top down RPG map background of a bamboo forest at night, consumed by blue and red spectral flames. Floating paper talismans everywhere. Cyberpunk digital glitch effects on the bamboo. High detail 2D game art.',
        enemies: [
            STAGE_1_MARISA,
            STAGE_2_KAGUYA_ILLUSION,
            STAGE_3_REISEN,
            STAGE_4_EIRIN,
            STAGE_5_MOON_KAGUYA,
            STAGE_6_CONCEPT
        ]
    }
};

// For backward compatibility
export const ENEMIES = [...SCENARIOS[CharacterId.KAGUYA].enemies, ...SCENARIOS[CharacterId.MOKOU].enemies];
