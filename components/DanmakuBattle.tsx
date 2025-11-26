
import React, { useEffect, useRef, useState } from 'react';
import { Bullet, BulletType, Character, CharacterId, Enemy, Particle } from '../types';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GLOBAL_SPEED_SCALE } from '../constants';
import { spawnReimuPattern, getReimuPhaseInfo } from './patterns/Stage1Reimu';
import KaguyaHUD from './ui/KaguyaHUD';
import MokouHUD from './ui/MokouHUD';
import HoloScroll from './ui/HoloScroll';

interface DanmakuBattleProps {
  character: Character;
  enemy: Enemy;
  onVictory: () => void;
  onDefeat: () => void;
  onRetreat: () => void;
  onQuit: () => void;
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
  const [timeLeft, setTimeLeft] = useState(90000); 
  
  // UI Effects
  const [showCutIn, setShowCutIn] = useState(true);
  const [isGlitching, setIsGlitching] = useState(false);
  const [bossShake, setBossShake] = useState(0);
  const [timeStopActive, setTimeStopActive] = useState(false);

  const [playerSprite, setPlayerSprite] = useState<HTMLImageElement | null>(null);
  const [enemySprite, setEnemySprite] = useState<HTMLImageElement | null>(null);
  
  const spriteMapRef = useRef<Record<string, HTMLImageElement>>({});

  const isReimu = enemy.name.includes("Reimu");

  // Determine correct background URL
  const bgUrl = isReimu && sprites['STAGE1_BOSS_BG_RAW'] // Check raw if passed, otherwise default to enemy prop
      ? sprites['STAGE1_BOSS_BG_RAW'] 
      : (enemy.backgroundUrl || sprites['STAGE1_BOSS_BG'] || ''); // Fallback

