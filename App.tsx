


import React, { useState, useEffect } from 'react';
import Exploration from './components/Exploration';
import DanmakuBattle from './components/DanmakuBattle';
import { Character, CharacterId, Enemy, GameState, Scenario, SaveData } from './types';
import { CHARACTERS, SCENARIOS, FALLBACK_SPRITE } from './constants';
import { getOrGenerateAsset } from './services/geminiService';
import { 
    connectFileSystem, 
    isFileSystemConnected, 
    saveAssetToFS, 
    loadAssetFromFS, 
    AssetType,
    getSavedGames,
    saveGameData,
    loadGameData
} from './services/assetStorage';

// Helper to prevent infinite loading screens
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
            console.warn(`[App] Operation timed out after ${ms}ms`);
            resolve(fallback);
        }, ms))
    ]);
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [selectedCharId, setSelectedCharId] = useState<CharacterId>(CharacterId.KAGUYA);
  const [currentScenario, setCurrentScenario] = useState<Scenario>(SCENARIOS[CharacterId.KAGUYA]);
  const [activeEnemy, setActiveEnemy] = useState<Enemy | null>(null);
  const [hasFsAccess, setHasFsAccess] = useState(false);

  // Persistence State
  const [savedExplorationState, setSavedExplorationState] = useState<SaveData | undefined>(undefined);
  const [saveFiles, setSaveFiles] = useState<string[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);

  // Store Asset Info
  const [loadedAssets, setLoadedAssets] = useState<{
      sprites: Record<string, { url: string, isLocal: boolean }>,
      portraits: Record<string, { url: string, isLocal: boolean }>,
      enemySprites: Record<string, { url: string, isLocal: boolean }>,
      backgrounds: Record<string, { url: string, isLocal: boolean }>,
      props: Record<string, { url: string, isLocal: boolean }>
  }>({
      sprites: {},
      portraits: {},
      enemySprites: {},
      backgrounds: {},
      props: {}
  });

  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  // --- Asset Logic ---

  const fetchAsset = async (id: string, name: string, desc: string, type: AssetType, visualPrompt?: string) => {
    // 1. Try Local FS first if connected
    if (hasFsAccess) {
        const fsUrl = await loadAssetFromFS(id, type);
        if (fsUrl) {
            console.log(`[App] Loaded local asset: ${name} (ID: ${id})`);
            return { url: fsUrl, isLocal: true };
        }
    }
    
    // 2. Generate with Timeout (20s max)
    console.log(`[App] Generating asset: ${name} (ID: ${id})`);
    const result = await withTimeout(
        getOrGenerateAsset(id, name, desc, type, visualPrompt),
        20000, 
        null
    );

    // 3. Save if successful and FS connected
    if (result && !result.isLocal && hasFsAccess) {
        try {
            setLoadingStatus(`Saving ${name} to local storage...`);
            // CRITICAL: Await the save to ensure it writes before we move on
            await saveAssetToFS(id, type, result.url);
            console.log(`[App] Saved ${name} to file system.`);
            return { url: result.url, isLocal: true };
        } catch (e) { 
            console.error(`[App] Auto-save failed for ${name}:`, e);
            // Return the memory URL anyway so the game continues
            return { url: result.url, isLocal: false };
        }
    }
    return result;
  };

  const updateAssetRecord = (id: string, type: AssetType, result: { url: string, isLocal: boolean }) => {
      setLoadedAssets(prev => {
          const next = { ...prev };
          if (type === 'portrait') next.portraits = { ...prev.portraits, [id]: result };
          else if (type === 'background') next.backgrounds = { ...prev.backgrounds, [id]: result };
          else if (type === 'sprite') {
              next.sprites = { ...prev.sprites, [id]: result };
              // Sort into sub-categories for easier lookup
              const isChar = Object.values(CharacterId).includes(id as any);
              if (!isChar) {
                  if (id.startsWith('PROP_')) {
                      next.props = { ...prev.props, [id]: result };
                  } else {
                      next.enemySprites = { ...prev.enemySprites, [id]: result };
                  }
              }
          }
          return next;
      });
  };

  const loadCharacterAssets = async (charId: CharacterId) => {
    const char = CHARACTERS[charId];
    setLoadingStatus(`Awakening ${char.name}...`);
    
    // Request 4x4 Sprite Sheet for Animation
    // We use a new ID suffix to distinguish from old 3x3 sheets
    const spriteId = `${char.id}_SHEET_4x4`;
    const spritePrompt = `${char.visualPrompt} GRID_4x4`; 

    const sprite = await fetchAsset(spriteId, char.name, char.description, 'sprite', spritePrompt);
    if (sprite) updateAssetRecord(spriteId, 'sprite', sprite);
    
    const portrait = await fetchAsset(char.id, char.name, char.description, 'portrait', char.visualPrompt);
    if (portrait) updateAssetRecord(char.id, 'portrait', portrait);
    
    // Load Scenario Background
    const scenario = SCENARIOS[charId];
    setLoadingStatus(`Materializing ${scenario.locationName}...`);
    const bg = await fetchAsset(
        `${scenario.id}_MAP`, 
        scenario.locationName, 
        scenario.description, 
        'background', 
        scenario.locationVisualPrompt
    );
    if (bg) updateAssetRecord(`${scenario.id}_MAP`, 'background', bg);

    // Load Stage Props
    if (charId === CharacterId.KAGUYA) {
        setLoadingStatus("Generating Cyberpunk Props...");
        const propList = [
            { id: 'PROP_ASSET_TREE', name: 'Asset Tree', desc: 'A tree with a barcode.', prompt: 'Object on transparent background. Pixel art cyberpunk tree...' },
            { id: 'PROP_GOHEI', name: 'Gohei Barrier', desc: 'A shinto wand used as a fence.', prompt: 'Object on transparent background. Pixel art Shinto Gohei wand...' },
            { id: 'PROP_DIGITAL_TORII', name: 'Digital Torii', desc: 'A cyberpunk Torii gate.', prompt: 'Object on transparent background. Large pixel art Torii gate...' },
            { id: 'PROP_SHRINE_OFFICE', name: 'Admin Shrine Desk', desc: 'A massive shrine altar converted into a desk.', prompt: 'Object on transparent background. Huge pixel art structure...' },
            { id: 'PROP_SHREDDER', name: 'Donation Shredder', desc: 'A donation box that is a shredder.', prompt: 'Object on transparent background. Pixel art wooden offertory box...' },
            { id: 'PROP_REIMU_WORK', name: 'Working Reimu', desc: 'Reimu typing at a desk.', prompt: 'Character on transparent background. Pixel art Reimu Hakurei sitting at a desk...' }
        ];

        for (const p of propList) {
             const asset = await fetchAsset(p.id, p.name, p.desc, 'sprite', p.prompt);
             if (asset) updateAssetRecord(p.id, 'sprite', asset);
        }

        // PRELOAD Stage 1 Boss BG for Kaguya
        setLoadingStatus("Generating Admin Tunnel...");
        const bossBg = await fetchAsset(
            'STAGE1_BOSS_BG',
            'Bureaucratic Tunnel',
            'A scrolling tunnel of paperwork.',
            'background',
            'Anime background art. A futuristic cyber-tunnel lined with millions of flying papers, red "ERROR" windows, and glowing fiber optic cables. High speed motion blur.'
        );
        if (bossBg) updateAssetRecord('STAGE1_BOSS_BG', 'background', bossBg);

    } else if (charId === CharacterId.MOKOU) {
         setLoadingStatus("Generating Bamboo Nightmare...");
         const propList = [
            { id: 'PROP_BAMBOO_TREE', name: 'Burnt Bamboo', desc: 'A burnt bamboo stalk.', prompt: 'Object on transparent background. Pixel art single bamboo stalk...' },
            { id: 'PROP_MARISA_SAD', name: 'Depressed Marisa', desc: 'Marisa sitting on the ground.', prompt: 'Character on transparent background. Pixel art Marisa Kirisame sitting...' }
         ];
         for (const p of propList) {
            const asset = await fetchAsset(p.id, p.name, p.desc, 'sprite', p.prompt);
            if (asset) updateAssetRecord(p.id, 'sprite', asset);
        }
    }

    setLoadingStatus(null);
  };

  const loadCommonAssets = async () => {
    // Only load if not already present
    if (loadedAssets.sprites['BULLET_TICKET']) return;

    setLoadingStatus("Compiling Combat Materials...");
    
    // List of special assets to generate
    const assets = [
        { id: 'ENEMY_FAIRY', name: 'Enemy: Fairy', desc: 'Standard fairy unit.', prompt: 'Pixel art anime fairy with robotic wings, holding a spear, chibi style, full body.' },
        { id: 'BULLET_TICKET', name: 'Bullet: Invoice', desc: 'A flying tax document.', prompt: 'Pixel art red rectangular paper invoice document, glowing, cyberpunk style.' },
        { id: 'BULLET_CUP', name: 'Bullet: Tea Cup', desc: 'A ceramic cup.', prompt: 'Pixel art white japanese tea cup, side view.' },
        { id: 'BULLET_SHARD', name: 'Bullet: Shard', desc: 'A sharp fragment.', prompt: 'Pixel art jagged shard of blue glowing glass, sharp edges.' },
        { id: 'BULLET_GLITCH', name: 'Bullet: Glitch', desc: 'Digital noise.', prompt: 'Pixel art square of colorful tv static noise, glitch effect.' },
        { id: 'BULLET_OFUDA', name: 'Bullet: Talisman', desc: 'Paper charm.', prompt: 'Pixel art red paper charm ofuda with black ink calligraphy, vertical.' }
    ];

    for (const a of assets) {
        // We reuse the 'sprite' type which maps to loadedAssets.sprites
        const res = await fetchAsset(a.id, a.name, a.desc, 'sprite', a.prompt);
        if (res) updateAssetRecord(a.id, 'sprite', res);
    }
    
    setLoadingStatus(null);
  };

  const loadEnemyAssets = async (enemy: Enemy) => {
      try {
          setLoadingStatus(`Manifesting Boss: ${enemy.name}...`);
          
          // 1. Sprite
          const sprite = await fetchAsset(enemy.name, enemy.name, enemy.description, 'sprite', enemy.visualPrompt);
          if (sprite) updateAssetRecord(enemy.name, 'sprite', sprite);

          // 2. Portrait (NEW)
          setLoadingStatus(`Visualizing Entity: ${enemy.name}...`);
          const portrait = await fetchAsset(enemy.name, enemy.name, enemy.description, 'portrait', enemy.visualPrompt);
          if (portrait) updateAssetRecord(enemy.name, 'portrait', portrait);

          // 3. Background
          // Force usage of STAGE1_BOSS_BG for Reimu if available
          if (enemy.name.includes("Reimu")) {
               const bg = await fetchAsset(
                    'STAGE1_BOSS_BG', 
                    'Bureaucratic Tunnel', 
                    'Tunnel of paperwork', 
                    'background',
                    'Anime background art. A futuristic cyber-tunnel lined with millions of flying papers, red "ERROR" windows, and glowing fiber optic cables. High speed motion blur.'
               );
               if (bg) updateAssetRecord('STAGE1_BOSS_BG', 'background', bg);
          } else {
              const bgPrompt = enemy.visualPrompt ? `${enemy.visualPrompt} (Atmospheric Background)` : enemy.description;
              const bg = await fetchAsset(`${enemy.name}_BG`, `${enemy.name} Location`, bgPrompt, 'background', bgPrompt);
              if (bg) updateAssetRecord(`${enemy.name}_BG`, 'background', bg);
          }
      } catch (error) {
          console.error("Critical error loading enemy assets:", error);
      } finally {
          setLoadingStatus(null);
      }
  };

  const handleFileSystemConnect = async () => {
      const success = await connectFileSystem();
      setHasFsAccess(success);
  };

  // --- Interaction Handlers ---

  const prepareGame = async (id: CharacterId) => {
    setSelectedCharId(id);
    const scenario = SCENARIOS[id];
    setCurrentScenario(scenario);
    
    // Check for Sprite Sheet Existence
    const sheetId = `${id}_SHEET_4x4`;
    const basicReady = loadedAssets.sprites[sheetId] && loadedAssets.portraits[id] && loadedAssets.backgrounds[`${scenario.id}_MAP`];
    let propsReady = true;
    if (id === CharacterId.KAGUYA) {
        propsReady = !!(loadedAssets.props['PROP_ASSET_TREE'] && loadedAssets.props['PROP_SHRINE_OFFICE']);
    } else if (id === CharacterId.MOKOU) {
         propsReady = !!(loadedAssets.props['PROP_BAMBOO_TREE']);
    }

    if (!basicReady || !propsReady) {
        await loadCharacterAssets(id);
    }
    
    await loadCommonAssets();
  };

  const handleCharacterSelect = async (id: CharacterId) => {
    setSavedExplorationState(undefined); // Reset previous state on new game
    await prepareGame(id);
    setGameState(GameState.EXPLORATION);
  };

  const handleLoadGame = async (filename: string) => {
      setShowLoadMenu(false);
      setLoadingStatus(`Loading ${filename}...`);
      const data = await loadGameData(filename);
      if (data) {
          setSavedExplorationState(data);
          await prepareGame(data.characterId);
          setGameState(GameState.EXPLORATION);
      } else {
          alert("Failed to load save file.");
      }
      setLoadingStatus(null);
  };

  const handleSaveGame = async (data: SaveData) => {
      await saveGameData(data);
      // Update local cache of Exploration state so if player returns to menu and back without full reload, it's consistent
      setSavedExplorationState(data);
  };

  const handleEncounter = async (enemy: Enemy, snapshot: SaveData) => {
    if (loadingStatus) return; // Prevent double trigger
    
    // Save the snapshot of exploration state
    setSavedExplorationState(snapshot);

    setLoadingStatus(`Encounter initiated: ${enemy.name}`);
    await loadEnemyAssets(enemy);
    setActiveEnemy(enemy);
    setGameState(GameState.BATTLE);
    setLoadingStatus(null);
  };

  // Return to Map Logic
  const handleRetreat = () => {
      setGameState(GameState.EXPLORATION);
      setActiveEnemy(null);
  };

  const handleVictory = () => setGameState(GameState.VICTORY);
  const handleDefeat = () => setGameState(GameState.GAME_OVER);
  const handleQuitToTitle = () => {
      setGameState(GameState.MENU);
      setSavedExplorationState(undefined);
      setActiveEnemy(null);
  };

  const getCurrentCharacter = (): Character => {
      const base = CHARACTERS[selectedCharId];
      // Lookup the Sheet ID
      const sheetId = `${selectedCharId}_SHEET_4x4`;
      return {
          ...base,
          // Use the Sheet URL if available, otherwise fallback
          pixelSpriteUrl: loadedAssets.sprites[sheetId]?.url || loadedAssets.sprites[selectedCharId]?.url || FALLBACK_SPRITE,
          pixelSpriteUrlWalk: '', // Deprecated in favor of sheet
          portraitUrl: loadedAssets.portraits[selectedCharId]?.url || FALLBACK_SPRITE,
          spriteSheetType: loadedAssets.sprites[sheetId] ? 'GRID_4x4' : 'SINGLE'
      };
  };

  const getCurrentEnemy = (): Enemy | null => {
      if (!activeEnemy) return null;
      let bgUrl = loadedAssets.backgrounds[activeEnemy.name]?.url || '';
      
      if (activeEnemy.name.includes('Reimu') && loadedAssets.backgrounds['STAGE1_BOSS_BG']) {
          bgUrl = loadedAssets.backgrounds['STAGE1_BOSS_BG'].url;
      } else if (!bgUrl && loadedAssets.backgrounds[`${activeEnemy.name}_BG`]) {
          bgUrl = loadedAssets.backgrounds[`${activeEnemy.name}_BG`].url;
      }

      return {
          ...activeEnemy,
          pixelSpriteUrl: loadedAssets.enemySprites[activeEnemy.name]?.url || FALLBACK_SPRITE,
          backgroundUrl: bgUrl,
          portraitUrl: loadedAssets.portraits[activeEnemy.name]?.url
      };
  };

  const getPropSprites = () => {
      const result: Record<string, string> = {};
      Object.entries(loadedAssets.props).forEach(([key, val]) => {
          result[key] = val.url;
      });
      if (loadedAssets.sprites['PROP_REIMU_WORK']) {
          result['PROP_REIMU_WORK'] = loadedAssets.sprites['PROP_REIMU_WORK'].url;
      }
      return result;
  };
  
  const getSpriteMap = () => {
      const result: Record<string, string> = {};
      Object.entries(loadedAssets.sprites).forEach(([key, val]) => {
          result[key] = val.url;
      });
      return result;
  };

  const handleOpenLoadMenu = async () => {
      if (!hasFsAccess) {
          const success = await connectFileSystem();
          if (!success) {
              setHasFsAccess(false);
              return;
          }
          setHasFsAccess(true);
      }
      const files = await getSavedGames();
      setSaveFiles(files);
      setShowLoadMenu(true);
  };

  // --- Render ---

  const renderContent = () => {
    if (loadingStatus) {
        return (
            <div className="min-h-screen bg-[#0B0B3B] flex flex-col items-center justify-center text-white font-serif z-50 fixed inset-0">
                <div className="text-6xl mb-8 animate-[spin_4s_linear_infinite] opacity-80 text-[#FFD700]">☯</div>
                <div className="text-2xl animate-pulse text-blue-200 mb-4 tracking-[0.3em]">ACCESSING AKASHIC RECORDS</div>
                <div className="text-white text-lg font-mono border-y border-blue-500/30 py-2 px-10 bg-black/40">{loadingStatus}</div>
            </div>
        )
    }

    if (showLoadMenu) {
        return (
            <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center font-serif text-white">
                <h2 className="text-3xl text-blue-300 mb-8 border-b border-blue-500 pb-2">LOAD RECORD</h2>
                <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto w-full max-w-md bg-white/5 border border-gray-700 p-4">
                    {saveFiles.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">NO RECORDS FOUND</div>
                    ) : (
                        saveFiles.map(file => (
                            <button 
                                key={file}
                                onClick={() => handleLoadGame(file)}
                                className="text-left px-4 py-3 hover:bg-blue-900/50 border border-transparent hover:border-blue-500 font-mono text-sm transition-colors"
                            >
                                {file}
                            </button>
                        ))
                    )}
                </div>
                <button 
                    onClick={() => setShowLoadMenu(false)}
                    className="mt-8 px-8 py-2 border border-gray-500 text-gray-400 hover:text-white hover:border-white transition-colors"
                >
                    CANCEL
                </button>
            </div>
        );
    }

    switch (gameState) {
      case GameState.MENU:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0B3B] text-white p-4 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
            <div className="max-w-6xl w-full flex flex-col items-center relative z-10">
                <div className="mb-12 text-center">
                     <h1 className="text-5xl md:text-7xl font-serif mb-2 text-transparent bg-clip-text bg-gradient-to-b from-[#E0E0E6] to-[#7B7B8B] tracking-widest drop-shadow-[0_0_20px_rgba(224,224,230,0.4)]">
                        東方虚鏡抄
                     </h1>
                     <h2 className="text-xl md:text-3xl text-[#FFD700] font-serif tracking-[0.2em] mb-6 uppercase opacity-80">
                        Reflection of Eternal Spirality
                     </h2>
                </div>
                
                <div className="mb-12 flex flex-col items-center gap-4">
                    {!hasFsAccess ? (
                        <button 
                            onClick={handleFileSystemConnect}
                            className="border border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700] hover:text-black px-8 py-2 font-mono text-xs tracking-widest transition-all duration-300 shadow-[0_0_15px_rgba(255,215,0,0.3)] animate-pulse"
                        >
                            [ INITIALIZE LOCAL STORAGE ]
                        </button>
                    ) : (
                         <div className="text-green-400 font-mono text-xs tracking-widest border border-green-800 px-4 py-2 bg-black/50">
                             SYSTEM LINK: STABLE (Assets will be saved)
                         </div>
                    )}
                    
                    <button 
                        onClick={handleOpenLoadMenu}
                        className="border border-blue-500 text-blue-300 hover:bg-blue-900 hover:text-white px-12 py-3 font-mono text-sm tracking-widest transition-all duration-300"
                    >
                        LOAD GAME
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-5xl px-8">
                {Object.values(CHARACTERS).map((char) => {
                    const isKaguya = char.id === CharacterId.KAGUYA;
                    const scenario = SCENARIOS[char.id];
                    return (
                    <div 
                        key={char.id}
                        onClick={() => handleCharacterSelect(char.id)}
                        className={`relative group cursor-pointer border-2 transition-all duration-500 p-8 bg-black/40 backdrop-blur-sm overflow-hidden
                            ${isKaguya 
                                ? 'border-blue-500/30 hover:border-blue-400 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)]' 
                                : 'border-red-500/30 hover:border-red-400 hover:shadow-[0_0_40px_rgba(239,68,68,0.2)]'
                            }
                        `}
                    >
                        <div className="absolute top-4 left-4 text-xs tracking-[0.3em] opacity-50 font-bold">
                            {isKaguya ? 'ROUTE A' : 'ROUTE B'}
                        </div>
                        <h2 className={`text-3xl font-serif mt-6 mb-2 ${isKaguya ? 'text-blue-200' : 'text-red-200'}`}>
                            {scenario.title}
                        </h2>
                        <div className={`w-full aspect-square border ${isKaguya ? 'border-blue-900' : 'border-red-900'} bg-black/50 mb-6 relative flex items-center justify-center`}>
                             {loadedAssets.portraits[char.id] ? (
                                 <img src={loadedAssets.portraits[char.id].url} className="w-full h-full object-cover opacity-80" alt={char.name} />
                             ) : <span className="text-4xl opacity-20">?</span>}
                        </div>
                        <div className="mt-6 py-3 text-center text-xs font-bold tracking-[0.2em] border border-gray-700 text-gray-400 group-hover:bg-white/10">
                            NEW GAME
                        </div>
                    </div>
                )})}
                </div>
            </div>
          </div>
        );

      case GameState.EXPLORATION:
        return (
          <Exploration 
            // We use timestamp as key to force a full re-mount when loading a save
            key={savedExplorationState ? `loaded-${savedExplorationState.timestamp}` : 'new-game'}
            character={getCurrentCharacter()} 
            scenarioEnemies={currentScenario.enemies}
            onEncounter={handleEncounter}
            onSave={handleSaveGame}
            onQuit={handleQuitToTitle}
            backgroundUrl={loadedAssets.backgrounds[`${currentScenario.id}_MAP`]?.url}
            propSprites={getPropSprites()}
            initialState={savedExplorationState}
          />
        );

      case GameState.BATTLE:
        if (!activeEnemy) return null;
        return (
          <DanmakuBattle
            character={getCurrentCharacter()}
            enemy={getCurrentEnemy()!}
            onVictory={handleVictory}
            onDefeat={handleDefeat}
            onRetreat={handleRetreat}
            onQuit={handleQuitToTitle}
            sprites={getSpriteMap()}
          />
        );

      case GameState.VICTORY:
      case GameState.GAME_OVER:
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white relative font-serif">
                <h1 className={`text-6xl mb-8 tracking-[0.2em] ${gameState === GameState.VICTORY ? 'text-yellow-500' : 'text-red-600'}`}>
                    {gameState === GameState.VICTORY ? 'PHANTASM CLEARED' : 'GAME OVER'}
                </h1>
                <button 
                  onClick={handleQuitToTitle}
                  className="px-8 py-3 border border-white/50 hover:bg-white hover:text-black transition-colors"
                >
                  RETURN TO TITLE
                </button>
            </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="antialiased bg-[#050510] min-h-screen selection:bg-[#FFD700] selection:text-black">
      {renderContent()}
    </div>
  );
};

export default App;