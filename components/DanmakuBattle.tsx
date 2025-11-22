
import React, { useEffect, useRef, useState } from 'react';
import { Bullet, BulletType, Character, Enemy, Particle } from '../types';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';

interface DanmakuBattleProps {
  character: Character;
  enemy: Enemy;
  onVictory: () => void;
  onDefeat: () => void;
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

const DanmakuBattle: React.FC<DanmakuBattleProps> = ({ character, enemy, onVictory, onDefeat }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game Data
  const [bossHp, setBossHp] = useState(enemy.maxHp);
  const [playerHp, setPlayerHp] = useState(3);
  const [score, setScore] = useState(0);
  const [graze, setGraze] = useState(0);
  const [bombs, setBombs] = useState(2);
  
  // Visual State
  const [showCutIn, setShowCutIn] = useState(true);
  const [spellCardActive, setSpellCardActive] = useState(true);

  // Sprites
  const [playerSprite, setPlayerSprite] = useState<HTMLImageElement | null>(null);
  const [enemySprite, setEnemySprite] = useState<HTMLImageElement | null>(null);

  // Game State Ref (Mutable for performance)
  const stateRef = useRef({
    player: { 
        x: CANVAS_WIDTH / 2, 
        y: CANVAS_HEIGHT - 150, // Higher up to avoid mirror
        isFocus: false, 
        iframes: 0, 
        shootTimer: 0,
        hp: 3
    },
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    shockwaves: [] as Shockwave[],
    keys: {} as Record<string, boolean>,
    boss: { 
      x: CANVAS_WIDTH / 2, 
      y: 120, 
      targetX: CANVAS_WIDTH / 2, 
      targetY: 120, 
      tick: 0,
      angle: 0,
      cooldown: 0
    },
    isRunning: true,
    gameActive: false
  });

  // --- Initialization ---
  useEffect(() => {
    const loadImages = () => {
        const pImg = new Image();
        pImg.src = character.pixelSpriteUrl;
        pImg.onload = () => setPlayerSprite(pImg);

        const eImg = new Image();
        eImg.src = enemy.pixelSpriteUrl;
        eImg.onload = () => setEnemySprite(eImg);
    };
    loadImages();

    stateRef.current.player.hp = 3;
    stateRef.current.isRunning = true;
    stateRef.current.gameActive = false;
    stateRef.current.boss.tick = 0;
    stateRef.current.boss.cooldown = 0;
    stateRef.current.bullets = [];
    stateRef.current.particles = [];
    stateRef.current.shockwaves = [];

    setPlayerHp(3);
    setShowCutIn(true);

    const timer = setTimeout(() => {
        setShowCutIn(false);
        stateRef.current.gameActive = true;
    }, 3000);

    return () => clearTimeout(timer);
  }, [character, enemy]);

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { stateRef.current.keys[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { stateRef.current.keys[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stateRef.current.isRunning = false;
    };
  }, []);

  // --- Helper: Bullet Patterns ---
  const createBullet = (x: number, y: number, speed: number, angle: number, type: BulletType, color: string, props: Partial<Bullet> = {}): Bullet => ({
      x, y, speed, angle, 
      accel: 0, angularVelocity: 0,
      radius: type === BulletType.BIG ? 16 : type === BulletType.ORB ? 6 : 3,
      type, color, isEnemy: true, id: Math.random(), grazed: false,
      ...props
  });

  const spawnPattern = (tick: number, bx: number, by: number, difficulty: number) => {
      const bullets: Bullet[] = [];
      const freq = Math.max(5, 20 - difficulty * 2);
      
      // GDD Thematic Patterns
      if (tick % 60 === 0) {
          // Spiral Wave
          const count = 16 + difficulty * 2;
          for (let i = 0; i < count; i++) {
              const angle = (Math.PI * 2 / count) * i + tick * 0.05;
              bullets.push(createBullet(bx, by, 3, angle, BulletType.RICE, '#a78bfa'));
          }
      }

      if (tick % 5 === 0) {
          // Streaming aimed
          const px = stateRef.current.player.x;
          const py = stateRef.current.player.y;
          const angle = Math.atan2(py - by, px - bx);
          bullets.push(createBullet(bx, by, 4 + difficulty * 0.5, angle, BulletType.ORB, '#f472b6'));
      }

      return bullets;
  };

  // --- Main Game Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let reqId: number;

    const update = () => {
        if (!stateRef.current.isRunning) return;
        const state = stateRef.current;
        const { keys } = state;
        
        // Movement Bounds (Prevent going into the mirror area too deep)
        const MIRROR_Y = CANVAS_HEIGHT * 0.8;

        const isFocus = keys['Shift'];
        state.player.isFocus = isFocus;
        const moveSpeed = isFocus ? character.focusSpeed : character.speed;
        
        if ((keys['ArrowLeft'] || keys['a']) && state.player.x > 10) state.player.x -= moveSpeed;
        if ((keys['ArrowRight'] || keys['d']) && state.player.x < CANVAS_WIDTH - 10) state.player.x += moveSpeed;
        if ((keys['ArrowUp'] || keys['w']) && state.player.y > 10) state.player.y -= moveSpeed;
        if ((keys['ArrowDown'] || keys['s']) && state.player.y < MIRROR_Y - 10) state.player.y += moveSpeed;

        // Shooting
        if (keys['z'] || keys[' ']) {
            if (state.player.shootTimer <= 0) {
                state.bullets.push({
                    x: state.player.x - 8, y: state.player.y - 10,
                    speed: 15, angle: -Math.PI / 2, accel: 0, angularVelocity: 0,
                    radius: 4, type: BulletType.RICE, color: character.bulletColor,
                    isEnemy: false, id: Math.random(), grazed: false
                });
                state.bullets.push({
                    x: state.player.x + 8, y: state.player.y - 10,
                    speed: 15, angle: -Math.PI / 2, accel: 0, angularVelocity: 0,
                    radius: 4, type: BulletType.RICE, color: character.bulletColor,
                    isEnemy: false, id: Math.random(), grazed: false
                });
                state.player.shootTimer = 4;
            }
            state.player.shootTimer--;
        }

        // Boss Logic
        if (state.gameActive) {
            state.boss.tick++;
            if (state.boss.tick % 120 === 0) {
                state.boss.targetX = 100 + Math.random() * (CANVAS_WIDTH - 200);
                state.boss.targetY = 50 + Math.random() * 100;
            }
            state.boss.x += (state.boss.targetX - state.boss.x) * 0.05;
            state.boss.y += (state.boss.targetY - state.boss.y) * 0.05;

            if (state.boss.cooldown > 0) state.boss.cooldown--;
            else state.bullets.push(...spawnPattern(state.boss.tick, state.boss.x, state.boss.y, enemy.difficulty));
        }

        // Bullets
        const playerHitbox = isFocus ? 3 : 5;
        const grazeRadius = 18;
        
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.speed += b.accel;
            b.angle += b.angularVelocity;
            b.x += Math.cos(b.angle) * b.speed;
            b.y += Math.sin(b.angle) * b.speed;

            if (b.x < -50 || b.x > CANVAS_WIDTH + 50 || b.y < -50 || b.y > CANVAS_HEIGHT + 50) {
                state.bullets.splice(i, 1);
                continue;
            }

            // Collision
            if (b.isEnemy) {
                const dx = b.x - state.player.x;
                const dy = b.y - state.player.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (state.player.iframes <= 0) {
                    if (dist < b.radius + playerHitbox) {
                        state.player.hp -= 1;
                        setPlayerHp(state.player.hp);
                        if (state.player.hp <= 0) { stateRef.current.isRunning = false; onDefeat(); }
                        else {
                            state.player.iframes = 180;
                            state.bullets = state.bullets.filter(bull => !bull.isEnemy); 
                            state.shockwaves.push({ x: state.player.x, y: state.player.y, r: 10, alpha: 1.0 });
                            setBombs(2); 
                            state.boss.cooldown = 120;
                        }
                        break; 
                    }
                } else state.player.iframes--;

                if (!b.grazed && dist < b.radius + grazeRadius) {
                    b.grazed = true;
                    setGraze(g => g + 1);
                    setScore(s => s + 500);
                    state.particles.push({
                        x: state.player.x + (Math.random()-0.5)*10, y: state.player.y + (Math.random()-0.5)*10,
                        vx: 0, vy: -2, life: 15, color: '#fff', size: 1, alpha: 1
                    });
                }
            } else {
                const dx = b.x - state.boss.x;
                const dy = b.y - state.boss.y;
                if (dx*dx + dy*dy < 1600) {
                    setBossHp(h => {
                        const nh = h - 15;
                        if (nh <= 0) { stateRef.current.isRunning = false; onVictory(); return 0; }
                        return nh;
                    });
                    setScore(s => s + 100);
                    state.bullets.splice(i, 1);
                    state.particles.push({
                        x: b.x, y: b.y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8,
                        life: 10, color: '#ffffaa', size: 3, alpha: 1
                    });
                }
            }
        }

        draw(ctx);
        reqId = requestAnimationFrame(update);
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const state = stateRef.current;
        ctx.clearRect(0,0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Function to draw game elements
        const drawScene = (isReflection: boolean) => {
             // Boss
            if (enemySprite) {
                const size = 80;
                ctx.drawImage(enemySprite, state.boss.x - size/2, state.boss.y - size/2, size, size);
            } else {
                ctx.fillStyle = 'red';
                ctx.beginPath(); ctx.arc(state.boss.x, state.boss.y, 30, 0, Math.PI*2); ctx.fill();
            }

            // Bullets
            state.bullets.forEach(b => {
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fill();
                // White core
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius/2, 0, Math.PI * 2);
                ctx.fill();
            });

            // Player
             if (state.player.iframes % 4 < 2) {
                if (playerSprite) {
                    const pSize = 32;
                    ctx.drawImage(playerSprite, state.player.x - pSize/2, state.player.y - pSize/2, pSize, pSize);
                } else {
                    ctx.fillStyle = 'blue';
                    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 10, 0, Math.PI*2); ctx.fill();
                }
                if (state.player.isFocus && !isReflection) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 4, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = '#f00';
                    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 4, 0, Math.PI*2); ctx.stroke();
                }
            }
        }

        // 1. Draw Main Scene
        drawScene(false);

        // 2. Draw Mirror Reflection (Bottom 20%)
        const MIRROR_HEIGHT = CANVAS_HEIGHT * 0.2;
        const MIRROR_Y = CANVAS_HEIGHT - MIRROR_HEIGHT;

        // Draw a glass overlay
        ctx.fillStyle = 'rgba(176, 196, 222, 0.15)';
        ctx.fillRect(0, MIRROR_Y, CANVAS_WIDTH, MIRROR_HEIGHT);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath(); ctx.moveTo(0, MIRROR_Y); ctx.lineTo(CANVAS_WIDTH, MIRROR_Y); ctx.stroke();

        // Reflection rendering
        ctx.save();
        // Clip to mirror area
        ctx.beginPath(); ctx.rect(0, MIRROR_Y, CANVAS_WIDTH, MIRROR_HEIGHT); ctx.clip();
        
        // Transform to flip vertical and offset
        ctx.translate(0, MIRROR_Y * 2); // Move down
        ctx.scale(1, -1); // Flip Y
        
        // Apply some distortion or opacity for effect
        ctx.globalAlpha = 0.4;
        // Draw scene again
        drawScene(true);
        
        ctx.restore();
    };

    reqId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(reqId);
  }, [character, enemy, onDefeat, onVictory, playerSprite, enemySprite]);


  return (
    <div className="flex w-full h-screen bg-[#050510] overflow-hidden items-center justify-center font-serif select-none">
      
      <div className="flex shadow-[0_0_50px_rgba(0,0,0,0.8)] border-4 border-[#8B0000] bg-[#0f0f1a] relative">
        
        {/* LEFT: Game Viewport */}
        <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
            {/* Background */}
            <div 
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `url(${enemy.backgroundUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'brightness(0.6)'
                }}
            />

            {/* Cut-in */}
            <div className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-1000 ${showCutIn ? 'opacity-100' : 'opacity-0'}`}>
                <img 
                    src={character.portraitUrl} 
                    alt="Hero"
                    className={`absolute bottom-0 left-0 h-[500px] opacity-90 transition-transform duration-700 ease-out ${showCutIn ? 'translate-x-0' : '-translate-x-20'}`}
                />
                <div className={`absolute top-32 right-0 bg-gradient-to-l from-[#8B0000] to-transparent text-white py-4 px-12 text-right w-full`}>
                    <h3 className="text-3xl font-bold italic tracking-widest text-[#FFD700] drop-shadow-md font-serif">
                        {enemy.spellCardName}
                    </h3>
                </div>
            </div>

            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="relative z-10 block" />

            {/* Boss Health */}
            <div className="absolute top-4 left-4 right-4 h-6 z-30 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-900 border border-white flex items-center justify-center text-xs font-bold text-white">鬼</div>
                <div className="flex-1 h-3 bg-black/50 border border-gray-500 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-red-600 via-pink-500 to-white"
                        style={{ width: `${(bossHp / enemy.maxHp) * 100}%` }}
                    />
                </div>
            </div>
        </div>

        {/* RIGHT: Sidebar Stats (Maki-e Style) */}
        <div className="w-[300px] bg-[#1a0505] border-l-4 border-[#C0C0C0] flex flex-col p-6 text-white relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, gold 10%, transparent 10%)', backgroundSize: '10px 10px' }}></div>

            <h2 className="text-3xl text-center text-[#FFD700] font-serif border-b-2 border-[#FFD700] pb-4 mb-8 tracking-widest">
                虚鏡抄
            </h2>

            <div className="space-y-8 font-mono">
                <div>
                    <div className="text-[#C0C0C0] text-xs mb-2 uppercase tracking-wider">Score</div>
                    <div className="text-2xl text-white drop-shadow-[0_0_5px_gold]">{score.toLocaleString()}</div>
                </div>

                {/* Moon Phase Lives */}
                <div>
                    <div className="text-[#C0C0C0] text-xs mb-2 uppercase tracking-wider">Vitality (Moon)</div>
                    <div className="flex items-center gap-2 text-2xl text-yellow-200">
                        {Array(3).fill(0).map((_, i) => (
                            <span key={i} className={i < playerHp ? "opacity-100 drop-shadow-[0_0_8px_yellow]" : "opacity-20 grayscale"}>
                                {i === 0 ? '🌑' : i === 1 ? '🌗' : '🌕'}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Jewels Bombs */}
                <div>
                    <div className="text-[#C0C0C0] text-xs mb-2 uppercase tracking-wider">Spirit (Jewels)</div>
                    <div className="flex items-center gap-2 text-2xl">
                        {Array(bombs).fill(0).map((_, i) => (
                            <span key={i} className="text-emerald-400 drop-shadow-[0_0_5px_lime]">💎</span>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center mt-4 bg-white/5 p-3 rounded border border-white/10">
                    <span className="text-xs text-gray-400">GRAZE</span>
                    <span className="text-xl text-white font-bold">{graze}</span>
                </div>
            </div>

            <div className="mt-auto text-center text-xs text-gray-500 font-serif italic">
                "The moon is broken, yet it shines."
            </div>
        </div>

      </div>
    </div>
  );
};

export default DanmakuBattle;