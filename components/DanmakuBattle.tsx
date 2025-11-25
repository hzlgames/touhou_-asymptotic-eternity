
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

// Phase thresholds for boss HP
const PHASE_THRESHOLDS = [0.8, 0.5, 0.2]; 

const DanmakuBattle: React.FC<DanmakuBattleProps> = ({ character, enemy, onVictory, onDefeat }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [bossHp, setBossHp] = useState(enemy.maxHp);
  const [playerHp, setPlayerHp] = useState(3);
  const [score, setScore] = useState(0);
  const [graze, setGraze] = useState(0);
  const [bombs, setBombs] = useState(2);
  
  // Phase Management
  const [currentPhase, setCurrentPhase] = useState(1);
  const [phaseName, setPhaseName] = useState("");
  const [timeLeft, setTimeLeft] = useState(90000); // 90 seconds
  
  // UI Effects
  const [showCutIn, setShowCutIn] = useState(true);
  const [isGlitching, setIsGlitching] = useState(false);
  const [bossShake, setBossShake] = useState(0);

  const [playerSprite, setPlayerSprite] = useState<HTMLImageElement | null>(null);
  const [enemySprite, setEnemySprite] = useState<HTMLImageElement | null>(null);

  const isReimu = enemy.name.includes("Reimu");

  const stateRef = useRef({
    player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, isFocus: false, iframes: 0, shootTimer: 0, hp: 3 },
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    shockwaves: [] as Shockwave[],
    keys: {} as Record<string, boolean>,
    boss: { x: CANVAS_WIDTH / 2, y: 120, targetX: CANVAS_WIDTH / 2, targetY: 120, tick: 0, angle: 0, cooldown: 0 },
    crushingWallY: 0,
    isRunning: true,
    gameActive: false
  });

  useEffect(() => {
    const loadImages = () => {
        const pImg = new Image();
        pImg.src = character.pixelSpriteUrl;
        pImg.onload = () => setPlayerSprite(pImg);

        if (enemy.pixelSpriteUrl) {
            const eImg = new Image();
            eImg.src = enemy.pixelSpriteUrl;
            eImg.onload = () => setEnemySprite(eImg);
        }
    };
    loadImages();

    stateRef.current.player.hp = 3;
    stateRef.current.isRunning = true;
    stateRef.current.gameActive = false;
    stateRef.current.bullets = [];
    stateRef.current.particles = [];
    stateRef.current.crushingWallY = 0;
    
    setPlayerHp(3);
    setShowCutIn(true);
    
    // Initial Phase Name
    setPhaseName(isReimu ? "System Check: Integrity Scan" : enemy.spellCardName);

    const timer = setTimeout(() => {
        setShowCutIn(false);
        stateRef.current.gameActive = true;
    }, 3000);
    return () => clearTimeout(timer);
  }, [character, enemy, isReimu]);

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

  // --- REIMU BOSS PATTERNS ---
  const spawnReimuPattern = (tick: number, bx: number, by: number, phase: number, playerX: number, playerY: number) => {
      const bullets: Bullet[] = [];
      const createBullet = (props: Partial<Bullet>): Bullet => ({
          x: bx, y: by, speed: 3, angle: Math.PI/2, accel: 0, angularVelocity: 0,
          radius: 4, type: BulletType.ORB, color: 'white', isEnemy: true, id: Math.random(), grazed: false,
          maxReflections: 0, ...props
      });

      // PHASE 1: "Efficient Correction" (Non-Spell)
      // Homing Amulets + Reflective Yin-Yang orbs
      if (phase === 1) {
          // Homing Amulets
          if (tick % 60 === 0) {
             for (let i = -2; i <= 2; i++) {
                 if (i===0) continue;
                 bullets.push(createBullet({
                     x: bx + i * 20, y: by, speed: 0.1, accel: 0.1, angle: Math.PI / 2,
                     type: BulletType.AMULET, color: '#FF4444', homing: true, delay: 30, radius: 3
                 }));
             }
          }
          // Reflective Yin-Yang Orbs (Bounce off walls)
          if (tick % 90 === 0) {
              bullets.push(createBullet({ angle: Math.PI * 0.75, speed: 4, type: BulletType.ORB, color: '#FFFFFF', radius: 10, maxReflections: 1 }));
              bullets.push(createBullet({ angle: Math.PI * 0.25, speed: 4, type: BulletType.ORB, color: '#FFFFFF', radius: 10, maxReflections: 1 }));
          }
      }
      
      // PHASE 2: "Infinite Paperwork Avalanche"
      // Falling papers from top corners
      else if (phase === 2) {
          if (tick % 4 === 0) {
              // Left Source
              bullets.push(createBullet({ 
                  x: Math.random() * 50, y: 0, 
                  speed: 2 + Math.random(), angle: Math.PI / 2, 
                  type: BulletType.PAPER, color: '#EEEEEE', accel: 0.05 
              }));
              // Right Source
              bullets.push(createBullet({ 
                  x: CANVAS_WIDTH - Math.random() * 50, y: 0, 
                  speed: 2 + Math.random(), angle: Math.PI / 2, 
                  type: BulletType.PAPER, color: '#FFaaaa', accel: 0.05 
              }));
          }
      }
      
      // PHASE 3: "The Crushing Wall"
      // Deadline Beam moves down + Vertical Lasers
      else if (phase === 3) {
          if (tick % 15 === 0) {
              // Fast vertical lasers
              bullets.push(createBullet({ 
                  x: bx, y: by + 20, 
                  speed: 9, angle: Math.PI / 2, 
                  type: BulletType.LASER_V, color: '#FF0000', radius: 4 
              }));
          }
      }
      
      // PHASE 4: "System Meltdown"
      // Chaos + Glitches
      else if (phase === 4) {
          // Radial bursts
          if (tick % 120 === 0) {
              for(let i=0; i<24; i++) {
                  bullets.push(createBullet({ 
                      angle: (Math.PI * 2 / 24) * i + tick*0.01, 
                      speed: 3, type: BulletType.BIG, color: '#FF0000', radius: 12 
                  }));
              }
          }
          // Random Glitch Pixels appearing anywhere
          if (tick % 3 === 0) {
              bullets.push(createBullet({ 
                  x: Math.random() * CANVAS_WIDTH, 
                  y: Math.random() * CANVAS_HEIGHT * 0.6, 
                  speed: 2 + Math.random()*2, 
                  angle: Math.random() * Math.PI * 2, 
                  type: BulletType.GLITCH, color: '#00FFFF', radius: 2 
              }));
          }
      }
      return bullets;
  };

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
        
        if (state.gameActive) {
            setTimeLeft(prev => {
                if (prev <= 0) { stateRef.current.isRunning = false; onDefeat(); return 0; }
                return prev - 16;
            });
        }

        // --- PHASE TRANSITION LOGIC ---
        const hpPercent = bossHp / enemy.maxHp;
        let newPhase = 1;
        let pName = "Efficient Correction";
        
        if (isReimu) {
             if (hpPercent < PHASE_THRESHOLDS[2]) { newPhase = 4; pName = 'Overwork "System Meltdown"'; }
             else if (hpPercent < PHASE_THRESHOLDS[1]) { newPhase = 3; pName = 'Deadline "The Crushing Wall"'; }
             else if (hpPercent < PHASE_THRESHOLDS[0]) { newPhase = 2; pName = 'Labor Sign "Infinite Paperwork Avalanche"'; }
        } else {
             if (hpPercent < 0.5) newPhase = 2;
             pName = enemy.spellCardName;
        }
        
        if (newPhase !== currentPhase) {
            setCurrentPhase(newPhase);
            setPhaseName(pName);
            setShowCutIn(true);
            setTimeout(() => setShowCutIn(false), 2500);
            
            // Clear bullets on phase change for fairness
            state.bullets = state.bullets.filter(b => !b.isEnemy);
            state.boss.tick = 0;
            state.boss.cooldown = 60;
            
            // Trigger visual glitch
            setIsGlitching(true);
            setTimeout(() => setIsGlitching(false), 300);
        }

        // --- SPECIAL GIMMICK: CRUSHING WALL (Phase 3) ---
        let topLimit = 0;
        if (isReimu && currentPhase === 3) {
            state.crushingWallY = Math.min(state.crushingWallY + 0.15, CANVAS_HEIGHT * 0.6); // Cap at 60% down
            topLimit = state.crushingWallY;
            if (state.player.y < topLimit + 15) {
                // Instant death if touching the deadline wall
                state.player.hp = 0; setPlayerHp(0); stateRef.current.isRunning = false; onDefeat();
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
                state.bullets.push({ x: state.player.x - 8, y: state.player.y - 10, speed: 15, angle: -Math.PI / 2, accel: 0, angularVelocity: 0, radius: 4, type: BulletType.RICE, color: character.bulletColor, isEnemy: false, id: Math.random(), grazed: false });
                state.bullets.push({ x: state.player.x + 8, y: state.player.y - 10, speed: 15, angle: -Math.PI / 2, accel: 0, angularVelocity: 0, radius: 4, type: BulletType.RICE, color: character.bulletColor, isEnemy: false, id: Math.random(), grazed: false });
                state.player.shootTimer = 4;
            }
            state.player.shootTimer--;
        }

        // Boss AI
        if (state.gameActive) {
            state.boss.tick++;
            
            // Reimu Movement Logic
            if (isReimu) {
                if (currentPhase === 1) {
                    // Teleport-ish movement
                    if (state.boss.tick % 180 === 0) { 
                        state.boss.targetX = 50 + Math.random() * (CANVAS_WIDTH - 100); 
                        state.boss.targetY = 50 + Math.random() * 50; 
                    }
                } else if (currentPhase === 3) {
                    // Stay just below the wall
                    state.boss.targetY = state.crushingWallY + 40; 
                    if (state.boss.tick % 45 === 0) {
                        state.boss.targetX = Math.random() * CANVAS_WIDTH;
                    }
                } else {
                    // Standard sway
                    state.boss.targetX = CANVAS_WIDTH / 2 + Math.sin(state.boss.tick * 0.02) * 80;
                    state.boss.targetY = 80 + Math.sin(state.boss.tick * 0.05) * 20;
                }
            } else {
                // Default Enemy Movement
                if (state.boss.tick % 120 === 0) { state.boss.targetX = 100 + Math.random() * (CANVAS_WIDTH - 200); state.boss.targetY = 50 + Math.random() * 100; }
            }

            state.boss.x += (state.boss.targetX - state.boss.x) * 0.08;
            state.boss.y += (state.boss.targetY - state.boss.y) * 0.08;

            if (state.boss.cooldown > 0) state.boss.cooldown--;
            else {
                const pattern = isReimu 
                    ? spawnReimuPattern(state.boss.tick, state.boss.x, state.boss.y, currentPhase, state.player.x, state.player.y) 
                    : []; // Add generic patterns here if needed
                state.bullets.push(...pattern);
            }
        }

        const playerHitbox = isFocus ? 3 : 5;
        const grazeRadius = 24;
        
        // Bullet Physics
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            
            // Homing Logic
            if (b.homing && b.delay && b.delay > 0) {
                b.delay--;
                if (b.delay === 0) { 
                    b.angle = Math.atan2(state.player.y - b.y, state.player.x - b.x); 
                    b.speed = 4; // Launch speed
                } else { 
                    b.speed = 0.5; // Hover speed
                }
            }

            // Paperwork Sway Logic
            if (b.type === BulletType.PAPER) { 
                b.x += Math.sin(state.boss.tick * 0.1 + b.id) * 1.5; 
                b.angle += 0.05; // Spin
            }

            b.speed += b.accel;
            b.angle += b.angularVelocity;
            b.x += Math.cos(b.angle) * b.speed;
            b.y += Math.sin(b.angle) * b.speed;

            // --- MIRROR REFLECTION MECHANIC ---
            let destroy = false;
            if (b.maxReflections && b.maxReflections > 0) {
                 if (b.x <= 0 || b.x >= CANVAS_WIDTH) {
                     b.angle = Math.PI - b.angle; // Reflect horizontally
                     b.maxReflections--;
                     b.color = '#aa00ff'; // Reflected color
                     b.x = Math.max(1, Math.min(CANVAS_WIDTH - 1, b.x));
                     
                     // Add particle effect on bounce
                     state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 10, color: 'white', size: 5, alpha: 1 });
                 }
            }

            if (b.x < -50 || b.x > CANVAS_WIDTH + 50 || b.y < -50 || b.y > CANVAS_HEIGHT + 50) destroy = true;
            if (destroy) { state.bullets.splice(i, 1); continue; }

            // Collision Detection
            if (b.isEnemy) {
                const dx = b.x - state.player.x;
                const dy = b.y - state.player.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (state.player.iframes <= 0) {
                    if (dist < b.radius + playerHitbox) {
                        state.player.hp -= 1;
                        setPlayerHp(state.player.hp);
                        
                        // Hit Effect
                        setIsGlitching(true);
                        setTimeout(() => setIsGlitching(false), 200);
                        state.shockwaves.push({ x: state.player.x, y: state.player.y, r: 10, alpha: 1.0 });

                        if (state.player.hp <= 0) { stateRef.current.isRunning = false; onDefeat(); }
                        else {
                            state.player.iframes = 120;
                            // Clear enemy bullets
                            state.bullets = state.bullets.filter(bull => !bull.isEnemy); 
                            setBombs(2); 
                            state.boss.cooldown = 120;
                        }
                        break; 
                    }
                } else state.player.iframes--;

                if (!b.grazed && dist < b.radius + grazeRadius) {
                    b.grazed = true; setGraze(g => g + 1); setScore(s => s + 500);
                    state.particles.push({ x: state.player.x + (Math.random()-0.5)*10, y: state.player.y + (Math.random()-0.5)*10, vx: 0, vy: -2, life: 15, color: '#fff', size: 1, alpha: 1 });
                }
            } else {
                // Player bullet hitting Boss
                const dx = b.x - state.boss.x;
                const dy = b.y - state.boss.y;
                if (dx*dx + dy*dy < 1600) { // 40px radius
                    setBossHp(h => {
                        const nh = h - 15;
                        if (nh <= 0) { stateRef.current.isRunning = false; onVictory(); return 0; }
                        return nh;
                    });
                    setScore(s => s + 100);
                    state.bullets.splice(i, 1);
                    state.particles.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 10, color: '#ffffaa', size: 3, alpha: 1 });
                    setBossShake(2);
                }
            }
        }
        
        if (bossShake > 0) setBossShake(prev => prev - 1);

        draw(ctx);
        reqId = requestAnimationFrame(update);
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const state = stateRef.current;
        ctx.clearRect(0,0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.save();
        
        // System Meltdown Shake
        if (currentPhase === 4) {
            ctx.translate((Math.random()-0.5)*6, (Math.random()-0.5)*6);
        }

        // Draw Boss
        let bx = state.boss.x;
        let by = state.boss.y;
        if (bossShake > 0) {
            bx += (Math.random()-0.5)*5;
            by += (Math.random()-0.5)*5;
        }

        if (enemySprite) {
            const size = 96;
            ctx.drawImage(enemySprite, bx - size/2, by - size/2, size, size);
        } else {
            ctx.fillStyle = 'red';
            ctx.beginPath(); ctx.arc(bx, by, 30, 0, Math.PI*2); ctx.fill();
        }

        // Draw Crushing Wall (Phase 3)
        if (isReimu && currentPhase === 3 && state.crushingWallY > 0) {
            const y = state.crushingWallY;
            
            // Gradient wall
            const grad = ctx.createLinearGradient(0, y-100, 0, y);
            grad.addColorStop(0, 'rgba(255,0,0,0)');
            grad.addColorStop(0.8, 'rgba(255,0,0,0.5)');
            grad.addColorStop(1, 'rgba(255,0,0,0.9)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, CANVAS_WIDTH, y);
            
            // The Bar itself
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(0, y, CANVAS_WIDTH, 4);
            
            // Warnings
            ctx.fillStyle = '#FF0000';
            ctx.font = '12px monospace';
            ctx.globalAlpha = 0.8 + Math.sin(Date.now() / 100) * 0.2;
            for(let i=0; i<6; i++) ctx.fillText("DEADLINE REACHED", i*100 + (Date.now()/20)%100 - 50, y-10);
            ctx.globalAlpha = 1;
        }

        // Draw Bullets
        state.bullets.forEach(b => {
            ctx.fillStyle = b.color;
            if (b.type === BulletType.PAPER) {
                ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle); 
                ctx.fillRect(-6, -8, 12, 16); // Paper shape
                ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.strokeRect(-6,-8,12,16);
                ctx.restore();
            } else if (b.type === BulletType.AMULET) {
                ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle); 
                ctx.fillStyle = '#AA0000'; ctx.fillRect(-4, -6, 8, 12); 
                ctx.fillStyle = 'white'; ctx.fillRect(-2, -4, 4, 8); 
                ctx.restore();
            } else if (b.type === BulletType.GLITCH) {
                ctx.fillStyle = `hsl(${Math.random()*360}, 100%, 50%)`;
                ctx.fillRect(b.x, b.y, 6, 6);
            } else if (b.type === BulletType.LASER_V) {
                ctx.shadowBlur = 5; ctx.shadowColor = b.color;
                ctx.fillRect(b.x - 2, b.y - 10, 4, 40);
                ctx.shadowBlur = 0;
            } else {
                ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
            }
        });

        // Draw Player
        if (state.player.iframes % 4 < 2) {
            if (playerSprite) {
                const pSize = 48; // Slightly larger for detail
                ctx.drawImage(playerSprite, state.player.x - pSize/2, state.player.y - pSize/2, pSize, pSize);
            } else {
                ctx.fillStyle = 'blue';
                ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 10, 0, Math.PI*2); ctx.fill();
            }
            // Hitbox marker
            if (state.player.isFocus) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 4, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Draw Particles
        state.particles.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy; p.life--;
            ctx.globalAlpha = p.life / 15;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            if(p.life <= 0) state.particles.splice(i, 1);
        });
        ctx.globalAlpha = 1;

        // Mirror Distortion Effect (Center screen)
        if (isReimu) {
             const cx = CANVAS_WIDTH / 2;
             const cy = CANVAS_HEIGHT / 2;
             // Fake "scanline" overlay for the glitchy office look
             ctx.fillStyle = 'rgba(0, 255, 255, 0.02)';
             for(let i=0; i<CANVAS_HEIGHT; i+=4) {
                 ctx.fillRect(0, i + (Date.now()/50)%4, CANVAS_WIDTH, 1);
             }
        }
        
        ctx.restore();
    };
    reqId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(reqId);
  }, [character, enemy, onDefeat, onVictory, playerSprite, enemySprite, isReimu, bossHp, currentPhase, bossShake]);

  // Format Time: MM:SS:MS
  const formatTime = (ms: number) => {
      if (ms < 0) ms = 0;
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const mil = Math.floor((ms % 1000) / 10);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${mil.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex w-full h-screen bg-[#050510] overflow-hidden items-center justify-center font-serif select-none ${isGlitching ? 'hue-rotate-90 contrast-125' : ''}`}>
      <div className="flex shadow-[0_0_50px_rgba(0,255,255,0.2)] border-2 border-cyan-900 bg-[#0f0f1a] relative">
        <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
            
            {/* BACKGROUND */}
            <div className="absolute inset-0 z-0 overflow-hidden" style={{ backgroundImage: `url(${enemy.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                {isReimu ? (
                    <>
                        <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply"></div>
                        {/* Moving grid for tunnel effect */}
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10 animate-[slideY_2s_linear_infinite]" style={{ backgroundSize: '50px 50px' }}></div>
                        <style>{`@keyframes slideY { from { background-position: 0 0; } to { background-position: 0 100px; } }`}</style>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-black/60"></div>
                )}
            </div>

            {/* HUD */}
            <div className="absolute top-0 left-0 right-0 z-30 p-2 font-mono">
                <div className="flex justify-between items-end mb-1 px-2">
                    <div className={`text-xl font-bold ${timeLeft < 10000 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        DEADLINE: {formatTime(timeLeft)}
                    </div>
                    <div className="text-xs text-cyan-600">
                        {currentPhase}/4
                    </div>
                </div>
                
                {/* Boss Health Bar: WORK QUOTA */}
                <div className="w-full h-6 bg-black/80 border border-cyan-700 relative overflow-hidden skew-x-[-10deg]">
                    <div className="absolute inset-0 flex items-center justify-center z-10 text-[10px] text-cyan-200 tracking-[0.5em] font-bold">WORK QUOTA</div>
                    <div 
                        className={`h-full transition-all duration-200 ${bossHp/enemy.maxHp < 0.2 ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`} 
                        style={{ width: `${(bossHp / enemy.maxHp) * 100}%` }} 
                    />
                </div>
            </div>

            {/* SPELL CARD CUT-IN */}
            <div className={`absolute top-24 right-0 z-40 pointer-events-none transition-all duration-500 transform flex flex-col items-end ${showCutIn ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
                 <div className="relative">
                    {/* Enemy Portrait Cut-in */}
                    {enemy.portraitUrl && (
                        <div className="w-[300px] h-[300px] absolute -right-10 -top-10 z-0 overflow-hidden mask-image-gradient">
                            <img src={enemy.portraitUrl} className="w-full h-full object-cover opacity-80" alt="Cut In" />
                            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/80"></div>
                        </div>
                    )}
                    
                    <div className="bg-black/90 border-l-4 border-cyan-500 py-4 px-12 text-right shadow-[0_0_20px_cyan] relative z-10">
                        <h3 className="text-cyan-400 font-mono text-xl font-bold glitch-text">{phaseName}</h3>
                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mt-1">System Alert: High CPU Usage</p>
                    </div>
                 </div>
            </div>

            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="relative z-10 block" />
        </div>

        {/* SIDEBAR */}
        <div className="w-[300px] bg-[#050a14] border-l border-cyan-900 flex flex-col p-6 text-white relative overflow-hidden font-mono z-20">
            <h2 className="text-2xl text-center text-cyan-500 border-b border-cyan-800 pb-4 mb-8 tracking-widest">MONITOR</h2>
            
            <div className="space-y-6">
                <div>
                    <div className="text-cyan-800 text-xs mb-1">SCORE_BUFFER</div>
                    <div className="text-xl text-white font-bold">{score.toLocaleString().padStart(9, '0')}</div>
                </div>
                <div>
                    <div className="text-cyan-800 text-xs mb-1">RETRY_TOKENS (LIVES)</div>
                    <div className="flex gap-2 text-2xl text-yellow-400">
                        {Array(3).fill(0).map((_, i) => <span key={i} className={i < playerHp ? "opacity-100 drop-shadow-[0_0_5px_yellow]" : "opacity-20"}>★</span>)}
                    </div>
                </div>
                <div>
                    <div className="text-cyan-800 text-xs mb-1">MEM_DUMP (BOMBS)</div>
                    <div className="flex gap-2 text-2xl">
                        {Array(bombs).fill(0).map((_, i) => <span key={i} className="text-green-400 drop-shadow-[0_0_5px_green]">♦</span>)}
                    </div>
                </div>
                
                <div className="mt-8 p-4 bg-cyan-900/10 border border-cyan-900/50 rounded">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">GRAZE_COUNT</span>
                        <span className="text-xl text-white">{graze}</span>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-cyan-900/50 text-[10px] text-cyan-700 leading-relaxed">
                <span className="animate-pulse">● CONNECTED</span><br/>
                LATENCY: 12ms<br/>
                RENDER: GL_PIPE_V2<br/>
                ID: {character.id}
            </div>
        </div>
      </div>
    </div>
  );
};
export default DanmakuBattle;
