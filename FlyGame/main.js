const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 适配屏幕尺寸
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 玩家飞机参数
const player = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    width: 40,
    height: 60,
    speed: 6,
    movingLeft: false,
    movingRight: false
};

// 子弹参数
const bullets = [];
const bulletSpeed = 10;

// 控制
let canShoot = true;
let shootInterval = 200; // 毫秒

// 敌机参数
const enemies = [];
const enemySpeed = 3;
let enemySpawnInterval = 1000; // 毫秒
let lastEnemySpawn = 0;

// 分数
let score = 0;
let gameOver = false;

// 敌机种类
const ENEMY_TYPES = [
    { color: '#f44', width: 40, height: 40, speed: 2, score: 10 }, // 普通
    { color: '#4f4', width: 50, height: 50, speed: 1.5, score: 20 }, // 大型
    { color: '#44f', width: 30, height: 30, speed: 3, score: 30 }  // 小型
];

// 爆炸动画
const explosions = [];
const EXPLOSION_DURATION = 400; // 毫秒

// 音效
let shootAudio, explosionAudio;
function loadSounds() {
    shootAudio = new Audio('shoot.mp3');
    explosionAudio = new Audio('explosion.mp3');
}
loadSounds();

// 关卡机制
let level = 1;
let levelUpInterval = 15000; // 每15秒提升难度
let lastLevelUp = Date.now();

// 玩家血量
let hp = 5;
const MAX_HP = 5;

// 关卡分数要求
const LEVEL_SCORE_REQUIRE = [50, 120, 220, 350, 500];
const MAX_LEVEL = 5;
let levelPassed = false;
let levelFailed = false;

// 自动开枪
let autoShootTimer = null;
function startAutoShoot() {
    if (autoShootTimer) clearInterval(autoShootTimer);
    autoShootTimer = setInterval(() => {
        if (!gameOver && !levelFailed && !levelPassed) shootBullet();
    }, shootInterval);
}
startAutoShoot();

// 鼠标控制玩家移动
let isMouseDown = false;
canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
});
canvas.addEventListener('mouseup', (e) => {
    isMouseDown = false;
});
canvas.addEventListener('mouseleave', (e) => {
    isMouseDown = false;
});
canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
        player.x = e.clientX;
        player.y = e.clientY;
        // 边界检测
        player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
        player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));
    }
});
// 触控支持
canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        player.x = touch.clientX;
        player.y = touch.clientY;
        player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
        player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));
    }
});

// BOSS参数
const BOSS_CONFIG = [
    { hp: 30, width: 100, height: 100, color: '#f0f', speed: 1.5, score: 200 },
    { hp: 40, width: 120, height: 120, color: '#0ff', speed: 2, score: 300 },
    { hp: 50, width: 140, height: 140, color: '#ff0', speed: 2.5, score: 400 },
    { hp: 60, width: 160, height: 160, color: '#fa0', speed: 3, score: 500 },
    { hp: 80, width: 180, height: 180, color: '#0fa', speed: 3.5, score: 700 }
];
let boss = null;
let bossActive = false;
let bossDefeated = false;

// 道具参数
const ITEM_TYPES = [
    { type: 'heal', color: '#0f0' },
    { type: 'power', color: '#f0f' },
    { type: 'invincible', color: '#ff0' }
];
const items = [];
let powerLevel = 1;
let invincible = false;
let invincibleTimer = 0;

// 排行榜
let highScores = JSON.parse(localStorage.getItem('highScores') || '[]');
function updateHighScores(newScore) {
    highScores.push(newScore);
    highScores = highScores.sort((a, b) => b - a).slice(0, 5);
    localStorage.setItem('highScores', JSON.stringify(highScores));
}

// 图片资源加载
const imgRes = {
    player: new Image(),
    enemy: [new Image(), new Image(), new Image()],
    boss: [new Image(), new Image(), new Image(), new Image(), new Image()]
};
imgRes.player.src = 'img/战机.png';
imgRes.enemy[0].src = 'img/小兵1.png';
imgRes.enemy[1].src = 'img/小兵2.png';
imgRes.enemy[2].src = 'img/小兵3.jpg';
imgRes.boss[0].src = 'img/boos1.png';
imgRes.boss[1].src = 'img/boss2.jpg';
imgRes.boss[2].src = 'img/boss3.png';
imgRes.boss[3].src = 'img/boss4.png';
imgRes.boss[4].src = 'img/boss5.png';

