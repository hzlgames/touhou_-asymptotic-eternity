
import React, { useEffect, useRef, useState } from 'react';
import { Bullet, BulletType, Character, Enemy, Particle } from '../types';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GLOBAL_SPEED_SCALE } from '../constants';

interface DanmakuBattleProps {
  character: Character;
  enemy: Enemy;
  onVictory: () => void;
  onDefeat: () => void;
  onRetreat: () => void; // New prop for returning to map
  onQuit: () => void; // New prop for returning to title
  sprites: Record<string, string>; 
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

interface PlayerOption {
    angle: number;
    targetAngle: number;
    dist: number;
    color: string;
}

// Phase thresholds for boss HP
const PHASE_THRESHOLDS = [0.8, 0.5, 0.2]; 
const LENS_RADIUS = 150;

const DanmakuBattle: React.FC<DanmakuBattleProps> = ({ character, enemy, onVictory, onDefeat, onRetreat, onQuit, sprites }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [bossHp, setBossHp] = useState(enemy.maxHp);
  const [playerHp, setPlayerHp] = useState(3);
  const [score, setScore] = useState(0);
  const [graze, setGraze] = useState(0);
  const [bombs, setBombs] = useState(3); 
  const [isPaused, setIsPaused] = useState(false);
  
  // Phase Management
  const [currentPhase, setCurrentPhase] = useState(1);
  const [phaseName, setPhaseName] = useState("");
  const [timeLeft, setTimeLeft] = useState(90000); // 90 seconds
  
  // UI Effects
  const [showCutIn, setShowCutIn] = useState(true);
  const [isGlitching, setIsGlitching] = useState(false);
  const [bossShake, setBossShake] = useState(0);
  const [timeStopActive, setTimeStopActive] = useState(false);

  const [playerSprite, setPlayerSprite] = useState<HTMLImageElement | null>(null);
  const [enemySprite, setEnemySprite] = useState<HTMLImageElement | null>(null);
  
  // Loaded bullet sprites
  const spriteMapRef = useRef<Record<string, HTMLImageElement>>({});

  const isReimu = enemy.name.includes("Reimu");

  const stateRef = useRef({
    player: { 
        x: CANVAS_WIDTH / 2, 
        y: CANVAS_HEIGHT - 100, 
        isFocus: false, 
        iframes: 0, 
        shootTimer: 0, 
        hp: 3,
        options: [] as PlayerOption[],
        bank: 0 // -1 (Left), 0 (Center), 1 (Right) for banking animation
    },
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    shockwaves: [] as Shockwave[],
    keys: {} as Record<string, boolean>,
    boss: { x: CANVAS_WIDTH / 2, y: 100, targetX: CANVAS_WIDTH / 2, targetY: 100, tick: 0, angle: 0, cooldown: 0 },
    crushingWallY: 0,
    timeStopTimer: 0,
    isRunning: true,
    gameActive: false
  });

  // Initialize Kaguya's Options
  useEffect(() => {
      // 5 Options for 5 Impossible Requests
      stateRef.current.player.options = [
          { angle: 0, targetAngle: 0, dist: 40, color: '#ff0000' }, // Jewel (Red)
          { angle: 72, targetAngle: 72, dist: 40, color: '#00ff00' }, // Branch (Green)
          { angle: 144, targetAngle: 144, dist: 40, color: '#0000ff' }, // Robe (Blue)
          { angle: 216, targetAngle: 216, dist: 40, color: '#ffff00' }, // Bowl (Yellow/Gold)
          { angle: 288, targetAngle: 288, dist: 40, color: '#ff00ff' }  // Shell (Purple)
      ];
  }, []);

  useEffect(() => {
    // Load Character/Enemy Sprites
    const pImg = new Image();
    pImg.src = character.pixelSpriteUrl;
    pImg.onload = () => setPlayerSprite(pImg);

    if (enemy.pixelSpriteUrl) {
        const eImg = new Image();
        eImg.src = enemy.pixelSpriteUrl;
        eImg.onload = () => setEnemySprite(eImg);
    }
    
    // Load Bullet Sprites
    Object.entries(sprites).forEach(([key, url]) => {
        const img = new Image();
        img.src = url;
        spriteMapRef.current[key] = img;
    });

    stateRef.current.player.hp = 3;
    stateRef.current.isRunning = true;
    stateRef.current.gameActive = false;
    stateRef.current.bullets = [];
    stateRef.current.particles = [];
    stateRef.current.crushingWallY = 0;
    
    setPlayerHp(3);
    setShowCutIn(true);
    
    // Initial Phase Name
    setPhaseName(isReimu ? 'Labor Sign "Scanline Printer"' : enemy.spellCardName);

    const timer = setTimeout(() => {
        setShowCutIn(false);
        stateRef.current.gameActive = true;
    }, 3000);
    return () => clearTimeout(timer);
  }, [character, enemy, isReimu, sprites]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        stateRef.current.keys[e.key] = true; 
        
        // TAB Handling (Pause)
        if (e.key === 'Tab') {
            e.preventDefault(); // Stop browser default
            e.stopPropagation();
            setIsPaused(prev => !prev);
        }

        // BOMB TRIGGER (Kaguya: Time Stagnation)
        if (!isPaused && (e.key === 'x' || e.key === 'X') && stateRef.current.gameActive && !stateRef.current.keys['x_held']) {
             stateRef.current.keys['x_held'] = true;
             triggerBomb();
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
        stateRef.current.keys[e.key] = false; 
        if (e.key === 'x' || e.key === 'X') stateRef.current.keys['x_held'] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stateRef.current.isRunning = false;
    };
  }, [isPaused]);

