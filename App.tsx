
import React, { useState, useEffect } from 'react';
import Exploration from './components/Exploration';
import DanmakuBattle from './components/DanmakuBattle';
import { Character, CharacterId, Enemy, GameState, Scenario } from './types';
import { CHARACTERS, SCENARIOS, FALLBACK_SPRITE } from './constants';
import { getOrGenerateAsset } from './services/geminiService';
import { 
    connectFileSystem, 
    isFileSystemConnected, 
    saveAssetToFS, 
    downloadAssetLegacy, 
    loadAssetFromFS, 
    AssetType 
} from './services/assetStorage';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [selectedCharId, setSelectedCharId] = useState<CharacterId>(CharacterId.KAGUYA);
  const [currentScenario, setCurrentScenario] = useState<Scenario>(SCENARIOS[CharacterId.KAGUYA]);
  const [activeEnemy, setActiveEnemy] = useState<Enemy | null>(null);
  const [hasFsAccess, setHasFsAccess] = useState(false);

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
    if (hasFsAccess) {
        const fsUrl = await loadAssetFromFS(id, type);
        if (fsUrl) return { url: fsUrl, isLocal: true };
    }
    const result = await getOrGenerateAsset(id, name, desc, type, visualPrompt);

    if (result && !result.isLocal && hasFsAccess) {
        try {
            setLoadingStatus(`Writing to Reality Layer: ${name}...`);
            const success = await saveAssetToFS(id, type, result.url);
            if (success) {
                console.log(`[App] Saved ${name} to ${type} folder.`);
                return { url: result.url, isLocal: true };
            }
        } catch (e) { console.error("Auto-save failed", e); }
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
    const sprite = await fetchAsset(char.id, char.name, char.description, 'sprite', char.visualPrompt);
    if (sprite) updateAssetRecord(char.id, 'sprite', sprite);
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

    // Load Stage Props (New)
    if (charId === CharacterId.KAGUYA) {
        setLoadingStatus("Generating Cyberpunk Props...");
        
        // 1. Asset Tree
        const tree = await fetchAsset(
            'PROP_ASSET_TREE', 
            'Asset Tree', 
            'A tree with a barcode.', 
            'sprite', 
            'Object on transparent background. Pixel art cyberpunk tree, dead branches, glowing digital barcode tag attached to trunk. High contrast, neon green accents. Transparent background.'
        );
        if (tree) updateAssetRecord('PROP_ASSET_TREE', 'sprite', tree);

        // 2. Gohei Barrier
        const gohei = await fetchAsset(
            'PROP_GOHEI',
            'Gohei Barrier',
            'A shinto wand used as a fence.',
            'sprite',
            'Object on transparent background. Pixel art Shinto Gohei wand stuck in the ground vertically. The paper streamers are glowing neon red. Cyberpunk style. Transparent background.'
        );
        if (gohei) updateAssetRecord('PROP_GOHEI', 'sprite', gohei);

        // 3. Digital Torii
        const torii = await fetchAsset(
            'PROP_DIGITAL_TORII',
            'Digital Torii',
            'A cyberpunk Torii gate.',
            'sprite',
            'Object on transparent background. Large pixel art Torii gate made of metallic server racks and glowing blue neon lights. High tech, sci-fi Shinto style. Front view. Transparent background.'
        );
        if (torii) updateAssetRecord('PROP_DIGITAL_TORII', 'sprite', torii);

        // 4. Shrine Office Desk
        const shrine = await fetchAsset(
            'PROP_SHRINE_OFFICE',
            'Admin Shrine Desk',
            'A massive shrine altar converted into a desk.',
            'sprite',
            'Object on transparent background. Huge pixel art structure: A traditional Shinto shrine roof, but the building is a giant high-tech computer desk. Multiple monitors, stacks of paper towers, server cables draped like shimenawa ropes. Cyberpunk office shrine. Transparent background.'
        );
        if (shrine) updateAssetRecord('PROP_SHRINE_OFFICE', 'sprite', shrine);

        // 5. Shredder Box
        const shredder = await fetchAsset(
            'PROP_SHREDDER',
            'Donation Shredder',
            'A donation box that is a shredder.',
            'sprite',
            'Object on transparent background. Pixel art wooden offertory box (saisen-bako) modified with mechanical gears and a paper shredder slot on top. Cyberpunk style. Transparent background.'
        );
        if (shredder) updateAssetRecord('PROP_SHREDDER', 'sprite', shredder);

        // 6. Working Reimu
        const reimuWork = await fetchAsset(
            'PROP_REIMU_WORK',
            'Working Reimu',
            'Reimu typing at a desk.',
            'sprite',
            'Character on transparent background. Pixel art Reimu Hakurei sitting at a desk, typing furiously on a mechanical keyboard. She looks exhausted, bags under eyes. Anime RPG style top-down. Transparent background.'
        );
        if (reimuWork) updateAssetRecord('PROP_REIMU_WORK', 'sprite', reimuWork);
    }

    setLoadingStatus(null);
  };

  const loadEnemyAssets = async (enemy: Enemy) => {
      setLoadingStatus(`Manifesting Boss: ${enemy.name}...`);
      const sprite = await fetchAsset(enemy.name, enemy.name, enemy.description, 'sprite', enemy.visualPrompt);
      if (sprite) updateAssetRecord(enemy.name, 'sprite', sprite);

      const bgPrompt = enemy.visualPrompt ? `${enemy.visualPrompt} (Atmospheric Background)` : enemy.description;
      const bg = await fetchAsset(`${enemy.name}_BG`, `${enemy.name} Location`, bgPrompt, 'background', bgPrompt);
      if (bg) updateAssetRecord(`${enemy.name}_BG`, 'background', bg);
      setLoadingStatus(null);
  };

  const handleFileSystemConnect = async () => {
      const success = await connectFileSystem();
      setHasFsAccess(success);
  };

  // --- Interaction Handlers ---

  const handleCharacterSelect = async (id: CharacterId) => {
    setSelectedCharId(id);
    const scenario = SCENARIOS[id];
    setCurrentScenario(scenario);
    
    // ASSET CHECK LOGIC
    const basicAssetsLoaded = loadedAssets.sprites[id] && loadedAssets.portraits[id] && loadedAssets.backgrounds[`${scenario.id}_MAP`];
    
    let propsLoaded = true;
    if (id === CharacterId.KAGUYA) {
        propsLoaded = !!(
            loadedAssets.props['PROP_ASSET_TREE'] && 
            loadedAssets.props['PROP_GOHEI'] &&
            loadedAssets.props['PROP_DIGITAL_TORII'] &&
            loadedAssets.props['PROP_SHRINE_OFFICE'] &&
            loadedAssets.props['PROP_REIMU_WORK']
        );
    }

    if (!basicAssetsLoaded || !propsLoaded) {
        await loadCharacterAssets(id);
    }
    setGameState(GameState.EXPLORATION);
  };

  const handleEncounter = async (enemy: Enemy) => {
    setActiveEnemy(enemy);
    await loadEnemyAssets(enemy);
    setGameState(GameState.BATTLE);
  };

  const handleVictory = () => setGameState(GameState.VICTORY);
  const handleDefeat = () => setGameState(GameState.GAME_OVER);

  const getCurrentCharacter = (): Character => {
      const base = CHARACTERS[selectedCharId];
      return {
          ...base,
          pixelSpriteUrl: loadedAssets.sprites[selectedCharId]?.url || FALLBACK_SPRITE,
          pixelSpriteUrlWalk: loadedAssets.sprites[selectedCharId]?.url || FALLBACK_SPRITE, 
          portraitUrl: loadedAssets.portraits[selectedCharId]?.url || FALLBACK_SPRITE
      };
  };

  const getCurrentEnemy = (): Enemy | null => {
      if (!activeEnemy) return null;
      return {
          ...activeEnemy,
          pixelSpriteUrl: loadedAssets.enemySprites[activeEnemy.name]?.url || FALLBACK_SPRITE,
          backgroundUrl: loadedAssets.backgrounds[activeEnemy.name]?.url || ''
      };
  };

  // Convert props record to simple string map for stage component
  const getPropSprites = () => {
      const result: Record<string, string> = {};
      Object.entries(loadedAssets.props).forEach(([key, val]) => {
          result[key] = val.url;
      });
      return result;
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

    switch (gameState) {
      case GameState.MENU:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0B3B] text-white p-4 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
            <div className="max-w-6xl w-full flex flex-col items-center relative z-10">
                {/* Title */}
                <div className="mb-12 text-center">
                     <h1 className="text-5xl md:text-7xl font-serif mb-2 text-transparent bg-clip-text bg-gradient-to-b from-[#E0E0E6] to-[#7B7B8B] tracking-widest drop-shadow-[0_0_20px_rgba(224,224,230,0.4)]">
                        東方虚鏡抄
                     </h1>
                     <h2 className="text-xl md:text-3xl text-[#FFD700] font-serif tracking-[0.2em] mb-6 uppercase opacity-80">
                        Reflection of Eternal Spirality
                     </h2>
                     <div className="w-32 h-1 bg-gradient-to-r from-transparent via-[#FFD700] to-transparent mx-auto"></div>
                </div>
                
                {/* Connection Status */}
                <div className="mb-12">
                    {!hasFsAccess ? (
                        <button 
                            onClick={handleFileSystemConnect}
                            className="border border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700] hover:text-black px-8 py-2 font-mono text-xs tracking-widest transition-all duration-300"
                        >
                            [ INITIALIZE LOCAL STORAGE ]
                        </button>
                    ) : (
                         <div className="text-green-400 font-mono text-xs tracking-widest border border-green-800 px-4 py-2 bg-black/50">
                             SYSTEM LINK: STABLE
                         </div>
                    )}
                </div>
                
                {/* Character Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-5xl px-8">
                {Object.values(CHARACTERS).map((char) => {
                    const isKaguya = char.id === CharacterId.KAGUYA;
                    const scenario = SCENARIOS[char.id];
                    
                    const basicReady = loadedAssets.sprites[char.id] && loadedAssets.portraits[char.id] && loadedAssets.backgrounds[`${scenario.id}_MAP`];
                    let propsReady = true;
                    if (isKaguya) {
                        propsReady = !!(loadedAssets.props['PROP_ASSET_TREE'] && loadedAssets.props['PROP_GOHEI'] && loadedAssets.props['PROP_REIMU_WORK']);
                    }
                    const isReady = basicReady && propsReady;

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
                        {/* Scenario Title */}
                        <div className="absolute top-4 left-4 text-xs tracking-[0.3em] opacity-50 font-bold">
                            {isKaguya ? 'ROUTE A' : 'ROUTE B'}
                        </div>

                        <h2 className={`text-3xl font-serif mt-6 mb-2 ${isKaguya ? 'text-blue-200' : 'text-red-200'}`}>
                            {scenario.title}
                        </h2>
                        <p className="text-sm text-gray-400 font-serif italic mb-8">"{scenario.subtitle}"</p>
                        
                        {/* Portrait Preview Box */}
                        <div className={`w-full aspect-square border ${isKaguya ? 'border-blue-900' : 'border-red-900'} bg-black/50 mb-6 relative flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500`}>
                             {loadedAssets.portraits[char.id] ? (
                                 <img src={loadedAssets.portraits[char.id].url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={char.name} />
                             ) : (
                                 <span className="text-4xl opacity-20">?</span>
                             )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-gray-400 leading-relaxed h-16">
                            {scenario.description}
                        </p>

                        {/* Button */}
                        <div className={`mt-6 py-3 text-center text-xs font-bold tracking-[0.2em] border transition-all
                            ${isReady 
                                ? (isKaguya ? 'bg-blue-900/30 border-blue-500 text-blue-200' : 'bg-red-900/30 border-red-500 text-red-200')
                                : 'border-gray-700 text-gray-500'
                            }
                        `}>
                            {isReady ? 'START GAME' : 'GENERATE ASSETS'}
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
            character={getCurrentCharacter()} 
            scenarioEnemies={currentScenario.enemies}
            onEncounter={handleEncounter}
            backgroundUrl={loadedAssets.backgrounds[`${currentScenario.id}_MAP`]?.url}
            propSprites={getPropSprites()}
          />
        );

      case GameState.BATTLE:
        if (!activeEnemy) return null;
        const fullEnemy = getCurrentEnemy();
        if (!fullEnemy) return <div>Preparing Battle...</div>;

        return (
          <DanmakuBattle
            character={getCurrentCharacter()}
            enemy={fullEnemy}
            onVictory={handleVictory}
            onDefeat={handleDefeat}
          />
        );

      case GameState.VICTORY:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white text-center relative overflow-hidden font-serif">
            <div className="absolute inset-0 bg-blue-900/20"></div>
            <h1 className="text-6xl text-[#FFD700] mb-4 animate-pulse relative z-10 drop-shadow-[0_0_10px_gold] tracking-widest">
                PHANTASM CLEARED
            </h1>
            <div className="relative z-10 max-w-2xl p-8 border-y-2 border-[#FFD700] bg-black/80">
                <p className="text-xl italic text-gray-300 mb-8">
                    "{activeEnemy?.flavorText}"
                </p>
                <button 
                    onClick={() => setGameState(GameState.EXPLORATION)}
                    className="px-12 py-3 bg-[#FFD700] text-black font-bold tracking-widest hover:bg-white transition-all"
                >
                    CONTINUE JOURNEY
                </button>
            </div>
          </div>
        );

      case GameState.GAME_OVER:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white relative">
            <div className="text-red-900/20 text-[250px] font-serif absolute select-none pointer-events-none top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">滅</div>
            <h1 className="text-5xl text-red-600 font-serif mb-2 tracking-[0.5em] z-10">GAME OVER</h1>
            <div className="mb-12 text-gray-500 font-serif italic z-10">The mirror remains unbroken...</div>
            <button 
              onClick={() => setGameState(GameState.MENU)}
              className="px-12 py-4 border border-red-800 text-red-500 hover:bg-red-900/30 hover:border-red-400 hover:text-red-200 transition-all z-10 tracking-widest text-sm"
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