// 生成BOSS
function spawnBoss() {
    const cfg = BOSS_CONFIG[Math.min(level - 1, BOSS_CONFIG.length - 1)];
    boss = {
        x: canvas.width / 2,
        y: -cfg.height / 2,
        width: cfg.width,
        height: cfg.height,
        color: cfg.color,
        speed: cfg.speed,
        hp: cfg.hp,
        maxHp: cfg.hp,
        score: cfg.score
    };
    bossActive = true;
    bossDefeated = false;
}

function drawBoss() {
    if (!bossActive || !boss) return;
    ctx.save();
    const idx = Math.min(level-1, imgRes.boss.length-1);
    const img = imgRes.boss[idx];
    if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, boss.x - boss.width/2, boss.y - boss.height/2, boss.width, boss.height);
    } else {
        ctx.fillStyle = boss.color;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, boss.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    // 血条
    ctx.fillStyle = '#f00';
    ctx.fillRect(boss.x - boss.width / 2, boss.y - boss.height / 2 - 20, boss.width, 10);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(boss.x - boss.width / 2, boss.y - boss.height / 2 - 20, boss.width * (boss.hp / boss.maxHp), 10);
    ctx.restore();
}

function updateBoss() {
    if (!bossActive || !boss) return;
    boss.y += boss.speed;
    if (boss.y > canvas.height / 3) boss.y = canvas.height / 3; // 停在屏幕上方1/3处
}

