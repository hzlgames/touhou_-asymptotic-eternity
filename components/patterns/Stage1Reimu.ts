
import { Bullet, BulletType } from '../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants';

// Helper to create bullets easily
const createBullet = (props: Partial<Bullet>): Bullet => ({
    x: 0, y: 0, speed: 2, angle: Math.PI/2, accel: 0, angularVelocity: 0,
    radius: 8, type: BulletType.ORB, color: 'white', isEnemy: true, id: Math.random(), grazed: false,
    maxReflections: 0, ...props
});

export const getReimuPhaseInfo = (hpPercent: number) => {
    if (hpPercent < 0.2) return { phase: 4, name: 'System Meltdown "Blue Screen of Death"' };
    if (hpPercent < 0.5) return { phase: 3, name: 'Overwork "Anger of No Tea Time"' };
    if (hpPercent < 0.8) return { phase: 2, name: 'Urgent Task "Deadline Pressure"' };
    return { phase: 1, name: 'Labor Sign "Scanline Printer"' };
};

export const spawnReimuPattern = (tick: number, bx: number, by: number, phase: number, playerX: number, playerY: number, crushingWallY: number): Bullet[] => {
    const bullets: Bullet[] = [];

    // PHASE 1: 'Labor Sign "Scanline Printer"'
    if (phase === 1) {
        const scanPeriod = 80;
        if (tick % scanPeriod === 0) {
            const gapX = (Math.sin(tick * 0.05) * 200) + CANVAS_WIDTH / 2;
            
            for (let x = 30; x < CANVAS_WIDTH - 30; x += 50) {
                if (Math.abs(x - gapX) < 70) continue;

                bullets.push(createBullet({ 
                    x: x, 
                    y: 50, 
                    speed: 2.5, 
                    angle: Math.PI / 2, 
                    type: BulletType.TICKET, 
                    color: '#ffcccc', 
                    radius: 20,
                    delay: (x / CANVAS_WIDTH) * 20
                }));
            }
        }
        if (tick % 30 === 0) {
                bullets.push(createBullet({
                    x: bx + (Math.random() - 0.5) * 100,
                    y: by + 20,
                    speed: 1.2,
                    angle: Math.PI / 2 + (Math.random() - 0.5),
                    type: BulletType.SHARD,
                    color: 'red',
                    radius: 18
                }));
        }
    }
    
    // PHASE 2: 'Urgent Task "Deadline Pressure"'
    else if (phase === 2) {
        if (tick % 20 === 0) {
            for(let i=0; i < CANVAS_WIDTH; i += 45) {
                    const offset = Math.sin(tick * 0.05) * 20; 
                    bullets.push(createBullet({ 
                        x: i + offset + (Math.random()*10), 
                        y: crushingWallY, 
                        speed: 1.5 + Math.random() * 0.5, 
                        angle: Math.PI / 2, 
                        type: BulletType.TICKET,
                        color: '#ffaaaa', 
                        radius: 10
                    }));
            }
        }
    }
    
    // PHASE 3: 'Overwork "Anger of No Tea Time"'
    else if (phase === 3) {
        if (tick % 100 === 0) {
            bullets.push(createBullet({ 
                x: bx, y: by, 
                speed: 3.5, 
                angle: Math.atan2(playerY - by, playerX - bx), 
                type: BulletType.CUP, 
                color: '#ffffff', 
                radius: 18, 
                timer: 60,
                accel: -0.04
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
