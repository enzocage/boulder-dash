// Spielkonstanten
const TILE_SIZE = 20;
const GRID_WIDTH = 30;
const GRID_HEIGHT = 25;
const PLAYER_SPEED = 200; // Millisekunden zwischen Bewegungen
const ROCK_FALL_SPEED = 300; // Millisekunden für Felsbrocken-Fall
const ENEMY_MOVE_SPEED = 500; // Millisekunden für Gegnerbewegung

// Spielzustände
const GAME_STATES = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    LEVEL_COMPLETE: 'level_complete'
};

// Tile-Typen
const TILE_TYPES = {
    EMPTY: 0,
    DIRT: 1,
    ROCK: 2,
    DIAMOND: 3,
    PLAYER: 4,
    ENEMY: 5,
    WALL: 6,
    POWER_UP: 7
};

// Power-Up-Typen
const POWER_UP_TYPES = {
    EXTRA_LIFE: 1,
    SLOW_TIME: 2,
    INVINCIBILITY: 3,
    POINT_MULTIPLIER: 4
};

// Gegnertypen
const ENEMY_TYPES = {
    WALKER: 1,  // Bewegt sich zufällig
    CHASER: 2,  // Verfolgt den Spieler
    PATROL: 3   // Patrouilliert auf einer Route
};