// 道具掉落
function spawnItem(x, y) {
    const item = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
    items.push({
        x,
        y,
        type: item.type,
        color: item.color,
        width: 24,
        height: 24,
        speed: 3
    });
}
function drawItems() {
    items.forEach(item => {
        ctx.save();
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}
function updateItems() {
    for (let i = items.length - 1; i >= 0; i--) {
        items[i].y += items[i].speed;
        if (items[i].y > canvas.height + items[i].height) items.splice(i, 1);
    }
}
function checkItemCollisions() {
    for (let i = items.length - 1; i >= 0; i--) {
        if (isColliding(items[i], player)) {
            if (items[i].type === 'heal') hp = Math.min(MAX_HP, hp + 1);
            if (items[i].type === 'power') powerLevel = Math.min(3, powerLevel + 1);
            if (items[i].type === 'invincible') {
                invincible = true;
                invincibleTimer = Date.now();
            }
            items.splice(i, 1);
        }
    }
}

// 玩家技能效果
function updateInvincible() {
    if (invincible && Date.now() - invincibleTimer > 4000) {
        invincible = false;
    }
}

// 多发子弹
function shootBullet() {
    if (!canShoot) return;
    if (powerLevel === 1) {
        bullets.push({
            x: player.x,
            y: player.y - player.height / 2,
            width: 6,
            height: 16
        });
    } else if (powerLevel === 2) {
        bullets.push({ x: player.x - 10, y: player.y - player.height / 2, width: 6, height: 16 });
        bullets.push({ x: player.x + 10, y: player.y - player.height / 2, width: 6, height: 16 });
    } else {
        bullets.push({ x: player.x, y: player.y - player.height / 2, width: 6, height: 16 });
        bullets.push({ x: player.x - 16, y: player.y - player.height / 2, width: 6, height: 16 });
        bullets.push({ x: player.x + 16, y: player.y - player.height / 2, width: 6, height: 16 });
    }
    // if (shootAudio) shootAudio.currentTime = 0, shootAudio.play();
    canShoot = false;
    setTimeout(() => canShoot = true, shootInterval);
}

function spawnEnemy() {
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const x = Math.random() * (canvas.width - type.width) + type.width / 2;
    enemies.push({
        x,
        y: -type.height / 2,
        width: type.width,
        height: type.height,
        color: type.color,
        speed: type.speed + (level - 1) * 0.5,
        score: type.score,
        imgIdx: Math.floor(Math.random() * 3)
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        const idx = enemy.imgIdx !== undefined ? enemy.imgIdx : Math.floor(Math.random() * 3);
        enemy.imgIdx = idx;
        const img = imgRes.enemy[idx];
        if (img.complete && img.naturalWidth) {
            ctx.drawImage(img, enemy.x - enemy.width/2, enemy.y - enemy.height/2, enemy.width, enemy.height);
        } else {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed;
        if (enemies[i].y - enemies[i].height / 2 > canvas.height) {
            enemies.splice(i, 1);
        }
    }
}

// 修改碰撞检测，支持BOSS和道具
function checkCollisions() {
    // 子弹与敌机
    for (let i = enemies.length - 1; i >= 0; i--) {
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (isColliding(enemies[i], bullets[j])) {
                explosions.push({
                    x: enemies[i].x,
                    y: enemies[i].y,
                    start: Date.now(),
                    radius: enemies[i].width / 2
                });
                if (Math.random() < 0.2) spawnItem(enemies[i].x, enemies[i].y); // 20%概率掉落道具
                // if (explosionAudio) explosionAudio.currentTime = 0, explosionAudio.play();
                score += enemies[i].score;
                enemies.splice(i, 1);
                bullets.splice(j, 1);
                break;
            }
        }
    }
    // 子弹与BOSS
    if (bossActive && boss && !bossDefeated) {
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (isColliding(boss, bullets[j])) {
                boss.hp--;
                explosions.push({ x: boss.x + (Math.random() - 0.5) * boss.width, y: boss.y + (Math.random() - 0.5) * boss.height, start: Date.now(), radius: 20 });
                // if (explosionAudio) explosionAudio.currentTime = 0, explosionAudio.play();
                bullets.splice(j, 1);
                if (boss.hp <= 0) {
                    score += boss.score;
                    bossDefeated = true;
                    bossActive = false;
                    setTimeout(() => { boss = null; }, 1000);
                }
            }
        }
    }
    // 玩家与敌机
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (isColliding(enemies[i], player)) {
            explosions.push({ x: enemies[i].x, y: enemies[i].y, start: Date.now(), radius: enemies[i].width / 2 });
            // if (explosionAudio) explosionAudio.currentTime = 0, explosionAudio.play();
            enemies.splice(i, 1);
            if (!invincible) {
                hp--;
                if (hp <= 0) gameOver = true;
            }
        }
    }
    // 玩家与BOSS
    if (bossActive && boss && isColliding(boss, player)) {
        if (!invincible) {
            hp -= 2;
            if (hp <= 0) gameOver = true;
            invincible = true;
            invincibleTimer = Date.now();
        }
    }
    checkItemCollisions();
}

function isColliding(a, b) {
    return (
        Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
        Math.abs(a.y - b.y) < (a.height + b.height) / 2
    );
}

function drawExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        const elapsed = Date.now() - exp.start;
        if (elapsed > EXPLOSION_DURATION) {
            explosions.splice(i, 1);
            continue;
        }
        const alpha = 1 - elapsed / EXPLOSION_DURATION;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius + elapsed / 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fff200';
        ctx.fill();
        ctx.restore();
    }
}

