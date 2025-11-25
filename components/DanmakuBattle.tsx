
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

const PHASE_THRESHOLDS = [0.8, 0.5, 0.2]; // HP percentages where phase changes

const DanmakuBattle: React.FC<DanmakuBattleProps> = ({ character, enemy, onVictory, onDefeat }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game Data
  const [bossHp, setBossHp] = useState(enemy.maxHp);
  const [playerHp, setPlayerHp] = useState(3);
  const [score, setScore] = useState(0);
  const [graze, setGraze] = useState(0);
  const [bombs, setBombs] = useState(2);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [timeLeft, setTimeLeft] = useState(90000); // 90 seconds
  
  // Visual State
  const [showCutIn, setShowCutIn] = useState(true);
  const [spellCardName, setSpellCardName] = useState("");
  const [isGlitching, setIsGlitching] = useState(false);

  // Sprites
  const [playerSprite, setPlayerSprite] = useState<HTMLImageElement | null>(null);
  const [enemySprite, setEnemySprite] = useState<HTMLImageElement | null>(null);

  const isReimu = enemy.name.includes("Reimu");

  // Game State Ref (Mutable for performance)
  const stateRef = useRef({
    player: { 
        x: CANVAS_WIDTH / 2, 
        y: CANVAS_HEIGHT - 100,
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
    // Special Boss States
    crushingWallY: 0, // For Reimu Phase 3
    
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
    stateRef.current.crushingWallY = 0;

    setPlayerHp(3);
    setShowCutIn(true);
    setSpellCardName(isReimu ? "Initializing System Correction..." : enemy.spellCardName);

    const timer = setTimeout(() => {
        setShowCutIn(false);
        stateRef.current.gameActive = true;
    }, 3000);

    return () => clearTimeout(timer);
  }, [character, enemy, isReimu]);

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

  // --- Boss Pattern Logic (Reimu Specific) ---
  const spawnReimuPattern = (tick: number, bx: number, by: number, phase: number, playerX: number, playerY: number) => {
      const bullets: Bullet[] = [];
      const createBullet = (props: Partial<Bullet>): Bullet => ({
          x: bx, y: by, speed: 3, angle: Math.PI/2, accel: 0, angularVelocity: 0,
          radius: 4, type: BulletType.ORB, color: 'white', isEnemy: true, id: Math.random(), grazed: false,
          maxReflections: 0,
          ...props
      });

      // === PHASE 1: NON-SPELL (Efficient Correction) ===
      if (phase === 1) {
          // Teleport Logic handled in main update
          
          // Homing Amulets
          if (tick % 60 === 0) {
             for (let i = -2; i <= 2; i++) {
                 if (i===0) continue;
                 bullets.push(createBullet({
                     x: bx + i * 20, y: by,
                     speed: 0.1, // Start slow
                     accel: 0.1, // Accelerate
                     angle: Math.PI / 2, // Downwards initial
                     type: BulletType.AMULET,
                     color: '#FF0000',
                     homing: true, // Tag for homing logic
                     delay: 30 // Wait before homing
                 }));
             }
          }
          // Bouncing Orbs (Mirror Mechanic)
          if (tick % 90 === 0) {
              bullets.push(createBullet({
                  angle: Math.PI * 0.75, // Down-Left
                  speed: 4,
                  type: BulletType.ORB,
                  color: '#FFFFFF',
                  radius: 10,
                  maxReflections: 1
              }));
              bullets.push(createBullet({
                  angle: Math.PI * 0.25, // Down-Right
                  speed: 4,
                  type: BulletType.ORB,
                  color: '#FFFFFF',
                  radius: 10,
                  maxReflections: 1
              }));
          }
      }
      
      // === PHASE 2: SPELL 1 (Infinite Paperwork) ===
      else if (phase === 2) {
          if (tick % 5 === 0) {
              // Emitter Left
              bullets.push(createBullet({
                  x: 10 + Math.random() * 40, y: 0,
                  speed: 2 + Math.random(),
                  angle: Math.PI / 2,
                  type: BulletType.PAPER,
                  color: '#FFFFFF',
                  accel: 0.02
              }));
              // Emitter Right
              bullets.push(createBullet({
                  x: CANVAS_WIDTH - (10 + Math.random() * 40), y: 0,
                  speed: 2 + Math.random(),
                  angle: Math.PI / 2,
                  type: BulletType.PAPER,
                  color: '#FF0000',
                  accel: 0.02
              }));
          }
      }

      // === PHASE 3: SPELL 2 (Crushing Wall) ===
      else if (phase === 3) {
          // Vertical fast lasers
          if (tick % 15 === 0) {
              bullets.push(createBullet({
                  x: bx, y: by + 20,
                  speed: 8,
                  angle: Math.PI / 2,
                  type: BulletType.LASER_V,
                  color: '#FF0000',
                  radius: 6
              }));
          }
      }

      // === PHASE 4: FINAL (System Meltdown) ===
      else if (phase === 4) {
          // Radial Burst
          if (tick % 120 === 0) {
              for(let i=0; i<20; i++) {
                  bullets.push(createBullet({
                      angle: (Math.PI * 2 / 20) * i + tick*0.1,
                      speed: 4,
                      type: BulletType.BIG,
                      color: '#FF0000',
                      radius: 12
                  }));
              }
          }
          // Random Glitch Pixels
          if (tick % 5 === 0) {
              bullets.push(createBullet({
                  x: Math.random() * CANVAS_WIDTH,
                  y: Math.random() * CANVAS_HEIGHT * 0.5,
                  speed: 3,
                  angle: Math.random() * Math.PI * 2,
                  type: BulletType.GLITCH,
                  color: '#00FFFF',
                  radius: 2
              }));
          }
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
        
        // --- LOGIC ---
        
        // Timer
        if (state.gameActive) {
            setTimeLeft(prev => {
                if (prev <= 0) {
                    stateRef.current.isRunning = false;
                    onDefeat();
                    return 0;
                }
                return prev - 16;
            });
        }

        // Phase Transition
        const hpPercent = bossHp / enemy.maxHp;
        let newPhase = 1;
        let phaseName = "Efficient Correction";
        if (hpPercent < PHASE_THRESHOLDS[2]) { newPhase = 4; phaseName = 'Overwork "System Meltdown"'; }
        else if (hpPercent < PHASE_THRESHOLDS[1]) { newPhase = 3; phaseName = 'Deadline "The Crushing Wall"'; }
        else if (hpPercent < PHASE_THRESHOLDS[0]) { newPhase = 2; phaseName = 'Labor Sign "Infinite Paperwork Avalanche"'; }
        
        if (newPhase !== currentPhase) {
            setCurrentPhase(newPhase);
            setSpellCardName(phaseName);
            setShowCutIn(true);
            setTimeout(() => setShowCutIn(false), 2000);
            
            // Clear bullets on phase change
            state.bullets = state.bullets.filter(b => !b.isEnemy);
            state.boss.tick = 0;
            state.boss.cooldown = 60; // Brief pause
        }

        // Movement Limits
        // Crushing Wall Logic (Phase 3)
        let topLimit = 0;
        if (isReimu && currentPhase === 3) {
            state.crushingWallY += 0.1; // Slow descent
            topLimit = state.crushingWallY;
            
            if (state.player.y < topLimit + 10) {
                // Crushed!
                state.player.hp = 0;
                setPlayerHp(0);
                stateRef.current.isRunning = false;
                onDefeat();
            }
        }

        // Player Movement
        const isFocus = keys['Shift'];
        state.player.isFocus = isFocus;
        const moveSpeed = isFocus ? character.focusSpeed : character.speed;
        
        if ((keys['ArrowLeft'] || keys['a']) && state.player.x > 10) state.player.x -= moveSpeed;
        if ((keys['ArrowRight'] || keys['d']) && state.player.x < CANVAS_WIDTH - 10) state.player.x += moveSpeed;
        if ((keys['ArrowUp'] || keys['w']) && state.player.y > 10 + topLimit) state.player.y -= moveSpeed;
        if ((keys['ArrowDown'] || keys['s']) && state.player.y < CANVAS_HEIGHT - 10) state.player.y += moveSpeed;

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

        // Boss Movement & Logic
        if (state.gameActive) {
            state.boss.tick++;
            
            if (isReimu) {
                // Reimu Specific Movement
                if (currentPhase === 1) {
                    if (state.boss.tick % 180 === 0) {
                        state.boss.targetX = 50 + Math.random() * (CANVAS_WIDTH - 100);
                        state.boss.targetY = 50 + Math.random() * 50;
                    }
                } else if (currentPhase === 3) {
                    // Horizontal strafe
                    if (state.boss.tick % 60 === 0) {
                        state.boss.targetX = Math.random() * CANVAS_WIDTH;
                    }
                    state.boss.targetY = state.crushingWallY + 40; // Stay just below wall
                } else {
                    // Center bias
                    state.boss.targetX = CANVAS_WIDTH / 2 + Math.sin(state.boss.tick * 0.02) * 50;
                    state.boss.targetY = 100;
                }
            } else {
                // Default Movement
                if (state.boss.tick % 120 === 0) {
                    state.boss.targetX = 100 + Math.random() * (CANVAS_WIDTH - 200);
                    state.boss.targetY = 50 + Math.random() * 100;
                }
            }

            state.boss.x += (state.boss.targetX - state.boss.x) * 0.05;
            state.boss.y += (state.boss.targetY - state.boss.y) * 0.05;

            if (state.boss.cooldown > 0) state.boss.cooldown--;
            else {
                const pattern = isReimu 
                    ? spawnReimuPattern(state.boss.tick, state.boss.x, state.boss.y, currentPhase, state.player.x, state.player.y)
                    : []; // Fallback for other bosses
                state.bullets.push(...pattern);
            }
        }

        // Bullet Updates
        const playerHitbox = isFocus ? 3 : 5;
        const grazeRadius = 18;
        
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            
            // Homing Logic
            if (b.homing && b.delay && b.delay > 0) {
                b.delay--;
                if (b.delay === 0) {
                    b.angle = Math.atan2(state.player.y - b.y, state.player.x - b.x);
                    b.speed = 4; // Launch
                } else {
                    b.speed = 0.1; // Pause
                }
            }
            // Paper Sway Logic
            if (b.type === BulletType.PAPER) {
                b.x += Math.sin(state.boss.tick * 0.1) * 2;
            }

            b.speed += b.accel;
            b.angle += b.angularVelocity;
            b.x += Math.cos(b.angle) * b.speed;
            b.y += Math.sin(b.angle) * b.speed;

            // Reflection Logic
            let destroy = false;
            if (b.maxReflections && b.maxReflections > 0) {
                 if (b.x < 0 || b.x > CANVAS_WIDTH) {
                     b.vx = b.speed * Math.cos(b.angle) * -1; // Reflect X
                     b.angle = Math.PI - b.angle;
                     b.maxReflections--;
                     b.color = '#aa00ff'; // Purple = Reflected
                     // Clamp
                     b.x = Math.max(1, Math.min(CANVAS_WIDTH - 1, b.x));
                 }
            }

            if (b.x < -50 || b.x > CANVAS_WIDTH + 50 || b.y < -50 || b.y > CANVAS_HEIGHT + 50) {
                destroy = true;
            }

            if (destroy) {
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
                        setIsGlitching(true);
                        setTimeout(() => setIsGlitching(false), 200);

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
        
        // Phase 4 Shake
        ctx.save();
        if (currentPhase === 4) {
            ctx.translate((Math.random()-0.5)*4, (Math.random()-0.5)*4);
        }

        // Draw Game Elements
        const drawScene = () => {
             // Boss
            if (enemySprite) {
                const size = 80;
                ctx.drawImage(enemySprite, state.boss.x - size/2, state.boss.y - size/2, size, size);
            } else {
                ctx.fillStyle = 'red';
                ctx.beginPath(); ctx.arc(state.boss.x, state.boss.y, 30, 0, Math.PI*2); ctx.fill();
            }

            // Crushing Wall (Phase 3)
            if (isReimu && currentPhase === 3 && state.crushingWallY > 0) {
                const y = state.crushingWallY;
                const grad = ctx.createLinearGradient(0, y-20, 0, y);
                grad.addColorStop(0, 'rgba(255,0,0,0)');
                grad.addColorStop(1, 'rgba(255,0,0,0.8)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, CANVAS_WIDTH, y);
                
                ctx.strokeStyle = '#FF0000';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(CANVAS_WIDTH, y);
                ctx.stroke();

                // Text on the beam
                ctx.fillStyle = '#FF0000';
                ctx.font = '10px monospace';
                for(let i=0; i<10; i++) ctx.fillText("DEADLINE", i*60, y-5);
            }

            // Bullets
            state.bullets.forEach(b => {
                ctx.fillStyle = b.color;
                
                if (b.type === BulletType.PAPER) {
                    // Rectangular
                    ctx.save();
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.angle);
                    ctx.fillRect(-6, -8, 12, 16);
                    ctx.restore();
                } else if (b.type === BulletType.AMULET) {
                    ctx.save();
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.angle);
                    ctx.fillStyle = '#AA0000';
                    ctx.fillRect(-4, -6, 8, 12);
                    ctx.fillStyle = 'white';
                    ctx.fillRect(-2, -4, 4, 8);
                    ctx.restore();
                } else if (b.type === BulletType.GLITCH) {
                    ctx.fillRect(b.x, b.y, 4, 4);
                } else if (b.type === BulletType.LASER_V) {
                    ctx.fillRect(b.x - 2, b.y - 10, 4, 30);
                } else {
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                    ctx.fill();
                }
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
                if (state.player.isFocus) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 4, 0, Math.PI*2); ctx.fill();
                }
            }
        }
        
        drawScene();

        // Mirror Distortion Effect (Center)
        if (isReimu) {
             // Simply draw a subtle overlay
             ctx.fillStyle = 'rgba(100, 200, 255, 0.05)';
             ctx.fillRect(CANVAS_WIDTH/4, 50, CANVAS_WIDTH/2, CANVAS_HEIGHT - 100);
             ctx.strokeStyle = 'rgba(100, 255, 255, 0.1)';
             ctx.lineWidth = 1;
             ctx.strokeRect(CANVAS_WIDTH/4, 50, CANVAS_WIDTH/2, CANVAS_HEIGHT - 100);
        }

        ctx.restore();
    };

    reqId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(reqId);
  }, [character, enemy, onDefeat, onVictory, playerSprite, enemySprite, isReimu, bossHp, currentPhase]);


  // Formatting Timer
  const formatTime = (ms: number) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const remainingS = s % 60;
      const dec = Math.floor((ms % 1000) / 10);
      return `${m.toString().padStart(2, '0')}:${remainingS.toString().padStart(2, '0')}:${dec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex w-full h-screen bg-[#050510] overflow-hidden items-center justify-center font-serif select-none ${isGlitching ? 'grayscale contrast-200' : ''}`}>
      
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
                    filter: isReimu ? 'hue-rotate(-20deg) contrast(1.2)' : 'brightness(0.6)'
                }}
            >
                {/* Scrolling Effect for Reimu Phase */}
                {isReimu && (
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-20 animate-[slideY_5s_linear_infinite]"></div>
                )}
                <style>{`
                    @keyframes slideY { from { background-position: 0 0; } to { background-position: 0 1000px; } }
                `}</style>
            </div>

            {/* Boss HUD (Reimu Special) */}
            <div className="absolute top-0 left-0 right-0 z-30 p-2">
                {/* Timer */}
                <div className={`text-center font-mono text-xl font-bold mb-1 ${timeLeft < 10000 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                    DEADLINE: {formatTime(timeLeft)}
                </div>

                {/* HP Bar */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-sm bg-black border border-cyan-500 flex items-center justify-center text-xs font-bold text-cyan-500 font-mono">
                        {currentPhase}/4
                    </div>
                    <div className="flex-1 h-4 bg-black/80 border border-gray-600 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center z-10 text-[10px] text-white/50 tracking-[0.5em] font-mono">WORK QUOTA</div>
                        <div 
                            className={`h-full transition-all duration-200 ${bossHp/enemy.maxHp < 0.2 ? 'bg-red-600 animate-pulse' : 'bg-cyan-600'}`}
                            style={{ width: `${(bossHp / enemy.maxHp) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Spell Card Cut-in */}
            <div className={`absolute top-20 left-0 right-0 z-40 pointer-events-none transition-all duration-500 ${showCutIn ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
                 <div className="bg-gradient-to-l from-black via-black/80 to-transparent py-4 px-8 text-right border-y border-cyan-500">
                     <h3 className="text-cyan-400 font-mono text-xl shadow-cyan-500 drop-shadow-[0_0_5px_cyan]">
                         {spellCardName}
                     </h3>
                     <p className="text-xs text-gray-400 font-mono">SYSTEM WARNING: HIGH CPU USAGE</p>
                 </div>
            </div>

            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="relative z-10 block" />

        </div>

        {/* RIGHT: Sidebar Stats */}
        <div className="w-[300px] bg-[#1a0505] border-l-4 border-[#C0C0C0] flex flex-col p-6 text-white relative overflow-hidden font-mono">
            <h2 className="text-3xl text-center text-[#FFD700] border-b-2 border-[#FFD700] pb-4 mb-8 tracking-widest font-serif">
                STATUS
            </h2>

            <div className="space-y-8">
                <div>
                    <div className="text-[#C0C0C0] text-xs mb-2">SCORE</div>
                    <div className="text-2xl text-white">{score.toLocaleString()}</div>
                </div>

                <div>
                    <div className="text-[#C0C0C0] text-xs mb-2">LIVES</div>
                    <div className="flex gap-2 text-2xl text-yellow-200">
                        {Array(3).fill(0).map((_, i) => (
                            <span key={i} className={i < playerHp ? "opacity-100" : "opacity-20"}>★</span>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="text-[#C0C0C0] text-xs mb-2">BOMBS</div>
                    <div className="flex gap-2 text-2xl">
                        {Array(bombs).fill(0).map((_, i) => (
                            <span key={i} className="text-emerald-400">♦</span>
                        ))}
                    </div>
                </div>

                <div className="mt-4 bg-white/5 p-3 rounded border border-white/10">
                    <span className="text-xs text-gray-400">GRAZE:</span> <span className="text-xl">{graze}</span>
                </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-gray-800 text-[10px] text-gray-500">
                 DEBUG_MODE: ON<br/>
                 RENDER: 60 FPS<br/>
                 MEMORY: STABLE
            </div>
        </div>

      </div>
    </div>
  );
};

export default DanmakuBattle;
