window.EnemyManager = class {
    constructor(arena, difficultyManager = null) {
        this.enemies = [];
        this.arena = arena;
        this.difficultyManager = difficultyManager;
    }

    checkBulletCollisions(bullets, visualEffects) {
        const result = {
            points: 0,
            kills: 0,
            byteCoins: 0
        };
        return result;
    }
};