// 顶部信息横向自适应展示，字体和血量圆点移动端更小
function drawGameInfo() {
    ctx.save();
    const baseW = Math.max(canvas.width, 400);
    // 判断是否为移动端
    const isMobile = window.innerWidth < 600;
    const barW = Math.min(canvas.width * 0.96, 700);
    const barH = isMobile ? 32 : Math.max(44, Math.floor(baseW / 18));
    const barX = (canvas.width - barW) / 2;
    const barY = isMobile ? 4 : 10;
    // 背景条
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(barX + 12, barY);
    ctx.lineTo(barX + barW - 12, barY);
    ctx.quadraticCurveTo(barX + barW, barY, barX + barW, barY + 12);
    ctx.lineTo(barX + barW, barY + barH - 12);
    ctx.quadraticCurveTo(barX + barW, barY + barH, barX + barW - 12, barY + barH);
    ctx.lineTo(barX + 12, barY + barH);
    ctx.quadraticCurveTo(barX, barY + barH, barX, barY + barH - 12);
    ctx.lineTo(barX, barY + 12);
    ctx.quadraticCurveTo(barX, barY, barX + 12, barY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // 内容
    const fontSize = isMobile ? 13 : Math.max(16, Math.floor(barH * 0.48));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#222';
    ctx.shadowBlur = 2;
    const sectionCount = 4;
    const sectionW = barW / sectionCount;
    let cx = barX + sectionW / 2;
    let cy = barY + barH / 2 + fontSize * 0.32;
    // 分数
    ctx.fillStyle = '#fff';
    ctx.fillText('分数: ' + score, cx, cy);
    // 关卡
    cx += sectionW;
    ctx.fillStyle = '#0ff';
    ctx.fillText('关卡: ' + level + '/' + MAX_LEVEL, cx, cy);
    // 火力
    cx += sectionW;
    ctx.fillStyle = '#ff7f00';
    ctx.fillText('火力: ' + powerLevel, cx, cy);
    // 血量
    cx += sectionW;
    ctx.font = `bold ${Math.floor(fontSize * 0.95)}px Arial`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('血量:', cx - (isMobile ? 18 : 30), cy);
    // 血量圆点
    const heartSize = isMobile ? 5 : Math.max(7, Math.floor(barH * 0.22));
    const heartGap = isMobile ? 10 : Math.max(heartSize + 6, Math.floor(barH * 0.38));
    let hx = cx + (isMobile ? 10 : 38);
    for (let i = 0; i < MAX_HP; i++) {
        ctx.beginPath();
        ctx.arc(hx + i * heartGap, cy - heartSize / 2, heartSize, 0, Math.PI * 2);
        ctx.fillStyle = i < hp ? '#ff3b3b' : '#444';
        ctx.globalAlpha = i < hp ? 1 : 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    ctx.restore();
}

// 游戏状态
let gameState = 'lobby'; // lobby, playing, levelPassed, levelFailed, gameOver
let selectedLevel = 1;
let unlockedLevel = parseInt(localStorage.getItem('unlockedLevel') || '1');

// 优化大厅UI，右下角增加"重玩"按钮
function drawLobby() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 渐变背景
    let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#23243a');
    grad.addColorStop(1, '#2e8bff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 标题
    ctx.font = 'bold 56px Arial Black, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#0af';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff';
    ctx.fillText('雷霆战机', canvas.width / 2, 90);
    ctx.shadowBlur = 0;
    ctx.font = '28px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('闯关模式', canvas.width / 2, 140);
    // 关卡按钮
    for (let i = 1; i <= MAX_LEVEL; i++) {
        const cx = canvas.width / 2 - 180 + (i - 1) * 90;
        const cy = 260;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.fillStyle = i <= unlockedLevel ? (i === selectedLevel ? '#3cf' : '#0af') : '#888';
        ctx.shadowColor = i === selectedLevel ? '#fff' : 'transparent';
        ctx.shadowBlur = i === selectedLevel ? 24 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px Arial';
        ctx.fillText(i, cx, cy + 10);
        if (i > unlockedLevel) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#f44';
            ctx.fillText('未解锁', cx, cy + 36);
        }
        ctx.restore();
    }
    // 最高分
    ctx.font = '20px Arial';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fillText('最高分: ' + (highScores[0] || 0), canvas.width / 2, 370);
    ctx.shadowBlur = 0;
    // 右下角"重玩"按钮
    drawReplayButton();
    ctx.textAlign = 'left';
}

// 右下角重玩按钮
function drawReplayButton() {
    const btnW = 110, btnH = 44;
    const x = canvas.width - btnW - 32;
    const y = canvas.height - btnH - 32;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#f44';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x + 16, y);
    ctx.lineTo(x + btnW - 16, y);
    ctx.quadraticCurveTo(x + btnW, y, x + btnW, y + 16);
    ctx.lineTo(x + btnW, y + btnH - 16);
    ctx.quadraticCurveTo(x + btnW, y + btnH, x + btnW - 16, y + btnH);
    ctx.lineTo(x + 16, y + btnH);
    ctx.quadraticCurveTo(x, y + btnH, x, y + btnH - 16);
    ctx.lineTo(x, y + 16);
    ctx.quadraticCurveTo(x, y, x + 16, y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('重玩', x + btnW / 2, y + btnH / 2 + 8);
    ctx.restore();
    // 缓存按钮区域
    drawReplayButton._rect = {x, y, w: btnW, h: btnH};
}

// 支持canvas点击和触控进入关卡
function handleLobbySelect(x, y) {
    for (let i = 1; i <= MAX_LEVEL; i++) {
        const cx = canvas.width / 2 - 180 + (i - 1) * 90;
        const cy = 260;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < 45 * 45 && i <= unlockedLevel) {
            selectedLevel = i;
            level = i;
            score = 0;
            hp = MAX_HP;
            powerLevel = 1;
            enemies.length = 0;
            bullets.length = 0;
            explosions.length = 0;
            items.length = 0;
            boss = null;
            bossActive = false;
            bossDefeated = false;
            bossHitCount = 0;
            bossBullets.length = 0;
            enemySpawnInterval = Math.max(300, 1000 - (level - 1) * 120);
            lastLevelUp = Date.now();
            gameState = 'playing';
            requestAnimationFrame(gameLoop);
            break;
        }
    }
}
canvas.addEventListener('mousedown', function lobbyClick(e) {
    if (gameState !== 'lobby') return;
    // 优先判断重玩按钮
    const r = drawReplayButton._rect;
    if (r) {
        const x = e.clientX, y = e.clientY;
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return;
    }
    handleLobbySelect(e.clientX, e.clientY);
});
canvas.addEventListener('touchstart', function lobbyTouch(e) {
    if (gameState !== 'lobby') return;
    const r = drawReplayButton._rect;
    if (r) {
        const touch = e.touches[0];
        const x = touch.clientX, y = touch.clientY;
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return;
    }
    const touch = e.touches[0];
    handleLobbySelect(touch.clientX, touch.clientY);
});

// BOSS多样化攻击，按关卡递进
function bossShoot() {
    if (bossActive && boss) {
        let pattern = Math.min(level, 5); // 1-5
        let angleBase = Math.PI / 2;
        if (pattern === 1) {
            // 第一关：直线单发
            bossBullets.push({
                x: boss.x,
                y: boss.y + boss.height / 2,
                width: 16,
                height: 32,
                speed: 6,
                vx: 0,
                vy: 6
            });
        } else {
            // 第二关及以上：分散弹幕
            let spread = Math.PI / 6 + (pattern - 1) * Math.PI / 18; // 扇形角度
            let count = 1 + Math.floor(pattern / 2) + pattern; // 子弹数递增
            for (let i = 0; i < count; i++) {
                let angle = angleBase - spread / 2 + (spread / (count - 1 || 1)) * i;
                bossBullets.push({
                    x: boss.x,
                    y: boss.y + boss.height / 2,
                    width: 16,
                    height: 32,
                    speed: 6,
                    vx: Math.cos(angle) * 5,
                    vy: Math.sin(angle) * 5
                });
            }
        }
    }
}

function updateBossBullets() {
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        bossBullets[i].x += bossBullets[i].vx || 0;
        bossBullets[i].y += bossBullets[i].vy || bossBullets[i].speed;
        if (bossBullets[i].y > canvas.height + bossBullets[i].height || bossBullets[i].x < -50 || bossBullets[i].x > canvas.width + 50) bossBullets.splice(i, 1);
    }
}