  const stateRef = useRef({
    player: { 
        x: CANVAS_WIDTH / 2, 
        y: CANVAS_HEIGHT - 100, 
        isFocus: false, 
        iframes: 0, 
        shootTimer: 0, 
        hp: 3,
        options: [] as PlayerOption[],
        bank: 0 
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

  // Track time separately to handle pause correctly
  const lastTimeRef = useRef(performance.now());

  // Initialize
  useEffect(() => {
      stateRef.current.player.options = [
          { angle: 0, targetAngle: 0, dist: 40, color: '#ff0000' }, 
          { angle: 72, targetAngle: 72, dist: 40, color: '#00ff00' }, 
          { angle: 144, targetAngle: 144, dist: 40, color: '#0000ff' }, 
          { angle: 216, targetAngle: 216, dist: 40, color: '#ffff00' }, 
          { angle: 288, targetAngle: 288, dist: 40, color: '#ff00ff' }  
      ];
  }, []);

  useEffect(() => {
    const pImg = new Image();
    pImg.src = character.pixelSpriteUrl;
    pImg.onload = () => setPlayerSprite(pImg);

    if (enemy.pixelSpriteUrl) {
        const eImg = new Image();
        eImg.src = enemy.pixelSpriteUrl;
        eImg.onload = () => setEnemySprite(eImg);
    }
    
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
    const info = isReimu ? getReimuPhaseInfo(1) : { phase: 1, name: enemy.spellCardName };
    setPhaseName(info.name);

    const timer = setTimeout(() => {
        setShowCutIn(false);
        stateRef.current.gameActive = true;
    }, 3000);
    return () => clearTimeout(timer);
  }, [character, enemy, isReimu, sprites]);

  // Input Handling with PreventDefault
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'z', 'Z', 'Shift'].includes(e.key)) {
            e.preventDefault(); 
        }
        
        stateRef.current.keys[e.key] = true; 
        
        if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            setIsPaused(prev => !prev);
        }

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
  }, [isPaused]); // Dependency on isPaused is fine here as listeners are cheap

  const triggerBomb = () => {
      if (bombs > 0 && stateRef.current.timeStopTimer <= 0) {
          setBombs(prev => prev - 1);
          stateRef.current.shockwaves.push({ x: stateRef.current.player.x, y: stateRef.current.player.y, r: 10, alpha: 1 });
          stateRef.current.timeStopTimer = 300; 
          setTimeStopActive(true);
          stateRef.current.player.iframes = 300;
      }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let reqId: number;
    const fps = 60;
    const fpsInterval = 1000 / fps;

    // Reset time tracker when effect mounts (resumes)
    lastTimeRef.current = performance.now();

    const update = (now: number) => {
        reqId = requestAnimationFrame(update);

        // Pause Logic: If paused, just update the timestamp so we don't jump when resuming
        if (isPaused) {
            lastTimeRef.current = now;
            draw(ctx); // Keep drawing static frame
            return;
        }

        const elapsed = now - lastTimeRef.current;
        if (elapsed < fpsInterval) return;

        // Correct drift
        lastTimeRef.current = now - (elapsed % fpsInterval);

        if (!stateRef.current.isRunning) return;

        const state = stateRef.current;
        const { keys } = state;
        
        // --- TIME STOP LOGIC ---
        let timeScale = 1.0;
        if (state.timeStopTimer > 0) {
            state.timeStopTimer--;
            timeScale = 0.05; 
            if (state.timeStopTimer === 0) {
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
        let newPhaseInfo = { phase: 1, name: "" };
        
        if (isReimu) {
             newPhaseInfo = getReimuPhaseInfo(hpPercent);
        } else {
             if (hpPercent < 0.5) newPhaseInfo = { phase: 2, name: enemy.spellCardName };
             else newPhaseInfo = { phase: 1, name: enemy.spellCardName };
        }
        
        if (newPhaseInfo.phase !== currentPhase) {
            setCurrentPhase(newPhaseInfo.phase);
            setPhaseName(newPhaseInfo.name);
            setShowCutIn(true);
            setTimeout(() => setShowCutIn(false), 2500);
            
            state.bullets = state.bullets.filter(b => !b.isEnemy);
            state.boss.tick = 0;
            state.boss.cooldown = 60;
            state.crushingWallY = 0;
            
            setIsGlitching(true);
            setTimeout(() => setIsGlitching(false), 300);
        }

        // --- GIMMICK: DEADLINE WALL ---
        let topLimit = 0;
        if (isReimu && currentPhase === 2 && timeScale > 0.5) {
            state.crushingWallY = Math.min(state.crushingWallY + 0.04 * GLOBAL_SPEED_SCALE, CANVAS_HEIGHT * 0.4);
            topLimit = state.crushingWallY;
        }

        // --- PLAYER MOVEMENT ---
        const isFocus = keys['Shift'];
        state.player.isFocus = isFocus;
        const moveSpeed = (isFocus ? character.focusSpeed : character.speed) * GLOBAL_SPEED_SCALE;
        
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

        // --- OPTIONS UPDATE ---
        state.player.options.forEach((opt, i) => {
            if (isFocus) {
                opt.targetAngle = 270 + (i - 2) * 20; 
                opt.dist = 30;
            } else {
                opt.targetAngle = (opt.angle + 2.0) % 360; 
                opt.dist = 50;
            }
            if (isFocus) opt.angle += (opt.targetAngle - opt.angle) * 0.1;
            else opt.angle = opt.targetAngle;
        });

        // --- SHOOTING ---
        if (keys['z'] || keys['Z'] || keys[' ']) {
            if (state.player.shootTimer <= 0) {
                state.bullets.push({ 
                    x: state.player.x, y: state.player.y - 10, 
                    speed: 15, angle: -Math.PI / 2, accel: 0, angularVelocity: 0, radius: 4, 
                    type: BulletType.RICE, color: 'white', isEnemy: false, id: Math.random(), grazed: false 
                });

                state.player.options.forEach(opt => {
                    const rad = opt.angle * (Math.PI / 180);
                    const ox = state.player.x + Math.cos(rad) * opt.dist;
                    const oy = state.player.y + Math.sin(rad) * opt.dist;
                    state.bullets.push({
                        x: ox, y: oy, speed: 12, angle: -Math.PI / 2, accel: 0, angularVelocity: 0,
                        radius: 3, type: BulletType.DOT, color: opt.color, isEnemy: false, id: Math.random(), grazed: false
                    });
                });
                state.player.shootTimer = 4;
            }
            state.player.shootTimer--;
        }

        // --- BOSS AI ---
        if (state.gameActive && timeScale > 0.1) {
            state.boss.tick++;
            
            if (isReimu) {
                if (currentPhase === 1) {
                    if (state.boss.tick % 60 === 0) state.boss.targetX = 100 + Math.random() * (CANVAS_WIDTH - 200);
                    state.boss.y = 80;
                    state.boss.x += (state.boss.targetX - state.boss.x) * 0.1 * GLOBAL_SPEED_SCALE;
                } else if (currentPhase === 2) {
                    state.boss.targetY = state.crushingWallY - 40; 
                    state.boss.x = CANVAS_WIDTH / 2 + Math.sin(state.boss.tick * 0.02) * 100;
                    state.boss.y += (state.boss.targetY - state.boss.y) * 0.1 * GLOBAL_SPEED_SCALE;
                } else if (currentPhase === 3) {
                    state.boss.targetX = CANVAS_WIDTH / 2 + Math.sin(state.boss.tick * 0.04) * 150;
                    state.boss.targetY = 100 + Math.cos(state.boss.tick * 0.07) * 40;
                    state.boss.x += (state.boss.targetX - state.boss.x) * 0.05 * GLOBAL_SPEED_SCALE;
                    state.boss.y += (state.boss.targetY - state.boss.y) * 0.05 * GLOBAL_SPEED_SCALE;
                } else {
                    state.boss.x += (state.boss.targetX - state.boss.x) * 0.08 * GLOBAL_SPEED_SCALE;
                    state.boss.y += (state.boss.targetY - state.boss.y) * 0.08 * GLOBAL_SPEED_SCALE;
                }
            } 

            if (state.boss.cooldown > 0) state.boss.cooldown--;
            else {
                const pattern = isReimu 
                    ? spawnReimuPattern(state.boss.tick, state.boss.x, state.boss.y, currentPhase, state.player.x, state.player.y, state.crushingWallY) 
                    : []; 
                state.bullets.push(...pattern);
            }
        }

        // --- PHYSICS & COLLISIONS ---
        const playerHitbox = isFocus ? 2 : 1;
        const grazeRadius = 30;
        
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            
            // Lens Effect
            const distToLens = Math.sqrt(Math.pow(b.x - CANVAS_WIDTH/2, 2) + Math.pow(b.y - CANVAS_HEIGHT/2, 2));
            const inLens = distToLens < LENS_RADIUS;
            
            let currentSpeed = b.isEnemy ? b.speed * timeScale : b.speed;
            let currentAccel = b.isEnemy ? b.accel * timeScale : b.accel;
            let currentAngVel = b.isEnemy ? b.angularVelocity * timeScale : b.angularVelocity;

            currentSpeed *= GLOBAL_SPEED_SCALE;

            if (inLens && b.isEnemy) {
                currentSpeed *= 0.7; 
                b.color = '#ff0000';
            }

            if (b.delay && b.delay > 0) { b.delay--; continue; }

            // Exploding Cup
            if (b.type === BulletType.CUP && b.timer !== undefined) {
                 if (timeScale > 0.5) b.timer--;
                 if (b.timer <= 0) {
                     for(let k=0; k<12; k++) {
                         state.bullets.push({
                             x: b.x, y: b.y, speed: 2 + Math.random(), angle: (Math.PI*2/12)*k + Math.random()*0.5,
                             type: BulletType.SHARD, color: '#aaffff', radius: 6, isEnemy: true, id: Math.random(), grazed: false, accel: 0, angularVelocity: 0
                         });
                     }
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

            if (b.isEnemy) {
                if (state.timeStopTimer > 0) continue;

                const dx = b.x - state.player.x;
                const dy = b.y - state.player.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                let hitDist = b.radius + playerHitbox;
                if (b.type === BulletType.TICKET) hitDist = 10 + playerHitbox;

                if (state.player.iframes <= 0) {
                    if (dist < hitDist) {
                        state.player.hp -= 1;
                        setPlayerHp(state.player.hp);
                        
                        state.bullets = state.bullets.filter(bull => !bull.isEnemy);
                        state.boss.cooldown = 180; 
                        state.shockwaves.push({ x: state.player.x, y: state.player.y, r: 10, alpha: 1.0 });
                        
                        setIsGlitching(true);
                        setTimeout(() => setIsGlitching(false), 200);

                        if (state.player.hp <= 0) { stateRef.current.isRunning = false; onDefeat(); }
                        else {
                            state.player.iframes = 120;
                            setBombs(3);
                        }
                        break; 
                    }
                } else state.player.iframes--;

                if (!b.grazed && dist < b.radius + grazeRadius) {
                    b.grazed = true; setGraze(g => g + 1); setScore(s => s + 500);
                    state.particles.push({ x: state.player.x + (Math.random()-0.5)*10, y: state.player.y + (Math.random()-0.5)*10, vx: 0, vy: -2, life: 15, color: '#fff', size: 1, alpha: 1 });
                }
            } else {
                const dx = b.x - state.boss.x;
                const dy = b.y - state.boss.y;
                if (dx*dx + dy*dy < 1600) {
                    setBossHp(h => {
                        const nh = h - 10;
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
        
        ctx.save();
        if (currentPhase === 4) ctx.translate((Math.random()-0.5)*6, (Math.random()-0.5)*6);

        const drawScene = (mode: 'REALITY' | 'VOID') => {
            // Draw Boss
            let bx = state.boss.x;
            let by = state.boss.y;
            if (bossShake > 0) { bx += (Math.random()-0.5)*5; by += (Math.random()-0.5)*5; }

            if (enemySprite) {
                const size = 96;
                ctx.drawImage(enemySprite, bx - size/2, by - size/2, size, size);
                if (mode === 'VOID') {
                    ctx.globalCompositeOperation = 'difference';
                    ctx.drawImage(enemySprite, bx - size/2, by - size/2, size, size);
                    ctx.globalCompositeOperation = 'source-over';
                }
            } else {
                ctx.fillStyle = 'red';
                ctx.beginPath(); ctx.arc(bx, by, 30, 0, Math.PI*2); ctx.fill();
            }

            // Draw Deadline Wall
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
                    ctx.fillStyle = '#555555'; ctx.globalAlpha = 0.5;
                } else {
                    ctx.fillStyle = mode === 'VOID' && b.isEnemy ? '#ff0000' : b.color; ctx.globalAlpha = 1;
                }

                let spriteKey = null;
                if (b.type === BulletType.TICKET) spriteKey = 'BULLET_TICKET';
                else if (b.type === BulletType.CUP) spriteKey = 'BULLET_CUP';
                else if (b.type === BulletType.SHARD) spriteKey = 'BULLET_SHARD';
                else if (b.type === BulletType.GLITCH) spriteKey = 'BULLET_GLITCH';
                else if (b.type === BulletType.AMULET) spriteKey = 'BULLET_OFUDA';

                const sprite = spriteKey ? spriteMapRef.current[spriteKey] : null;

                if (sprite) {
                    const sSize = b.radius * 3.5;
                    ctx.save(); ctx.translate(b.x, b.y);
                    ctx.rotate(b.angle + (b.type === BulletType.CUP ? 0 : Math.PI/2)); 
                    ctx.drawImage(sprite, -sSize/2, -sSize/2, sSize, sSize);
                    ctx.restore();
                } else {
                    if (b.type === BulletType.TICKET) { 
                        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle); 
                        ctx.fillRect(-10, -12, 20, 24); 
                        ctx.fillStyle = 'black'; 
                        ctx.fillRect(-6, -6, 12, 1); ctx.fillRect(-6, 0, 12, 1); ctx.fillRect(-6, 6, 8, 1);
                        ctx.restore();
                    } else if (b.type === BulletType.CUP) { 
                        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
                        ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI, false); ctx.fill(); 
                        ctx.fillRect(-8, -8, 16, 2); 
                        ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(6, -2, 4, 0, Math.PI*2); ctx.stroke();
                        ctx.restore();
                    } else {
                        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
                    }
                }
            });
            ctx.globalAlpha = 1;

            // Draw Player
            if (state.player.iframes % 4 < 2) {
                state.player.options.forEach(opt => {
                    const rad = opt.angle * (Math.PI / 180);
                    const ox = state.player.x + Math.cos(rad) * opt.dist;
                    const oy = state.player.y + Math.sin(rad) * opt.dist;
                    ctx.save(); ctx.translate(ox, oy); ctx.rotate(state.boss.tick * 0.1);
                    ctx.fillStyle = opt.color; ctx.globalAlpha = 0.7;
                    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.stroke();
                    ctx.restore();
                });

                if (playerSprite) {
                    const pSize = 48; 
                    if (character.spriteSheetType === 'GRID_4x4') {
                        let row = 3; 
                        if (state.player.bank === -1) row = 1;
                        if (state.player.bank === 1) row = 2;
                        const fw = playerSprite.width / 4;
                        const fh = playerSprite.height / 4;
                        ctx.drawImage(playerSprite, 1*fw, row*fh, fw, fh, state.player.x - pSize/2, state.player.y - pSize/2, pSize, pSize);
                    } else if (character.spriteSheetType === 'GRID_3x3') {
                        let col = 1; if (state.player.bank === -1) col = 0; if (state.player.bank === 1) col = 2;
                        const fw = playerSprite.width / 3; const fh = playerSprite.height / 3;
                        ctx.drawImage(playerSprite, col*fw, 2*fh, fw, fh, state.player.x - pSize/2, state.player.y - pSize/2, pSize, pSize);
                    } else {
                        ctx.drawImage(playerSprite, state.player.x - pSize/2, state.player.y - pSize/2, pSize, pSize);
                    }
                } else {
                    ctx.fillStyle = 'blue'; ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 10, 0, Math.PI*2); ctx.fill();
                }
                
                if (state.player.isFocus) {
                    ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 3, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.stroke();
                }
            }
        };

        drawScene('REALITY');

        ctx.save();
        ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, LENS_RADIUS, 0, Math.PI * 2); ctx.clip();
        const grad = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 0, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, LENS_RADIUS);
        grad.addColorStop(0, '#330000'); grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        for(let i=0; i<CANVAS_HEIGHT; i+=4) ctx.fillRect(CANVAS_WIDTH/2 - LENS_RADIUS, i, LENS_RADIUS*2, 1);
        drawScene('VOID');
        ctx.restore();
        
        ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, LENS_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    };

    reqId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(reqId);
  }, [character, enemy, onDefeat, onVictory, playerSprite, enemySprite, isReimu, bossHp, currentPhase, bossShake, sprites, isPaused]);

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
            
            {/* BACKGROUND - FORCED LOW BRIGHTNESS */}
            <div className={`absolute inset-0 z-0 overflow-hidden transition-all duration-500 ${timeStopActive ? 'grayscale brightness-50' : ''}`} 
                 style={{ 
                     backgroundImage: `url(${bgUrl})`, 
                     backgroundSize: 'cover', 
                     backgroundPosition: 'center',
                     filter: 'brightness(0.3) contrast(1.2)' 
                 }}>
                {isReimu && (
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10 animate-[slideY_2s_linear_infinite]" style={{ backgroundSize: '50px 50px' }}></div>
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

            {/* CUT-IN / PORTRAIT (RIGHT SIDE) - USING HOLO DIALOGUE ONLY NOW */}
             {showCutIn && (
                <HoloScroll 
                    title={phaseName} 
                    text={`System Alert: Anomaly Detected. Threat Level: ${currentPhase}.`} 
                    portraitUrl={enemy.portraitUrl}
                />
            )}

            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="relative z-10 block" />
        </div>

        {/* SIDEBAR - MODULAR UI */}
        {character.id === CharacterId.KAGUYA ? (
            <KaguyaHUD 
                hp={playerHp} 
                maxHp={3} 
                bombs={bombs} 
                score={score} 
                graze={graze} 
                sprites={sprites} 
            />
        ) : (
            <MokouHUD 
                hp={playerHp} 
                maxHp={3} 
                bombs={bombs} 
                score={score} 
                graze={graze} 
                sprites={sprites} 
            />
        )}
      </div>
    </div>
  );
};
export default DanmakuBattle;