  const triggerBomb = () => {
      if (bombs > 0 && stateRef.current.timeStopTimer <= 0) {
          setBombs(prev => prev - 1);
          // Visual Effect
          stateRef.current.shockwaves.push({ x: stateRef.current.player.x, y: stateRef.current.player.y, r: 10, alpha: 1 });
          // Kaguya Logic: Time Stop
          stateRef.current.timeStopTimer = 300; // 5 seconds of freeze
          setTimeStopActive(true);
          stateRef.current.player.iframes = 300; // Invuln during stop
      }
  };

  // --- REIMU BOSS PATTERNS (DESIGN DOC COMPLIANT) ---
  const spawnReimuPattern = (tick: number, bx: number, by: number, phase: number, playerX: number, playerY: number) => {
      const bullets: Bullet[] = [];
      const createBullet = (props: Partial<Bullet>): Bullet => ({
          x: bx, y: by, speed: 2, angle: Math.PI/2, accel: 0, angularVelocity: 0,
          radius: 8, type: BulletType.ORB, color: 'white', isEnemy: true, id: Math.random(), grazed: false,
          maxReflections: 0, ...props
      });

      // PHASE 1: 'Labor Sign "Scanline Printer"' (Redesigned)
      // Aesthetic: Scans across the screen rigidly, leaving gaps.
      if (phase === 1) {
          const scanPeriod = 80; // Slower scan
          if (tick % scanPeriod === 0) {
              const gapX = (Math.sin(tick * 0.05) * 200) + CANVAS_WIDTH / 2;
              
              for (let x = 30; x < CANVAS_WIDTH - 30; x += 35) {
                  // Leave a gap around the sine wave
                  if (Math.abs(x - gapX) < 70) continue;

                  // Vertical Line
                  bullets.push(createBullet({ 
                      x: x, 
                      y: 50, 
                      speed: 1.5, // Slower speed
                      angle: Math.PI / 2, 
                      type: BulletType.TICKET, // Rectangles
                      color: '#ffcccc', 
                      radius: 12, // Increased Radius
                      delay: (x / CANVAS_WIDTH) * 20 // Wave effect delay
                  }));
              }
          }
          // Occasional "Paper Jam" (Random Debris)
          if (tick % 30 === 0) {
               bullets.push(createBullet({
                   x: bx + (Math.random() - 0.5) * 100,
                   y: by + 20,
                   speed: 1.2,
                   angle: Math.PI / 2 + (Math.random() - 0.5),
                   type: BulletType.SHARD,
                   color: 'red',
                   radius: 6 // Increased Radius
               }));
          }
      }
      
      // PHASE 2: 'Urgent Task "Deadline Pressure"'
      else if (phase === 2) {
          // The bar logic is handled in the main update loop (crushingWallY)
          const wallY = stateRef.current.crushingWallY;
          
          if (tick % 20 === 0) {
              // Dense rain of tickets from the deadline wall
              for(let i=0; i < CANVAS_WIDTH; i += 45) {
                   // Random gap offset
                   const offset = Math.sin(tick * 0.05) * 20; 
                   
                   bullets.push(createBullet({ 
                       x: i + offset + (Math.random()*10), 
                       y: wallY, 
                       speed: 1.5 + Math.random() * 0.5, 
                       angle: Math.PI / 2, 
                       type: BulletType.TICKET, // "Invoices"
                       color: '#ffaaaa', 
                       radius: 10 // Increased Radius
                   }));
              }
          }
      }
      
      // PHASE 3: 'Overwork "Anger of No Tea Time"'
      else if (phase === 3) {
          if (tick % 100 === 0) {
              // Throw Tea Cup
              bullets.push(createBullet({ 
                  x: bx, y: by, 
                  speed: 3.5, 
                  angle: Math.atan2(playerY - by, playerX - bx), 
                  type: BulletType.CUP, 
                  color: '#ffffff', 
                  radius: 18, // Increased Radius
                  timer: 60, // Explodes in 60 frames
                  accel: -0.04 // Slows down to stop
              }));
          }
      }
      
      // PHASE 4: 'System Meltdown "Blue Screen of Death"'
      else if (phase === 4) {
          if (tick % 6 === 0) {
              bullets.push(createBullet({ 
                  x: Math.random() * CANVAS_WIDTH, 
                  y: Math.random() * CANVAS_HEIGHT * 0.5, 
                  speed: 1.5, 
                  angle: Math.random() * Math.PI * 2, 
                  type: BulletType.GLITCH, color: '#00FFFF', radius: 12 
              }));
          }
          if (tick % 70 === 0) {
               // Circle burst
               for(let i=0; i<10; i++) {
                   bullets.push(createBullet({
                       x: bx, y: by,
                       speed: 2.0,
                       angle: (Math.PI * 2 / 10) * i + tick,
                       type: BulletType.SHARD,
                       color: 'red',
                       radius: 6
                   }));
               }
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

    // --- FRAME LOCK ---
    const fps = 60;
    const fpsInterval = 1000 / fps;
    let then = performance.now();
    let elapsed = 0;
    // ------------------

    const update = (now: number) => {
        reqId = requestAnimationFrame(update);

        elapsed = now - then;
        if (elapsed < fpsInterval) return;

        then = now - (elapsed % fpsInterval);

        if (!stateRef.current.isRunning || isPaused) {
             // Keep drawing even if paused
             draw(ctx);
             return;
        }

        const state = stateRef.current;
        const { keys } = state;
        
        // --- TIME STOP LOGIC (BOMB) ---
        let timeScale = 1.0;
        if (state.timeStopTimer > 0) {
            state.timeStopTimer--;
            timeScale = 0.05; // Almost frozen (slow motion)
            if (state.timeStopTimer === 0) {
                // Clear bullets when time resumes
                state.bullets = []; 
                state.shockwaves.push({ x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2, r: 0, alpha: 1 });
                setTimeStopActive(false);
            }
        }
        
        if (state.gameActive && timeScale > 0.1) {
            setTimeLeft(prev => {
                if (prev <= 0) { stateRef.current.isRunning = false; onDefeat(); return 0; }
                return prev - 16;
            });
        }

        // --- PHASE TRANSITION LOGIC ---
        const hpPercent = bossHp / enemy.maxHp;
        let newPhase = 1;
        let pName = 'Labor Sign "Scanline Printer"';
        
        if (isReimu) {
             if (hpPercent < PHASE_THRESHOLDS[2]) { newPhase = 4; pName = 'System Meltdown "Blue Screen of Death"'; }
             else if (hpPercent < PHASE_THRESHOLDS[1]) { newPhase = 3; pName = 'Overwork "Anger of No Tea Time"'; }
             else if (hpPercent < PHASE_THRESHOLDS[0]) { newPhase = 2; pName = 'Urgent Task "Deadline Pressure"'; }
        } else {
             // Generic for other bosses
             if (hpPercent < 0.5) newPhase = 2;
             pName = enemy.spellCardName;
        }
        
        if (newPhase !== currentPhase) {
            setCurrentPhase(newPhase);
            setPhaseName(pName);
            setShowCutIn(true);
            setTimeout(() => setShowCutIn(false), 2500);
            
            // Clear bullets on phase change
            state.bullets = state.bullets.filter(b => !b.isEnemy);
            state.boss.tick = 0;
            state.boss.cooldown = 60;
            state.crushingWallY = 0; // Reset wall
            
            setIsGlitching(true);
            setTimeout(() => setIsGlitching(false), 300);
        }

        // --- PHASE 2 GIMMICK: DEADLINE WALL ---
        let topLimit = 0;
        if (isReimu && currentPhase === 2 && timeScale > 0.5) {
            state.crushingWallY = Math.min(state.crushingWallY + 0.04 * GLOBAL_SPEED_SCALE, CANVAS_HEIGHT * 0.4); // Moves down SLOWER
            topLimit = state.crushingWallY;
        }

        // Player Movement
        const isFocus = keys['Shift'];
        state.player.isFocus = isFocus;
        const moveSpeed = (isFocus ? character.focusSpeed : character.speed) * GLOBAL_SPEED_SCALE;
        
        // Banking Logic (Tilt)
        let bank = 0;
        if ((keys['ArrowLeft'] || keys['a']) && state.player.x > 10) {
            state.player.x -= moveSpeed;
            bank = -1;
        }
        if ((keys['ArrowRight'] || keys['d']) && state.player.x < CANVAS_WIDTH - 10) {
            state.player.x += moveSpeed;
            bank = 1;
        }
        state.player.bank = bank;

        if ((keys['ArrowUp'] || keys['w']) && state.player.y > 10 + topLimit) state.player.y -= moveSpeed;
        if ((keys['ArrowDown'] || keys['s']) && state.player.y < CANVAS_HEIGHT - 10) state.player.y += moveSpeed;

        // --- UPDATE OPTIONS (KAGUYA) ---
        state.player.options.forEach((opt, i) => {
            const rotSpeed = 2.0;
            if (isFocus) {
                // Focus: Form a tight arc behind/around player
                // Angles: 230, 250, 270, 290, 310 (Behind/Up)
                opt.targetAngle = 270 + (i - 2) * 20; 
                opt.dist = 30;
            } else {
                // Unfocus: Rotate continuously
                opt.targetAngle = (opt.angle + rotSpeed) % 360; 
                opt.dist = 50;
            }
            
            // Lerp angle
            // Simple rotation handling for now
            if (isFocus) {
                opt.angle += (opt.targetAngle - opt.angle) * 0.1;
            } else {
                opt.angle = opt.targetAngle;
            }
        });

        // Shooting
        if (keys['z'] || keys[' ']) {
            if (state.player.shootTimer <= 0) {
                // Main Body Shot
                state.bullets.push({ 
                    x: state.player.x, y: state.player.y - 10, 
                    speed: 15, angle: -Math.PI / 2, accel: 0, angularVelocity: 0, radius: 4, 
                    type: BulletType.RICE, color: 'white', isEnemy: false, id: Math.random(), grazed: false 
                });

                // Option Shots (The 5 Impossible Requests)
                state.player.options.forEach(opt => {
                    const rad = opt.angle * (Math.PI / 180);
                    const ox = state.player.x + Math.cos(rad) * opt.dist;
                    const oy = state.player.y + Math.sin(rad) * opt.dist;
                    
                    state.bullets.push({
                        x: ox, y: oy,
                        speed: 12,
                        angle: -Math.PI / 2, // Always shoot up
                        accel: 0, angularVelocity: 0,
                        radius: 3,
                        type: BulletType.DOT,
                        color: opt.color,
                        isEnemy: false,
                        id: Math.random(),
                        grazed: false
                    });
                });

                state.player.shootTimer = 4; // Fast fire
            }
            state.player.shootTimer--;
        }

        // Boss AI
        if (state.gameActive && timeScale > 0.1) {
            state.boss.tick++;
            
            if (isReimu) {
                if (currentPhase === 1) {
                    // PHOTOCOPIER: Step Movement
                    if (state.boss.tick % 60 === 0) {
                        // Move to a new distinct lane
                        const dest = 100 + Math.random() * (CANVAS_WIDTH - 200);
                        state.boss.targetX = dest;
                    }
                    state.boss.y = 80;
                    // Snap movement
                    state.boss.x += (state.boss.targetX - state.boss.x) * 0.1 * GLOBAL_SPEED_SCALE;
                    
                } else if (currentPhase === 2) {
                    // DEADLINE: Hover above the wall
                    state.boss.targetY = state.crushingWallY - 40; 
                    state.boss.x = CANVAS_WIDTH / 2 + Math.sin(state.boss.tick * 0.02) * 100; // Wide sway
                    
                    state.boss.y += (state.boss.targetY - state.boss.y) * 0.1 * GLOBAL_SPEED_SCALE;
                } else if (currentPhase === 3) {
                    // TEA TIME: Frantic movement
                    state.boss.targetX = CANVAS_WIDTH / 2 + Math.sin(state.boss.tick * 0.04) * 150;
                    state.boss.targetY = 100 + Math.cos(state.boss.tick * 0.07) * 40;
                    
                    state.boss.x += (state.boss.targetX - state.boss.x) * 0.05 * GLOBAL_SPEED_SCALE;
                    state.boss.y += (state.boss.targetY - state.boss.y) * 0.05 * GLOBAL_SPEED_SCALE;
                } else {
                    // Default
                    state.boss.x += (state.boss.targetX - state.boss.x) * 0.08 * GLOBAL_SPEED_SCALE;
                    state.boss.y += (state.boss.targetY - state.boss.y) * 0.08 * GLOBAL_SPEED_SCALE;
                }
            } 

            if (state.boss.cooldown > 0) state.boss.cooldown--;
            else {
                const pattern = isReimu 
                    ? spawnReimuPattern(state.boss.tick, state.boss.x, state.boss.y, currentPhase, state.player.x, state.player.y) 
                    : []; 
                state.bullets.push(...pattern);
            }
        }

        // --- HITBOX LOGIC ---
        // Normal Move (Fast) = 2px (Smaller). Focused Move (Slow) = 3px.
        const playerHitbox = isFocus ? 3 : 2;
        const grazeRadius = 24;
        
        // Bullet Physics
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            
            // Check Lens Effect (Inner World)
            const distToLens = Math.sqrt(Math.pow(b.x - CANVAS_WIDTH/2, 2) + Math.pow(b.y - CANVAS_HEIGHT/2, 2));
            const inLens = distToLens < LENS_RADIUS;
            
            // Apply Time Stop Freeze
            let currentSpeed = b.isEnemy ? b.speed * timeScale : b.speed;
            let currentAccel = b.isEnemy ? b.accel * timeScale : b.accel;
            let currentAngVel = b.isEnemy ? b.angularVelocity * timeScale : b.angularVelocity;

            // Apply GLOBAL SPEED SCALE
            currentSpeed *= GLOBAL_SPEED_SCALE;

            // Lens Effect Modifiers
            if (inLens && b.isEnemy) {
                currentSpeed *= 0.7; // Slow down inside the lens ("Truth" is heavier)
                b.color = '#ff0000'; // Turn bullets red/evil
            }

            if (b.delay && b.delay > 0) {
                b.delay--;
                continue; // Don't move yet
            }

            // Exploding Cup Logic (Tea Time)
            if (b.type === BulletType.CUP && b.timer !== undefined) {
                 if (timeScale > 0.5) b.timer--;
                 if (b.timer <= 0) {
                     // EXPLODE
                     for(let k=0; k<12; k++) {
                         state.bullets.push({
                             x: b.x, y: b.y,
                             speed: 2 + Math.random(),
                             angle: (Math.PI*2/12)*k + Math.random()*0.5,
                             type: BulletType.SHARD,
                             color: '#aaffff',
                             radius: 6,
                             isEnemy: true,
                             id: Math.random(),
                             grazed: false,
                             accel: 0, angularVelocity: 0
                         });
                     }
                     // Create explosion effect
                     state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 20, color: 'white', size: 20, alpha: 1 });
                     state.bullets.splice(i, 1);
                     continue;
                 }
            }

            b.speed += currentAccel;
            b.angle += currentAngVel;
            b.x += Math.cos(b.angle) * currentSpeed;
            b.y += Math.sin(b.angle) * currentSpeed;

            if (b.x < -50 || b.x > CANVAS_WIDTH + 50 || b.y < -50 || b.y > CANVAS_HEIGHT + 50) {
                state.bullets.splice(i, 1); 
                continue; 
            }

            // Collision Detection
            if (b.isEnemy) {
                // If Time Stop is active, bullets are ghosted and don't hit (visual only)
                if (state.timeStopTimer > 0) continue;

                const dx = b.x - state.player.x;
                const dy = b.y - state.player.y;
                // Hitbox calculations based on shape
                let dist = Math.sqrt(dx*dx + dy*dy);
                let hitDist = b.radius + playerHitbox;
                
                if (b.type === BulletType.TICKET) hitDist = 10 + playerHitbox; // Square is bigger

                if (state.player.iframes <= 0) {
                    if (dist < hitDist) {
                        state.player.hp -= 1;
                        setPlayerHp(state.player.hp);
                        
                        // HIT FEEDBACK:
                        // 1. Clear Screen
                        state.bullets = state.bullets.filter(bull => !bull.isEnemy);
                        // 2. Pause Boss
                        state.boss.cooldown = 180; // 3 seconds of peace
                        // 3. Shockwave
                        state.shockwaves.push({ x: state.player.x, y: state.player.y, r: 10, alpha: 1.0 });
                        
                        setIsGlitching(true);
                        setTimeout(() => setIsGlitching(false), 200);

                        if (state.player.hp <= 0) { stateRef.current.isRunning = false; onDefeat(); }
                        else {
                            state.player.iframes = 120;
                            setBombs(3); // Reset bombs on death
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
                        const nh = h - 10; // Slightly tankier boss
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
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const state = stateRef.current;
        ctx.clearRect(0,0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // System Meltdown Shake
        ctx.save();
        if (currentPhase === 4) {
            ctx.translate((Math.random()-0.5)*6, (Math.random()-0.5)*6);
        }

        // --- DRAW FUNCTION (Shared logic to allow drawing twice for Lens) ---
        const drawScene = (mode: 'REALITY' | 'VOID') => {
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
                if (mode === 'VOID') {
                    // Boss looks corrupted in void
                    ctx.globalCompositeOperation = 'difference';
                    ctx.drawImage(enemySprite, bx - size/2, by - size/2, size, size);
                    ctx.globalCompositeOperation = 'source-over';
                }
            } else {
                ctx.fillStyle = 'red';
                ctx.beginPath(); ctx.arc(bx, by, 30, 0, Math.PI*2); ctx.fill();
            }

            // Draw Deadline Wall (Phase 2)
            if (isReimu && currentPhase === 2 && state.crushingWallY > 0) {
                const y = state.crushingWallY;
                const grad = ctx.createLinearGradient(0, y-100, 0, y);
                grad.addColorStop(0, 'rgba(255,0,0,0)');
                grad.addColorStop(1, 'rgba(255,0,0,0.6)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, CANVAS_WIDTH, y);
                
                ctx.strokeStyle = '#FF0000';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
            }

            // Draw Bullets
            state.bullets.forEach(b => {
                
                if (state.timeStopTimer > 0 && b.isEnemy) {
                    ctx.fillStyle = '#555555'; 
                    ctx.globalAlpha = 0.5;
                } else {
                    ctx.fillStyle = mode === 'VOID' && b.isEnemy ? '#ff0000' : b.color;
                    ctx.globalAlpha = 1;
                }

                // Determine if we have a sprite for this bullet type
                let spriteKey = null;
                if (b.type === BulletType.TICKET) spriteKey = 'BULLET_TICKET';
                else if (b.type === BulletType.CUP) spriteKey = 'BULLET_CUP';
                else if (b.type === BulletType.SHARD) spriteKey = 'BULLET_SHARD';
                else if (b.type === BulletType.GLITCH) spriteKey = 'BULLET_GLITCH';
                else if (b.type === BulletType.AMULET) spriteKey = 'BULLET_OFUDA';

                const sprite = spriteKey ? spriteMapRef.current[spriteKey] : null;

                if (sprite) {
                    const sSize = b.radius * 3.5; // Scaled up sprite
                    ctx.save();
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.angle + (b.type === BulletType.CUP ? 0 : Math.PI/2)); 
                    ctx.drawImage(sprite, -sSize/2, -sSize/2, sSize, sSize);
                    ctx.restore();
                } else {
                    // Fallback / Default Shapes
                    if (b.type === BulletType.TICKET) { 
                        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle); 
                        ctx.fillRect(-10, -12, 20, 24); // Larger rect
                        ctx.fillStyle = 'black'; 
                        ctx.fillRect(-6, -6, 12, 1); ctx.fillRect(-6, 0, 12, 1); ctx.fillRect(-6, 6, 8, 1);
                        ctx.restore();
                    } else if (b.type === BulletType.CUP) { 
                        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
                        ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI, false); ctx.fill(); 
                        ctx.fillRect(-8, -8, 16, 2); 
                        ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(6, -2, 4, 0, Math.PI*2); ctx.stroke();
                        ctx.restore();
                    } else if (b.type === BulletType.SHARD) {
                        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
                        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.fill();
                        ctx.restore();
                    } else if (b.type === BulletType.ORB) { 
                        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(state.boss.tick * 0.1); 
                        ctx.beginPath(); ctx.arc(0,0,b.radius, 0, Math.PI*2); ctx.fill();
                        ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(0,0,b.radius/2, 0, Math.PI*2); ctx.fill();
                        ctx.restore();
                    } else {
                        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
                    }
                }
            });
            ctx.globalAlpha = 1;

            // Draw Shockwaves
            for(let i=state.shockwaves.length-1; i>=0; i--) {
                const sw = state.shockwaves[i];
                ctx.beginPath();
                ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI*2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${sw.alpha})`;
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Draw Player & Options
            if (state.player.iframes % 4 < 2) {
                // Options
                state.player.options.forEach(opt => {
                    const rad = opt.angle * (Math.PI / 180);
                    const ox = state.player.x + Math.cos(rad) * opt.dist;
                    const oy = state.player.y + Math.sin(rad) * opt.dist;
                    
                    ctx.save();
                    ctx.translate(ox, oy);
                    ctx.rotate(state.boss.tick * 0.1);
                    ctx.fillStyle = opt.color;
                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.arc(0, 0, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.restore();
                });

                if (playerSprite) {
                    const pSize = 48; 
                    
                    if (character.spriteSheetType === 'GRID_4x4') {
                        // 4x4 GRID LOGIC for Battle (Vertical Shooter)
                        // Rows: 0=Down, 1=Left, 2=Right, 3=Up(Back)
                        // We primarily use Row 3 (Back) since we are shooting up.
                        // We use Row 1 or 2 when banking left/right.
                        
                        let row = 3; // Default: Back view
                        if (state.player.bank === -1) row = 1; // Left
                        if (state.player.bank === 1) row = 2;  // Right
                        
                        // Use Column 1 for movement loop? Or simple toggle?
                        // Let's use Col 1.
                        const col = 1;

                        const fw = playerSprite.width / 4;
                        const fh = playerSprite.height / 4;
                        
                        ctx.drawImage(playerSprite, col*fw, row*fh, fw, fh, state.player.x - pSize/2, state.player.y - pSize/2, pSize, pSize);

                    } else if (character.spriteSheetType === 'GRID_3x3') {
                        // Use Row 2 (Back View) for vertical shooter
                        let col = 1; // Center frame of Back View
                        if (state.player.bank === -1) col = 0; // Left
                        if (state.player.bank === 1) col = 2;  // Right

                        const fw = playerSprite.width / 3;
                        const fh = playerSprite.height / 3;
                        const srcX = col * fw;
                        const srcY = 2 * fh; // Row 2 (Back View)

                        ctx.drawImage(playerSprite, srcX, srcY, fw, fh, state.player.x - pSize/2, state.player.y - pSize/2, pSize, pSize);

                    } else {
                        // Legacy single sprite
                        ctx.drawImage(playerSprite, state.player.x - pSize/2, state.player.y - pSize/2, pSize, pSize);
                    }
                } else {
                    ctx.fillStyle = 'blue';
                    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 10, 0, Math.PI*2); ctx.fill();
                }
                
                // --- DRAW HITBOX (DEBUG STYLE) ---
                if (state.player.isFocus) {
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 3, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.stroke();
                }
            }
        }

        // 1. Draw REALITY (Base Layer)
        drawScene('REALITY');

        // 2. Draw LENS (Void Layer with Clip)
        ctx.save();
        ctx.beginPath();
        ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, LENS_RADIUS, 0, Math.PI * 2);
        ctx.clip();

        // Draw Void Background inside Lens
        const grad = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 0, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, LENS_RADIUS);
        grad.addColorStop(0, '#330000');
        grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Draw Scanlines in Void
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        for(let i=0; i<CANVAS_HEIGHT; i+=4) {
            ctx.fillRect(CANVAS_WIDTH/2 - LENS_RADIUS, i, LENS_RADIUS*2, 1);
        }

        drawScene('VOID');
        
        // Draw Lens Border
        ctx.restore(); // Remove clip
        ctx.beginPath();
        ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, LENS_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore(); // Restore shake transform
    };
    reqId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(reqId);
  }, [character, enemy, onDefeat, onVictory, playerSprite, enemySprite, isReimu, bossHp, currentPhase, bossShake, sprites, isPaused]);

  // Format Time: MM:SS:MS
  const formatTime = (ms: number) => {
      if (ms < 0) ms = 0;
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const mil = Math.floor((ms % 1000) / 10);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${mil.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex w-full h-screen bg-[#050510] overflow-hidden items-center justify-center font-serif select-none outline-none ${isGlitching ? 'hue-rotate-90 contrast-125' : ''}`} tabIndex={0} autoFocus>
      <div className="flex shadow-[0_0_50px_rgba(0,255,255,0.2)] border-2 border-cyan-900 bg-[#0f0f1a] relative">
        <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
            
            {/* BACKGROUND */}
            <div className={`absolute inset-0 z-0 overflow-hidden transition-all duration-500 ${timeStopActive ? 'grayscale brightness-50' : ''}`} style={{ backgroundImage: `url(${enemy.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                {isReimu ? (
                    <>
                        <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10 animate-[slideY_2s_linear_infinite]" style={{ backgroundSize: '50px 50px' }}></div>
                        <style>{`@keyframes slideY { from { background-position: 0 0; } to { background-position: 0 100px; } }`}</style>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-black/60"></div>
                )}
            </div>

            {/* TIME STOP OVERLAY */}
            {timeStopActive && (
                <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                    <div className="text-4xl text-white font-serif tracking-[0.5em] animate-pulse drop-shadow-[0_0_10px_white]">
                        TIME STAGNATION
                    </div>
                    <div className="absolute inset-0 border-8 border-white opacity-20"></div>
                </div>
            )}
            
            {/* PAUSE MENU */}
            {isPaused && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <h2 className="text-4xl text-cyan-400 font-mono mb-8 tracking-[0.5em]">PAUSED</h2>
                    <div className="flex flex-col gap-4">
                        <button onClick={() => setIsPaused(false)} className="px-8 py-2 border border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-black font-mono">RESUME</button>
                        <button onClick={onRetreat} className="px-8 py-2 border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-mono">GIVE UP (RETREAT)</button>
                        <button onClick={onQuit} className="px-8 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black font-mono">RETURN TO TITLE</button>
                    </div>
                </div>
            )}

            {/* HUD */}
            <div className="absolute top-0 left-0 right-0 z-30 p-2 font-mono pointer-events-none">
                <div className="flex justify-between items-end mb-1 px-2">
                    <div className={`text-xl font-bold ${timeLeft < 10000 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        DEADLINE: {formatTime(timeLeft)}
                    </div>
                    <div className="text-xs text-cyan-600">
                        {currentPhase}/4
                    </div>
                </div>
                
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
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className={`relative w-8 h-8 transition-opacity ${i < playerHp ? "opacity-100" : "opacity-20"}`}>
                                {sprites['ICON_LIFE'] ? (
                                    <img src={sprites['ICON_LIFE']} alt="Life" className="w-full h-full object-contain drop-shadow-[0_0_5px_yellow]" />
                                ) : (
                                    <span>★</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="text-cyan-800 text-xs mb-1">TIME STAGNATION (BOMBS)</div>
                    <div className="text-xs text-gray-500 mb-2">[PRESS X]</div>
                    <div className="flex gap-2 text-2xl">
                        {Array(bombs).fill(0).map((_, i) => (
                             <div key={i} className="relative w-8 h-8 animate-pulse">
                                {sprites['ICON_BOMB'] ? (
                                    <img src={sprites['ICON_BOMB']} alt="Bomb" className="w-full h-full object-contain drop-shadow-[0_0_5px_purple]" />
                                ) : (
                                    <span>⏳</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="mt-8 p-4 bg-cyan-900/10 border border-cyan-900/50 rounded">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">GRAZE_COUNT</span>
                        <span className="text-xl text-white">{graze}</span>
                    </div>
                </div>
                
                <div className="mt-8">
                     <div className="text-cyan-800 text-xs mb-1">SYSTEM CONTROLS</div>
                     <div className="text-xs text-gray-400">TAB - PAUSE</div>
                     <div className="text-xs text-gray-400">SHIFT - FOCUS</div>
                     <div className="text-xs text-gray-400">Z - FIRE</div>
                     <div className="text-xs text-gray-400">X - BOMB</div>
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