// 弹窗UI
function drawPopup(options) {
    // options: {title, desc, buttons: [{text, onClick}]}
    const w = Math.min(canvas.width * 0.8, 380);
    const h = 220;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#0af';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(options.title, canvas.width / 2, y + 54);
    ctx.font = '20px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(options.desc, canvas.width / 2, y + 94);
    // 按钮
    const btnW = 120, btnH = 40;
    options.buttons.forEach((btn, i) => {
        const bx = canvas.width / 2 - (options.buttons.length - 1) * (btnW + 20) / 2 + i * (btnW + 20);
        const by = y + h - 60;
        ctx.fillStyle = '#0af';
        ctx.globalAlpha = 0.95;
        ctx.fillRect(bx, by, btnW, btnH);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, btnW, btnH);
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(btn.text, bx + btnW / 2, by + 28);
        btn._rect = {x: bx, y: by, w: btnW, h: btnH};
    });
    ctx.restore();
    return options.buttons;
}

// 弹窗点击事件
let popupButtons = null;
canvas.addEventListener('mousedown', function popupClick(e) {
    if (!popupButtons) return;
    const x = e.clientX, y = e.clientY;
    for (const btn of popupButtons) {
        if (btn._rect && x >= btn._rect.x && x <= btn._rect.x + btn._rect.w && y >= btn._rect.y && y <= btn._rect.y + btn._rect.h) {
            btn.onClick();
            popupButtons = null;
            break;
        }
    }
});
canvas.addEventListener('touchstart', function popupTouch(e) {
    if (!popupButtons) return;
    const touch = e.touches[0];
    const x = touch.clientX, y = touch.clientY;
    for (const btn of popupButtons) {
        if (btn._rect && x >= btn._rect.x && x <= btn._rect.x + btn._rect.w && y >= btn._rect.y && y <= btn._rect.y + btn._rect.h) {
            btn.onClick();
            popupButtons = null;
            break;
        }
    }
});

