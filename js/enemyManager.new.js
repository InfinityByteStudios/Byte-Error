window.EnemyManager = class {
    constructor(arena, difficultyManager = null) {
        this.enemies = [];
        this.arena = arena;
        this.difficultyManager = difficultyManager;
        
        // Wave-based spawning system
        this.currentWave = 1;
        this.waveState = 'preparing';
        this.waveTimer = 0;
        this.preparationTime = 3.0;
        this.timeBetweenWaves = 5.0;
        
        // Current wave configuration
        this.waveConfig = null;
        this.enemiesToSpawn = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.5;
        
        // Wave progression tracking
        this.totalSpawned = 0;
        this.enemiesSpawnedThisWave = 0;
        
        // Visual effects reference
        this.visualEffects = null;
        
        // Initialize first wave
        this.reset();
    }

    checkBulletCollisions(bullets, visualEffects) {
        const result = {
            points: 0,
            kills: 0,
            byteCoins: 0
        };

        for (const bullet of bullets) {
            if (!bullet.active) continue;

            for (const enemy of this.enemies) {
                if (!enemy.active) continue;
                if (bullet.enemiesHit.includes(enemy)) continue;

                if (enemy.checkCollision(bullet.x, bullet.y, bullet.radius)) {
                    bullet.enemiesHit.push(enemy);
                    const points = enemy.takeDamage(bullet.damage);
                    result.points += points;
                    result.byteCoins += enemy.byteCoins;

                    if (points > 0) {
                        result.kills++;
                        if (visualEffects) {
                            visualEffects.onEnemyDestroyed(enemy.x, enemy.y, enemy.type);
                        }
                    } else if (visualEffects) {
                        visualEffects.onEnemyHit(enemy.x, enemy.y, bullet.damage, enemy.type);
                    }

                    if (bullet.piercing <= 0 || bullet.enemiesHit.length > bullet.piercing) {
                        bullet.active = false;
                        break;
                    }
                }
            }
        }

        return result;
    }

    update(deltaTime, player) {
        this.waveTimer += deltaTime;
        this.updateWaveState(deltaTime, player);
        
        for (const enemy of this.enemies) {
            if (enemy.active) {
                enemy.update(deltaTime, player, this.arena, this.enemies);
            }
        }
        
        this.enemies = this.enemies.filter(enemy => enemy.active);
    }

    checkPlayerCollisions(player, arena = null) {
        if (arena && arena.isSafeZoneActive()) {
            return null;
        }

        for (const enemy of this.enemies) {
            if (!enemy.active) continue;
            if (enemy.checkPlayerCollision(player)) {
                return enemy;
            }
        }
        return null;
    }

    getActiveEnemyCount() {
        return this.enemies.filter(e => e.active).length;
    }

    reset() {
        this.enemies = [];
        this.currentWave = 1;
        this.waveState = 'preparing';
        this.waveTimer = 0;
        this.totalSpawned = 0;
        this.enemiesSpawnedThisWave = 0;
    }
};