// Spielklasse
class BoulderDashGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = GRID_WIDTH * TILE_SIZE;
        this.canvas.height = GRID_HEIGHT * TILE_SIZE;
        
        this.grid = [];
        this.player = null;
        this.enemies = [];
        this.rocks = [];
        this.diamonds = [];
        this.powerUps = [];
        
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.gameState = GAME_STATES.MENU;
        
        this.lastMoveTime = 0;
        this.lastRockFallTime = 0;
        this.lastEnemyMoveTime = 0;
        
        this.audioContext = null;
        this.sounds = {};
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initAudio();
        this.loadGame();
        
        // Wenn kein Spielstand geladen wurde, generiere ein Level
        if (this.gameState === GAME_STATES.MENU) {
            this.generateLevel();
        }
        
        this.gameLoop();
    }
    
    setupEventListeners() {
        // Tastatursteuerung
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Steuerungsbuttons
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.generateSounds();
        } catch (e) {
            console.warn('Web Audio API wird nicht unterstützt:', e);
        }
    }
    
    generateSounds() {
        // Generiere Soundeffekte mit Web Audio API
        this.sounds.move = this.createBeep(200, 0.05);
        this.sounds.diamond = this.createBeep(800, 0.1);
        this.sounds.rock = this.createBeep(100, 0.2);
        this.sounds.powerUp = this.createBeep(600, 0.15);
        this.sounds.death = this.createBeep(50, 0.3);
        this.sounds.levelComplete = this.createMelody();
    }
    
    createBeep(frequency, duration) {
        return () => {
            if (!this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.value = frequency;
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    createMelody() {
        return () => {
            if (!this.audioContext) return;
            
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C
            const now = this.audioContext.currentTime;
            
            notes.forEach((freq, i) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.value = freq;
                
                gainNode.gain.setValueAtTime(0.1, now + i * 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.1);
                
                oscillator.start(now + i * 0.1);
                oscillator.stop(now + i * 0.1 + 0.1);
            });
        };
    }
    
    playSound(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }
    
    startGame() {
        if (this.gameState === GAME_STATES.MENU || this.gameState === GAME_STATES.GAME_OVER) {
            this.resetGame();
        }
        this.gameState = GAME_STATES.PLAYING;
    }
    
    togglePause() {
        if (this.gameState === GAME_STATES.PLAYING) {
            this.gameState = GAME_STATES.PAUSED;
        } else if (this.gameState === GAME_STATES.PAUSED) {
            this.gameState = GAME_STATES.PLAYING;
        }
    }
    
    resetGame() {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.gameState = GAME_STATES.PLAYING;
        this.generateLevel();
        this.updateUI();
    }
    
    generateLevel() {
        // Initialisiere das Grid
        this.grid = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(TILE_TYPES.EMPTY));
        
        // Setze Wände am Rand
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) {
                    this.grid[y][x] = TILE_TYPES.WALL;
                }
            }
        }
        
        // Generiere Terrain
        this.generateTerrain();
        
        // Setze Spieler
        this.placePlayer();
        
        // Setze Gegner
        this.placeEnemies();
        
        // Setze Felsbrocken
        this.placeRocks();
        
        // Setze Diamanten
        this.placeDiamonds();
        
        // Setze Power-ups
        this.placePowerUps();
        
        // Aktualisiere das Grid mit allen Elementen
        this.updateGrid();
    }
    
    generateTerrain() {
        // Generiere zufälliges Terrain mit Dreck und Wänden
        const dirtDensity = 0.6 + (this.level * 0.02); // Steigende Dichte mit Leveln
        
        for (let y = 2; y < GRID_HEIGHT - 2; y++) {
            for (let x = 2; x < GRID_WIDTH - 2; x++) {
                if (Math.random() < dirtDensity) {
                    this.grid[y][x] = TILE_TYPES.DIRT;
                }
            }
        }
        
        // Erstelle einige Hohlräume
        const numHoles = 3 + Math.floor(this.level / 2);
        for (let i = 0; i < numHoles; i++) {
            const holeX = 3 + Math.floor(Math.random() * (GRID_WIDTH - 6));
            const holeY = 3 + Math.floor(Math.random() * (GRID_HEIGHT - 6));
            const holeSize = 2 + Math.floor(Math.random() * 3);
            
            for (let dy = -holeSize; dy <= holeSize; dy++) {
                for (let dx = -holeSize; dx <= holeSize; dx++) {
                    const x = holeX + dx;
                    const y = holeY + dy;
                    if (x > 1 && x < GRID_WIDTH - 2 && y > 1 && y < GRID_HEIGHT - 2) {
                        if (Math.abs(dx) + Math.abs(dy) <= holeSize) {
                            this.grid[y][x] = TILE_TYPES.EMPTY;
                        }
                    }
                }
            }
        }
    }
    
    placePlayer() {
        // Finde einen freien Platz für den Spieler
        let placed = false;
        while (!placed) {
            const x = 2 + Math.floor(Math.random() * (GRID_WIDTH - 4));
            const y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));
            
            if (this.grid[y][x] === TILE_TYPES.EMPTY) {
                this.player = { x, y };
                placed = true;
            }
        }
    }
    
    placeEnemies() {
        this.enemies = [];
        const enemyCount = 2 + Math.floor(this.level / 2);
        
        for (let i = 0; i < enemyCount; i++) {
            let placed = false;
            while (!placed) {
                const x = 2 + Math.floor(Math.random() * (GRID_WIDTH - 4));
                const y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));
                
                if (this.grid[y][x] === TILE_TYPES.EMPTY &&
                    (this.player.x !== x || this.player.y !== y) &&
                    !this.rocks.some(rock => rock.x === x && rock.y === y) &&
                    !this.diamonds.some(diamond => diamond.x === x && diamond.y === y) &&
                    !this.powerUps.some(powerUp => powerUp.x === x && powerUp.y === y)) {
                    
                    const enemyType = Math.random() < 0.5 ? ENEMY_TYPES.WALKER :
                                     Math.random() < 0.7 ? ENEMY_TYPES.CHASER : ENEMY_TYPES.PATROL;
                    
                    this.enemies.push({
                        x, y,
                        type: enemyType,
                        direction: Math.floor(Math.random() * 4), // 0=up, 1=right, 2=down, 3=left
                        patrolPoints: enemyType === ENEMY_TYPES.PATROL ? this.generatePatrolPoints(x, y) : []
                    });
                    placed = true;
                }
            }
        }
    }
    
    generatePatrolPoints(x, y) {
        const points = [];
        const numPoints = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < numPoints; i++) {
            let pointX, pointY;
            do {
                pointX = 2 + Math.floor(Math.random() * (GRID_WIDTH - 4));
                pointY = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));
            } while (this.grid[pointY][pointX] !== TILE_TYPES.EMPTY);
            
            points.push({ x: pointX, y: pointY });
        }
        
        return points;
    }
    
    placeRocks() {
        this.rocks = [];
        const rockCount = 10 + Math.floor(this.level * 1.5);
        
        for (let i = 0; i < rockCount; i++) {
            let placed = false;
            while (!placed) {
                const x = 2 + Math.floor(Math.random() * (GRID_WIDTH - 4));
                const y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));
                
                // Stelle sicher, dass nur ein Element pro Feld platziert werden kann
                if (this.grid[y][x] === TILE_TYPES.EMPTY &&
                    (this.player.x !== x || this.player.y !== y) &&
                    !this.enemies.some(enemy => enemy.x === x && enemy.y === y) &&
                    !this.diamonds.some(diamond => diamond.x === x && diamond.y === y) &&
                    !this.powerUps.some(powerUp => powerUp.x === x && powerUp.y === y)) {
                    
                    this.rocks.push({ x, y, falling: false });
                    placed = true;
                }
            }
        }
    }
    
    placeDiamonds() {
        this.diamonds = [];
        const diamondCount = 5 + Math.floor(this.level * 0.8);
        
        for (let i = 0; i < diamondCount; i++) {
            let placed = false;
            while (!placed) {
                const x = 2 + Math.floor(Math.random() * (GRID_WIDTH - 4));
                const y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));
                
                if (this.grid[y][x] === TILE_TYPES.EMPTY &&
                    (this.player.x !== x || this.player.y !== y) &&
                    !this.enemies.some(enemy => enemy.x === x && enemy.y === y) &&
                    !this.rocks.some(rock => rock.x === x && rock.y === y) &&
                    !this.powerUps.some(powerUp => powerUp.x === x && powerUp.y === y)) {
                    
                    this.diamonds.push({ x, y });
                    placed = true;
                }
            }
        }
    }
    
    placePowerUps() {
        this.powerUps = [];
        const powerUpCount = 1 + Math.floor(this.level / 3);
        
        for (let i = 0; i < powerUpCount; i++) {
            let placed = false;
            while (!placed) {
                const x = 2 + Math.floor(Math.random() * (GRID_WIDTH - 4));
                const y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));
                
                if (this.grid[y][x] === TILE_TYPES.EMPTY &&
                    (this.player.x !== x || this.player.y !== y) &&
                    !this.enemies.some(enemy => enemy.x === x && enemy.y === y) &&
                    !this.rocks.some(rock => rock.x === x && rock.y === y) &&
                    !this.diamonds.some(diamond => diamond.x === x && diamond.y === y)) {
                    
                    const type = Math.floor(Math.random() * 4) + 1;
                    this.powerUps.push({ x, y, type, collected: false });
                    placed = true;
                }
            }
        }
    }
    
    handleKeyDown(e) {
        if (this.gameState !== GAME_STATES.PLAYING) return;
        
        const now = Date.now();
        if (now - this.lastMoveTime < PLAYER_SPEED) return;
        
        let dx = 0, dy = 0;
        
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                dy = -1;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                dy = 1;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                dx = -1;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                dx = 1;
                break;
            default:
                return;
        }
        
        e.preventDefault();
        this.movePlayer(dx, dy);
        this.lastMoveTime = now;
    }
    
    movePlayer(dx, dy) {
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        
        // Prüfe Kollisionen
        if (this.isWall(newX, newY)) return;
        
        // Prüfe auf Kollision mit Felsbrocken
        if (this.isRock(newX, newY)) {
            // Versuche, den Felsbrocken zu verschieben
            const rockNewX = newX + dx;
            const rockNewY = newY + dy;
            
            // Prüfe, ob der Felsbrocken verschoben werden kann
            if (!this.isWall(rockNewX, rockNewY) &&
                !this.isRock(rockNewX, rockNewY) &&
                !this.enemies.some(enemy => enemy.x === rockNewX && enemy.y === rockNewY)) {
                
                // Verschiebe den Felsbrocken
                this.grid[newY][newX] = TILE_TYPES.EMPTY;
                this.grid[rockNewY][rockNewX] = TILE_TYPES.ROCK;
                
                // Aktualisiere die Felsbrocken-Liste
                const rockIndex = this.rocks.findIndex(r => r.x === newX && r.y === newY);
                if (rockIndex !== -1) {
                    this.rocks[rockIndex].x = rockNewX;
                    this.rocks[rockIndex].y = rockNewY;
                }
                
                // Bewege den Spieler
                this.player.x = newX;
                this.player.y = newY;
                
                // Spiele Bewegungssound
                this.playSound('move');
                
                // Prüfe auf Diamantensammlung
                this.checkDiamondCollection();
                
                // Prüfe auf Power-Up-Sammlung
                this.checkPowerUpCollection();
                
                // Lösche braunes Feld (Dreck), wenn der Spieler darauf geht
                if (this.grid[newY][newX] === TILE_TYPES.DIRT) {
                    this.grid[newY][newX] = TILE_TYPES.EMPTY;
                }
            }
            return;
        }
        
        // Prüfe auf Kollision mit Gegnern
        if (this.enemies.some(enemy => enemy.x === newX && enemy.y === newY)) return;
        
        // Bewege den Spieler
        this.player.x = newX;
        this.player.y = newY;
        
        // Spiele Bewegungssound
        this.playSound('move');
        
        // Prüfe auf Diamantensammlung
        this.checkDiamondCollection();
        
        // Prüfe auf Power-Up-Sammlung
        this.checkPowerUpCollection();
        
        // Lösche braunes Feld (Dreck), wenn der Spieler darauf geht
        if (this.grid[newY][newX] === TILE_TYPES.DIRT) {
            this.grid[newY][newX] = TILE_TYPES.EMPTY;
        }
    }
    
    isWall(x, y) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return true;
        return this.grid[y][x] === TILE_TYPES.WALL;
    }
    
    checkDiamondCollection() {
        for (let i = this.diamonds.length - 1; i >= 0; i--) {
            const diamond = this.diamonds[i];
            if (diamond.x === this.player.x && diamond.y === this.player.y) {
                this.diamonds.splice(i, 1);
                this.score += 100;
                this.playSound('diamond');
                this.updateUI();
                
                // Prüfe, ob alle Diamanten gesammelt wurden
                if (this.diamonds.length === 0) {
                    this.levelComplete();
                }
            }
        }
    }
    
    checkPowerUpCollection() {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            if (!powerUp.collected && powerUp.x === this.player.x && powerUp.y === this.player.y) {
                powerUp.collected = true;
                this.applyPowerUp(powerUp.type);
                this.powerUps.splice(i, 1);
                this.playSound('powerUp');
                this.updateUI();
            }
        }
    }
    
    applyPowerUp(type) {
        switch(type) {
            case POWER_UP_TYPES.EXTRA_LIFE:
                this.lives++;
                break;
            case POWER_UP_TYPES.POINT_MULTIPLIER:
                this.score += 500;
                break;
            // Weitere Power-Up-Effekte können hier hinzugefügt werden
        }
    }
    
    checkEnemyCollision() {
        for (const enemy of this.enemies) {
            if (enemy.x === this.player.x && enemy.y === this.player.y) {
                this.playerDeath();
                return;
            }
        }
    }
    
    playerDeath() {
        this.lives--;
        this.playSound('death');
        this.updateUI();
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            // Starte das Level neu, wenn der Spieler noch Leben hat
            this.resetLevel();
        }
    }
    
    gameOver() {
        this.gameState = GAME_STATES.GAME_OVER;
        this.saveGame();
    }
    
    levelComplete() {
        this.level++;
        this.score += 1000 * this.level;
        this.playSound('levelComplete');
        this.updateUI();
        
        // Generiere neues Level
        this.generateLevel();
    }
    
    resetLevel() {
        // Setze Spieler an Startposition
        this.placePlayer();
        
        // Setze alle Gegner zurück
        for (const enemy of this.enemies) {
            enemy.x = enemy.startX;
            enemy.y = enemy.startY;
        }
        
        // Setze alle Felsbrocken zurück
        for (const rock of this.rocks) {
            rock.x = rock.startX;
            rock.y = rock.startY;
        }
        
        // Setze alle Diamanten zurück
        for (const diamond of this.diamonds) {
            diamond.collected = false;
        }
        
        // Setze alle Power-ups zurück
        for (const powerUp of this.powerUps) {
            powerUp.collected = false;
        }
        
        // Aktualisiere das Raster
        this.updateGrid();
        
        // Aktualisiere die UI
        this.updateUI();
    }
    
    updateGrid() {
        // Setze das Grid auf den Grundzustand zurück
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) {
                    this.grid[y][x] = TILE_TYPES.WALL;
                } else {
                    this.grid[y][x] = TILE_TYPES.EMPTY;
                }
            }
        }
        
        // Platziere Spieler
        if (this.player) {
            this.grid[this.player.y][this.player.x] = TILE_TYPES.PLAYER;
        }
        
        // Platziere Gegner
        for (const enemy of this.enemies) {
            this.grid[enemy.y][enemy.x] = TILE_TYPES.ENEMY;
        }
        
        // Platziere Felsbrocken
        for (const rock of this.rocks) {
            this.grid[rock.y][rock.x] = TILE_TYPES.ROCK;
        }
        
        // Platziere Diamanten
        for (const diamond of this.diamonds) {
            this.grid[diamond.y][diamond.x] = TILE_TYPES.DIAMOND;
        }
        
        // Platziere Power-ups
        for (const powerUp of this.powerUps) {
            if (!powerUp.collected) {
                this.grid[powerUp.y][powerUp.x] = TILE_TYPES.POWER_UP;
            }
        }
        
        // Füge Terrain hinzu (unter allen anderen Elementen)
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (this.grid[y][x] === TILE_TYPES.EMPTY) {
                    // Terrain basierend auf der ursprünglichen Generierung
                    const dirtDensity = 0.6 + (this.level * 0.02);
                    if (Math.random() < dirtDensity) {
                        this.grid[y][x] = TILE_TYPES.DIRT;
                    }
                }
            }
        }
    }
    
    updateEnemies() {
        const now = Date.now();
        if (now - this.lastEnemyMoveTime < ENEMY_MOVE_SPEED) return;
        
        for (const enemy of this.enemies) {
            this.moveEnemy(enemy);
        }
        
        this.lastEnemyMoveTime = now;
    }
    
    moveEnemy(enemy) {
        let dx = 0, dy = 0;
        
        switch(enemy.type) {
            case ENEMY_TYPES.WALKER:
                // Zufällige Bewegung
                if (Math.random() < 0.3) {
                    const directions = [
                        { dx: 0, dy: -1 }, // up
                        { dx: 1, dy: 0 },  // right
                        { dx: 0, dy: 1 },  // down
                        { dx: -1, dy: 0 }  // left
                    ];
                    const dir = directions[Math.floor(Math.random() * 4)];
                    dx = dir.dx;
                    dy = dir.dy;
                }
                break;
                
            case ENEMY_TYPES.CHASER:
                // Verfolge den Spieler
                if (Math.abs(this.player.x - enemy.x) > Math.abs(this.player.y - enemy.y)) {
                    dx = this.player.x > enemy.x ? 1 : -1;
                } else {
                    dy = this.player.y > enemy.y ? 1 : -1;
                }
                break;
                
            case ENEMY_TYPES.PATROL:
                // Patrouilliere zwischen Punkten
                if (enemy.patrolPoints.length > 0) {
                    const target = enemy.patrolPoints[0];
                    if (target.x === enemy.x && target.y === enemy.y) {
                        // Wechsle zum nächsten Patrouillenpunkt
                        enemy.patrolPoints.push(enemy.patrolPoints.shift());
                    } else {
                        if (Math.abs(target.x - enemy.x) > Math.abs(target.y - enemy.y)) {
                            dx = target.x > enemy.x ? 1 : -1;
                        } else {
                            dy = target.y > enemy.y ? 1 : -1;
                        }
                    }
                }
                break;
        }
        
        const newX = enemy.x + dx;
        const newY = enemy.y + dy;
        
        // Prüfe, ob Bewegung möglich ist
        if (!this.isWall(newX, newY) && !this.isRock(newX, newY) &&
            !(newX === this.player.x && newY === this.player.y)) {
            enemy.x = newX;
            enemy.y = newY;
        }
        
        // Prüfe nach der Bewegung auf Kollision mit dem Spieler
        if (enemy.x === this.player.x && enemy.y === this.player.y) {
            this.playerDeath();
        }
    }
    
    isRock(x, y) {
        return this.rocks.some(rock => rock.x === x && rock.y === y);
    }
    
    updateRocks() {
        const now = Date.now();
        if (now - this.lastRockFallTime < ROCK_FALL_SPEED) return;
        
        for (const rock of this.rocks) {
            // Prüfe, ob der Felsbrocken fallen kann
            if (rock.y < GRID_HEIGHT - 1 && 
                this.grid[rock.y + 1][rock.x] === TILE_TYPES.EMPTY &&
                !this.isRock(rock.x, rock.y + 1) &&
                !(this.player.x === rock.x && this.player.y === rock.y + 1) &&
                !this.enemies.some(enemy => enemy.x === rock.x && enemy.y === rock.y + 1)) {
                
                // Felsbrocken fällt
                rock.y++;
                rock.falling = true;
                
                // Prüfe Kollision mit Spieler
                if (rock.x === this.player.x && rock.y === this.player.y) {
                    this.playerDeath();
                }
            } else {
                rock.falling = false;
            }
        }
        
        this.lastRockFallTime = now;
    }
    
    render() {
        // Lösche Canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Rende Grid
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = this.grid[y][x];
                
                switch(tile) {
                    case TILE_TYPES.DIRT:
                        this.ctx.fillStyle = '#8B4513';
                        this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        break;
                    case TILE_TYPES.WALL:
                        this.ctx.fillStyle = '#555555';
                        this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        break;
                }
            }
        }
        
        // Rende Diamanten
        this.ctx.fillStyle = '#00FFFF';
        for (const diamond of this.diamonds) {
            this.drawDiamond(diamond.x * TILE_SIZE + TILE_SIZE / 2, diamond.y * TILE_SIZE + TILE_SIZE / 2);
        }
        
        // Rende Power-ups
        for (const powerUp of this.powerUps) {
            if (!powerUp.collected) {
                this.drawPowerUp(powerUp.x * TILE_SIZE + TILE_SIZE / 2, powerUp.y * TILE_SIZE + TILE_SIZE / 2, powerUp.type);
            }
        }
        
        // Rende Felsbrocken
        this.ctx.fillStyle = '#A9A9A9';
        for (const rock of this.rocks) {
            this.drawRock(rock.x * TILE_SIZE + TILE_SIZE / 2, rock.y * TILE_SIZE + TILE_SIZE / 2, rock.falling);
        }
        
        // Rende Gegner
        for (const enemy of this.enemies) {
            this.drawEnemy(enemy.x * TILE_SIZE + TILE_SIZE / 2, enemy.y * TILE_SIZE + TILE_SIZE / 2, enemy.type);
        }
        
        // Rende Spieler
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(
            this.player.x * TILE_SIZE + TILE_SIZE / 2,
            this.player.y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE / 3,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
    }
    
    drawDiamond(x, y) {
        const size = TILE_SIZE / 3;
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(Math.PI / 4);
        this.ctx.fillRect(-size / 2, -size / 2, size, size);
        this.ctx.restore();
    }
    
    drawPowerUp(x, y, type) {
        const colors = [
            '#FF0000', // EXTRA_LIFE
            '#0000FF', // SLOW_TIME
            '#FFFF00', // INVINCIBILITY
            '#FF00FF'  // POINT_MULTIPLIER
        ];
        
        this.ctx.fillStyle = colors[type - 1] || '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(x, y, TILE_SIZE / 4, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawRock(x, y, falling) {
        const size = TILE_SIZE * 0.8;
        this.ctx.save();
        
        if (falling) {
            // Felsbrocken, der fällt, hat eine andere Form
            this.ctx.beginPath();
            this.ctx.ellipse(x, y, size / 2, size / 3, 0, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Statischer Felsbrocken
            this.ctx.beginPath();
            this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    drawEnemy(x, y, type) {
        const colors = [
            '#FF0000', // WALKER
            '#FF00FF', // CHASER
            '#00FF00'  // PATROL
        ];
        
        this.ctx.fillStyle = colors[type - 1] || '#FFFFFF';
        
        // Zeichne verschiedene Formen für verschiedene Gegnertypen
        switch(type) {
            case ENEMY_TYPES.WALKER:
                this.ctx.beginPath();
                this.ctx.arc(x, y, TILE_SIZE / 3, 0, Math.PI * 2);
                this.ctx.fill();
                break;
            case ENEMY_TYPES.CHASER:
                this.ctx.fillRect(x - TILE_SIZE / 3, y - TILE_SIZE / 3, TILE_SIZE * 2 / 3, TILE_SIZE * 2 / 3);
                break;
            case ENEMY_TYPES.PATROL:
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - TILE_SIZE / 3);
                this.ctx.lineTo(x + TILE_SIZE / 3, y + TILE_SIZE / 3);
                this.ctx.lineTo(x - TILE_SIZE / 3, y + TILE_SIZE / 3);
                this.ctx.closePath();
                this.ctx.fill();
                break;
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lives').textContent = this.lives;
    }
    
    saveGame() {
        const gameState = {
            score: this.score,
            level: this.level,
            lives: this.lives,
            grid: this.grid,
            player: this.player,
            enemies: this.enemies,
            rocks: this.rocks,
            diamonds: this.diamonds,
            powerUps: this.powerUps
        };
        
        localStorage.setItem('boulderDashSave', JSON.stringify(gameState));
    }
    
    loadGame() {
        const savedGame = localStorage.getItem('boulderDashSave');
        
        if (savedGame) {
            try {
                const gameState = JSON.parse(savedGame);
                
                this.score = gameState.score || 0;
                this.level = gameState.level || 1;
                this.lives = gameState.lives || 3;
                this.grid = gameState.grid || [];
                this.player = gameState.player || null;
                this.enemies = gameState.enemies || [];
                this.rocks = gameState.rocks || [];
                this.diamonds = gameState.diamonds || [];
                this.powerUps = gameState.powerUps || [];
                
                this.updateUI();
            } catch (e) {
                console.error('Fehler beim Laden des Spiels:', e);
            }
        }
    }
    
    gameLoop() {
        if (this.gameState === GAME_STATES.PLAYING) {
            this.updateEnemies();
            this.updateRocks();
        }
        
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Starte das Spiel, wenn die Seite geladen ist
window.addEventListener('load', () => {
    const game = new BoulderDashGame();
});