// 重置关卡数据
function resetLevelData() {
    score = 0;
    hp = MAX_HP;
    powerLevel = 1;
    enemies.length = 0;
    bullets.length = 0;
    explosions.length = 0;
    items.length = 0;
    boss = null;
    bossActive = false;
    bossDefeated = false;
    bossHitCount = 0;
    bossBullets.length = 0;
    enemySpawnInterval = Math.max(300, 1000 - (level - 1) * 120);
    lastLevelUp = Date.now();
}

// 在通关后自动更新本地 unlockedLevel
function drawLevelStatus() {
    if (levelPassed) {
        // 关卡通关时自动解锁下一关
        if (level === unlockedLevel && unlockedLevel < MAX_LEVEL) {
            unlockedLevel++;
            localStorage.setItem('unlockedLevel', unlockedLevel);
        }
        popupButtons = drawPopup({
            title: '关卡 ' + level + ' 通关！',
            desc: '击败BOSS，成功通关',
            buttons: [
                level < MAX_LEVEL ? {text: '下一关', onClick: () => {
                    selectedLevel = level + 1;
                    level = selectedLevel;
                    resetLevelData();
                    levelPassed = false;
                    levelFailed = false;
                    gameOver = false;
                    gameState = 'playing';
                    popupButtons = null;
                    requestAnimationFrame(gameLoop);
                }} : {text: '回到大厅', onClick: () => {
                    resetLevelData();
                    levelPassed = false;
                    levelFailed = false;
                    gameOver = false;
                    gameState = 'lobby';
                    popupButtons = null;
                    drawLobby();
                }}
            , {text: '回到大厅', onClick: () => {
                resetLevelData();
                levelPassed = false;
                levelFailed = false;
                gameOver = false;
                gameState = 'lobby';
                popupButtons = null;
                drawLobby();
            }}].filter((btn, idx, arr) => arr.findIndex(b => b.text === btn.text) === idx)
        });
    }
    if (levelFailed) {
        popupButtons = drawPopup({
            title: '闯关失败',
            desc: '未能击败BOSS',
            buttons: [
                {text: '重试', onClick: () => {
                    resetLevelData();
                    levelPassed = false;
                    levelFailed = false;
                    gameOver = false;
                    gameState = 'playing';
                    popupButtons = null;
                    requestAnimationFrame(gameLoop);
                }},
                {text: '回到大厅', onClick: () => {
                    resetLevelData();
                    levelPassed = false;
                    levelFailed = false;
                    gameOver = false;
                    gameState = 'lobby';
                    popupButtons = null;
                    drawLobby();
                }}
            ]
        });
    }
}

function drawGameOver() {
    popupButtons = drawPopup({
        title: '游戏结束',
        desc: '最终分数: ' + score,
        buttons: [
            {text: '回到大厅', onClick: () => {
                resetLevelData();
                levelPassed = false;
                levelFailed = false;
                gameOver = false;
                gameState = 'lobby';
                popupButtons = null;
                drawLobby();
            }}
        ]
    });
}

// 修改updateLevel，通关/失败时切换gameState
function updateLevel() {
    const now = Date.now();
    if (level > MAX_LEVEL) return;
    if (!bossActive && !bossDefeated && now - lastLevelUp > levelUpInterval) {
        if (score >= LEVEL_SCORE_REQUIRE[level - 1]) {
            spawnBoss();
        } else {
            levelFailed = true;
            gameState = 'levelFailed';
            setTimeout(() => {
                levelFailed = false;
            }, 2000);
        }
    }
    if (bossDefeated) {
        if (level < MAX_LEVEL) {
            levelPassed = true;
            gameState = 'levelPassed';
            setTimeout(() => {
                levelPassed = false;
            }, 2000);
        } else {
            levelPassed = true;
            gameOver = true;
            gameState = 'lobby';
        }
    }
}

// BOSS攻击定时器
let bossAttackInterval = 1200;
let lastBossAttack = 0;

// 修改gameLoop，支持大厅和状态切换
function gameLoop(timestamp) {
    if (gameState === 'lobby') {
        drawLobby();
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    update(timestamp);
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawBoss();
    drawExplosions();
    drawItems();
    drawBossBullets();
    drawGameInfo();
    drawBossHitCount();
    drawLevelStatus();
    drawInvincible();
    if (!gameOver && !levelPassed && !levelFailed) {
        if (!bossActive && (!lastEnemySpawn || timestamp - lastEnemySpawn > enemySpawnInterval)) {
            spawnEnemy();
            lastEnemySpawn = timestamp;
        }
        requestAnimationFrame(gameLoop);
    } else if (gameOver) {
        updateHighScores(score);
        drawGameOver();
        setTimeout(() => {
            gameState = 'lobby';
            drawLobby();
        }, 2000);
    }
}
// 网页加载后进入大厅
window.onload = function() {
    gameState = 'lobby';
    drawLobby();
};

function drawBossHitCount() {
    if (bossActive || boss) {
        ctx.fillStyle = '#f0f';
        ctx.font = '20px Arial';
        ctx.fillText('BOSS命中: ' + bossHitCount + ' / ' + BOSS_HIT_LIMIT, 20, 130);
    }
}

function drawInvincible() {
    if (invincible) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}

function update(timestamp) {
    if (gameOver || levelPassed || levelFailed) return;
    if (player.movingLeft) player.x -= player.speed;
    if (player.movingRight) player.x += player.speed;
    player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
    player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bulletSpeed;
        if (bullets[i].y < -bullets[i].height) {
            bullets.splice(i, 1);
        }
    }
    updateEnemies();
    updateBoss();
    updateItems();
    updateBossBullets();
    checkCollisions();
    checkBossBulletCollisions();
    updateInvincible();
    updateLevel();
    // BOSS攻击定时
    if (bossActive && boss && (!lastBossAttack || (timestamp - lastBossAttack > bossAttackInterval))) {
        bossShoot();
        lastBossAttack = timestamp;
    }
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    if (imgRes.player.complete && imgRes.player.naturalWidth) {
        ctx.drawImage(imgRes.player, -player.width/2, -player.height/2, player.width, player.height);
    } else {
        ctx.beginPath();
        ctx.moveTo(0, -player.height / 2);
        ctx.lineTo(-player.width / 2, player.height / 2);
        ctx.lineTo(player.width / 2, player.height / 2);
        ctx.closePath();
        ctx.fillStyle = '#0ff';
        ctx.fill();
    }
    ctx.restore();
}

function drawBullets() {
    ctx.fillStyle = '#ff0';
    bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    });
}

function drawBossBullets() {
    ctx.save();
    ctx.fillStyle = '#f0f';
    bossBullets.forEach(b => {
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function checkBossBulletCollisions() {
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        if (isColliding(bossBullets[i], player)) {
            bossBullets.splice(i, 1);
            bossHitCount++;
            if (bossHitCount >= BOSS_HIT_LIMIT) gameOver = true;
        }
    }
}

// BOSS子弹
const bossBullets = [];

// BOSS命中上限
const BOSS_HIT_LIMIT = 5;

gameLoop(); 