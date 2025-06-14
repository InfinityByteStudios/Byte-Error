// Player class - handles player movement, actions and states
window.Player = class {
    constructor(x, y) {        this.x = x;
        this.y = y;
        this.radius = 15;
        
        // Speed properties
        this.baseSpeed = 280; // Base speed in pixels per second
        this.speedMultiplier = 1.0; // Adjusted by difficulty
        this.speed = this.baseSpeed; // Current speed (will be modified by difficulty)
        
        // Visual properties
        this.color = '#00ffff';
        this.aimDirection = 0; // angle in radians        // Skin system
        this.currentSkin = 'default';
        this.skinSprites = {};
        this.skinData = {
            default: { sprite: 'assets/Sprites/sprite_0.png' }, // Use sprite_0 as default
            sprite_2: { sprite: 'assets/Sprites/Buyable Sprites/sprite_2.png' },
            sprite_4: { sprite: 'assets/Sprites/Buyable Sprites/sprite_4.png' },
            sprite_5: { sprite: 'assets/Sprites/Buyable Sprites/sprite_5.png' },
            sprite_6: { sprite: 'assets/Sprites/Buyable Sprites/sprite_6.png' },
            sprite_7: { sprite: 'assets/Sprites/Buyable Sprites/sprite_7.png' }
        };
        
        // Load OverClock sprite separately for overclock mode
        this.overclockSprite = new Image();
        this.overclockSpriteLoaded = false;
        this.overclockSprite.onload = () => {
            this.overclockSpriteLoaded = true;
            console.log('✅ OverClock sprite loaded successfully');
        };
        this.overclockSprite.onerror = () => {
            console.error('❌ Failed to load OverClock sprite');
        };
        this.overclockSprite.src = 'assets/Sprites/OverClock Sprite.png';
          // Load all skin sprites
        this.loadSkinSprites();
        
        // Current active sprite
        this.currentSprite = null;
        
        // Initialize with default skin after sprites start loading
        // We don't need to wait for them to load to set the currentSkin
        this.currentSkin = 'default';
          // Sprite properties
        this.spriteLoaded = false;
        this.spriteSize = 65; // Size to render the sprite (diameter)
        
        // Movement smoothing
        this.velocity = { x: 0, y: 0 };
        this.friction = 0.85;
        
        // Weapon system
        this.weapon = new Weapon();
        this.bullets = [];
        
        // Health system
        this.health = 100;
        this.maxHealth = 100;
        this.invulnerable = false;
        this.invulnerabilityTimer = 0;
        this.invulnerabilityDuration = 1.0; // seconds
        
        // Visual effects properties
        this.flashTimer = 0;
        this.isFlashing = false;
        this.damageColor = 'rgba(255, 0, 0, 0.5)'; // Semi-transparent red for damage          // Dash system
        this.dashSpeed = 840; // pixels per second during dash (increased for even larger arena)
        this.dashDuration = 0.2; // seconds
        this.dashCooldown = 2.0; // seconds between dashes
        this.dashTimer = 0; // current dash time
        this.dashCooldownTimer = 0; // cooldown remaining
        this.isDashing = false;
        this.dashDirection = { x: 0, y: 0 };
        this.dashTrail = []; // For visual trail effect
        
        // Base properties for upgrade calculations
        this.baseDashCooldown = this.dashCooldown;
        this.baseDashSpeed = this.dashSpeed;
        this.baseOverclockChargePerKill = 20; // Base charge gained per kill
        
        // Overclock system
        this.overclockCharge = 0; // Current charge (0-100)
        this.overclockMaxCharge = 100; // Max charge needed
        this.overclockChargePerKill = this.baseOverclockChargePerKill; // Charge gained per kill
        this.overclockDuration = 8.0; // seconds when active
        this.overclockTimer = 0; // remaining overclock time
        this.isOverclocked = false;
        this.overclockMultipliers = {
            fireRate: 2.5, // 2.5x fire rate
            speed: 1.8, // 1.8x movement speed
            damage: 2.0, // 2x damage
            dashCooldown: 0.5 // 50% dash cooldown reduction
        };        
        // Glitch effect system (for Syntax Breaker enemy)
        this.isGlitched = false;
        this.glitchTimer = 0;
        this.glitchIntensity = 0.5; // How much controls are scrambled (0-1)
        this.glitchVisualTimer = 0;
        
        // Visual Effects system
        this.equippedEffects = [];
        this.effectParticles = [];
        this.effectTimers = new Map(); // For timing-based effects
    }    update(deltaTime, input, arena, game = null) {
        // Track old position for continuous collision detection during dash
        const oldX = this.x;
        const oldY = this.y;
        
        // Track action events for visual effects
        const actionEvents = {
            dashActivated: false,
            overclockActivated: false
        };
        
        // Get custom key bindings if available
        const keyBindings = game ? game.keyBindings : {
            dash: 'Space',
            overclock: 'KeyQ'
        };
        
        // Update dash cooldown
        if (this.dashCooldownTimer > 0) {
            this.dashCooldownTimer -= deltaTime;
        }
        
        // Handle dash input
        if (input.wasKeyPressed(keyBindings.dash) && this.canDash()) {
            if (this.startDash(input)) {
                actionEvents.dashActivated = true;
            }
        }
        
        // Update dash state
        this.updateDash(deltaTime);
        
        // Update movement with glitch effect
        if (!this.isDashing) {
            // Get movement input (disabled during dash)
            const originalMovement = input.getMovementVector();
            const movement = this.getGlitchedMovement(originalMovement);
            
            // Apply movement with acceleration
            const acceleration = 800; // pixels per second squared
            this.velocity.x += movement.x * acceleration * deltaTime;
            this.velocity.y += movement.y * acceleration * deltaTime;
            
            // Apply friction
            this.velocity.x *= this.friction;
            this.velocity.y *= this.friction;
            
            // Cap velocity (with Overclock bonus)
            const speedMultiplier = this.isOverclocked ? this.overclockMultipliers.speed : 1.0;
            const maxSpeed = this.speed * speedMultiplier;
            const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (currentSpeed > maxSpeed) {
                this.velocity.x = (this.velocity.x / currentSpeed) * maxSpeed;
                this.velocity.y = (this.velocity.y / currentSpeed) * maxSpeed;
            }
        } else {
            // During dash, move in small steps to prevent tunneling through enemies
            const steps = Math.ceil(Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y) * deltaTime / this.radius);
            const stepDelta = deltaTime / steps;
            
            for (let i = 0; i < steps; i++) {
                this.x += this.velocity.x * stepDelta;
                this.y += this.velocity.y * stepDelta;
                this.clampToArena(arena);
            }
        }
        
        // Update position
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;
        this.clampToArena(arena);
        
        // Update aim direction based on mouse position
        this.aimDirection = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
        
        // Handle shooting
        if (input.mouse.isDown) {
            this.shoot();
        }        // Update other systems
        this.updateBullets(deltaTime);
        const overclockResult = this.updateOverclock(deltaTime, input, keyBindings);
        if (overclockResult) {
            actionEvents.overclockActivated = true;
        }
          // Update visual effects timers
        if (this.invulnerable) {
            this.invulnerabilityTimer -= deltaTime;
            if (this.invulnerabilityTimer <= 0) {
                this.invulnerable = false;
            }
        }
        
        if (this.isFlashing) {
            this.flashTimer -= deltaTime;            if (this.flashTimer <= 0) {
                this.isFlashing = false;
            }
        }
        
        // Update equipped visual effects
        this.updateVisualEffects(deltaTime);
        
        // Update glitch effect
        this.updateGlitchEffect(deltaTime);
        
        return actionEvents;
    }
    
    clampToArena(arena) {
        if (!arena) return;
        
        const margin = this.radius;
        this.x = Math.max(arena.borderThickness + margin, 
                         Math.min(arena.width - arena.borderThickness - margin, this.x));
        this.y = Math.max(arena.borderThickness + margin, 
                         Math.min(arena.height - arena.borderThickness - margin, this.y));
    }
    
    // Dash system methods
    canDash() {
        return !this.isDashing && this.dashCooldownTimer <= 0;
    }
    
    startDash(input) {
        // Get dash direction from current movement input or aim direction
        const movement = input.getMovementVector();
        
        if (movement.x !== 0 || movement.y !== 0) {
            // Dash in movement direction
            this.dashDirection.x = movement.x;
            this.dashDirection.y = movement.y;
        } else {
            // Dash in aim direction if no movement input
            this.dashDirection.x = Math.cos(this.aimDirection);
            this.dashDirection.y = Math.sin(this.aimDirection);
        }
        
        // Normalize dash direction
        const magnitude = Math.sqrt(this.dashDirection.x ** 2 + this.dashDirection.y ** 2);
        if (magnitude > 0) {
            this.dashDirection.x /= magnitude;
            this.dashDirection.y /= magnitude;
        }
        
        // Start dash
        this.isDashing = true;
        this.dashTimer = this.dashDuration;
        this.dashCooldownTimer = this.dashCooldown;
        
        // Add brief invulnerability during dash
        this.invulnerable = true;
        this.invulnerabilityTimer = this.dashDuration + 0.1; // Add 0.1s buffer after dash
        
        // Set dash velocity
        this.velocity.x = this.dashDirection.x * this.dashSpeed;
        this.velocity.y = this.dashDirection.y * this.dashSpeed;
        
        console.log('Dash activated!');
        return true; // Return true to indicate dash was activated
    }
    
    updateDash(deltaTime) {
        if (!this.isDashing) return;
        
        this.dashTimer -= deltaTime;
        
        if (this.dashTimer <= 0) {
            // End dash
            this.isDashing = false;
            this.dashTimer = 0;
            
            // Reduce velocity after dash
            this.velocity.x *= 0.3;
            this.velocity.y *= 0.3;
        } else {
            // Maintain dash velocity during dash
            this.velocity.x = this.dashDirection.x * this.dashSpeed;
            this.velocity.y = this.dashDirection.y * this.dashSpeed;
        }
    }
    
    updateDashTrail() {
        // Add current position to trail during dash
        if (this.isDashing) {
            this.dashTrail.unshift({ x: this.x, y: this.y, alpha: 1.0 });
            
            // Limit trail length
            if (this.dashTrail.length > 8) {
                this.dashTrail.pop();
            }
        }
        
        // Update trail alpha values
        for (let i = 0; i < this.dashTrail.length; i++) {
            this.dashTrail[i].alpha -= 0.15;
            if (this.dashTrail[i].alpha <= 0) {
                this.dashTrail.splice(i, 1);
                i--;
            }        }
    }    // Overclock system methods
    updateOverclock(deltaTime, input, keyBindings = null) {
        // Update Overclock timer
        if (this.isOverclocked) {
            this.overclockTimer -= deltaTime;
            if (this.overclockTimer <= 0) {
                this.deactivateOverclock();
            }
        }
        
        // Get overclock key (default to Q if no bindings provided)
        const overclockKey = keyBindings ? keyBindings.overclock : 'KeyQ';
        
        // Manual activation with overclock key (if charged)
        if (input.wasKeyPressed(overclockKey) && this.canActivateOverclock()) {
            return this.activateOverclock(); // Return the activation result
        }
        
        return false; // No activation this frame
    }
    
    addOverclockCharge(amount) {
        this.overclockCharge += amount;
        if (this.overclockCharge >= this.overclockMaxCharge) {
            this.overclockCharge = this.overclockMaxCharge;
        }
        
        console.log(`Overclock charge: ${this.overclockCharge}/${this.overclockMaxCharge}`);
    }
    
    canActivateOverclock() {
        return !this.isOverclocked && this.overclockCharge >= this.overclockMaxCharge;
    }
      activateOverclock() {
        if (!this.canActivateOverclock()) return false;
        
        this.isOverclocked = true;
        this.overclockTimer = this.overclockDuration;
        this.overclockCharge = 0; // Reset charge after use
        
        // Apply Overclock bonuses to weapon
        if (this.weapon) {
            this.weapon.applyOverclock(this.overclockMultipliers);
        }
        
        console.log('OVERCLOCK ACTIVATED! Neural systems enhanced!');
        return true; // Return true to indicate overclock was activated
    }
    
    deactivateOverclock() {
        this.isOverclocked = false;
        this.overclockTimer = 0;
        
        // Remove Overclock bonuses from weapon
        if (this.weapon) {
            this.weapon.removeOverclock();
        }
        
        console.log('Overclock deactivated. Systems returning to normal.');
    }
    
    onKill() {
        // Called when player kills an enemy
        this.addOverclockCharge(this.overclockChargePerKill);
    }
    
    // Apply upgrade effects to player stats
    applyUpgradeEffects(effects) {
        // Apply damage multiplier to weapon
        if (effects.damageMultiplier !== undefined) {
            this.weapon.baseDamage = Math.round(this.weapon.baseDamage * effects.damageMultiplier);
            // Also update current damage if not overclocked
            if (!this.weapon.isOverclocked) {
                this.weapon.damage = this.weapon.baseDamage;
            }
        }
        
        // Apply fire rate multiplier to weapon
        if (effects.fireRateMultiplier !== undefined) {
            this.weapon.baseFireRate = this.weapon.baseFireRate * effects.fireRateMultiplier;
            // Also update current fire rate if not overclocked
            if (!this.weapon.isOverclocked) {
                this.weapon.fireRate = this.weapon.baseFireRate;
            }
        }
        
        // Apply overclock charge multiplier
        if (effects.overclockChargeMultiplier !== undefined) {
            this.overclockChargePerKill = Math.round(this.baseOverclockChargePerKill * effects.overclockChargeMultiplier);
        }
        
        // Apply dash cooldown multiplier
        if (effects.dashCooldownMultiplier !== undefined) {
            this.dashCooldown = this.baseDashCooldown * effects.dashCooldownMultiplier;
        }
        
        // Apply dash distance multiplier (affects dash speed)
        if (effects.dashDistanceMultiplier !== undefined) {
            this.dashSpeed = this.baseDashSpeed * effects.dashDistanceMultiplier;
        }
        
        // Apply bullet piercing to weapon
        if (effects.bulletPiercing !== undefined && effects.bulletPiercing > 0) {
            this.weapon.piercing = effects.bulletPiercing;
        }
        
        console.log(`🔧 Player stats updated:`, {
            damage: this.weapon.damage,
            fireRate: this.weapon.fireRate,
            dashCooldown: this.dashCooldown,
            overclockChargePerKill: this.overclockChargePerKill,
            piercing: this.weapon.piercing || 0
        });
    }
    
    // Reset all player stats to base values
    resetUpgradeEffects() {
        // Reset weapon stats
        this.weapon.damage = this.weapon.baseDamage;
        this.weapon.fireRate = this.weapon.baseFireRate;
        this.weapon.piercing = 0;
        
        // Reset dash stats
        this.dashCooldown = this.baseDashCooldown;
        this.dashSpeed = this.baseDashSpeed;
        
        // Reset overclock stats
        this.overclockChargePerKill = this.baseOverclockChargePerKill;
        
        console.log('🔄 Player stats reset to base values');
    }
    
    shoot() {
        const currentTime = Date.now();
        const bullet = this.weapon.shoot(this.x, this.y, this.aimDirection, currentTime);
        if (bullet) {
            this.bullets.push(bullet);
        }
    }
    
    updateBullets(deltaTime) {
        // Update all bullets
        for (let bullet of this.bullets) {
            bullet.update(deltaTime);
        }
        
        // Remove inactive bullets
        this.bullets = this.bullets.filter(bullet => bullet.active);
    }
    
    takeDamage(damage) {
        if (this.invulnerable) return false;
        
        this.health -= damage;
        this.health = Math.max(0, this.health); // Don't go below 0
        
        // Start invulnerability period
        this.invulnerable = true;
        this.invulnerabilityTimer = this.invulnerabilityDuration;
        
        // Start flash effect
        this.isFlashing = true;
        this.flashTimer = 0.2; // Flash for 0.2 seconds
        
        console.log(`Player took ${damage} damage! Health: ${this.health}/${this.maxHealth}`);
        
        return this.health <= 0; // Return true if player died
    }
    
    heal(amount) {
        this.health += amount;
        this.health = Math.min(this.maxHealth, this.health); // Don't exceed max health
    }
    
    isDead() {
        return this.health <= 0;
    }

    // Glitch effect system (for Syntax Breaker enemy)
    updateGlitchEffect(deltaTime) {
        if (this.isGlitched) {
            this.glitchTimer -= deltaTime;
            this.glitchVisualTimer += deltaTime;
            
            if (this.glitchTimer <= 0) {
                this.isGlitched = false;
                this.glitchTimer = 0;
                this.glitchVisualTimer = 0;
                console.log('Player glitch effect ended');
            }
        }
    }

    applyGlitchEffect(duration = 1.0, intensity = 0.5) {
        this.isGlitched = true;
        this.glitchTimer = duration;
        this.glitchIntensity = intensity;
        this.glitchVisualTimer = 0;
        console.log(`Player glitched! Duration: ${duration}s, Intensity: ${intensity}`);
    }

    // Modify movement input when glitched
    getGlitchedMovement(originalMovement) {
        if (!this.isGlitched) return originalMovement;

        // Apply control scrambling based on glitch intensity
        const scrambleChance = this.glitchIntensity;
        const time = this.glitchVisualTimer;
        
        // Random control inversions and scrambling
        let x = originalMovement.x;
        let y = originalMovement.y;

        // Periodic control scrambling
        if (Math.sin(time * 8) > (1 - scrambleChance)) {
            // Invert controls randomly
            if (Math.random() < 0.5) x = -x;
            if (Math.random() < 0.5) y = -y;
        }

        // Random direction swapping
        if (Math.sin(time * 12) > (1 - scrambleChance * 0.8)) {
            [x, y] = [y, x]; // Swap X and Y
        }

        // Add jitter
        const jitterAmount = scrambleChance * 0.3;
        x += (Math.random() - 0.5) * jitterAmount;
        y += (Math.random() - 0.5) * jitterAmount;

        return { x, y };
    }    loadSkinSprites() {
        Object.keys(this.skinData).forEach(skinId => {
            const sprite = new Image();
            sprite.onload = () => {
                console.log(`✅ Loaded skin sprite: ${skinId}`);
                if (skinId === this.currentSkin) {
                    this.currentSprite = sprite;
                    this.spriteLoaded = true;
                }
            };
            sprite.onerror = () => {
                console.error(`❌ Failed to load skin sprite: ${skinId}`);
            };
            sprite.src = this.skinData[skinId].sprite;
            this.skinSprites[skinId] = sprite;
        });
    }    setSkin(skinId) {
        // Check if we have shop data to determine skin type
        let skinData = null;
        if (window.game && window.game.shopData && window.game.shopData.playerSkins) {
            skinData = window.game.shopData.playerSkins[skinId];
        }

        // If it's an OG-style skin, don't try to load sprites
        if (skinData && skinData.isOGStyle) {
            this.currentSkin = skinId;
            this.currentSprite = null;
            this.spriteLoaded = false;
            console.log(`👕 Player skin changed to OG-style: ${skinId} (${skinData.color})`);
            return;
        }

        // Handle sprite-based skins
        if (this.skinData && this.skinData[skinId]) {
            this.currentSkin = skinId;
            if (this.skinSprites && this.skinSprites[skinId]) {
                this.currentSprite = this.skinSprites[skinId];
                this.spriteLoaded = this.currentSprite && this.currentSprite.complete;
            }
            console.log(`👕 Player skin changed to sprite-based: ${skinId}`);
        } else {
            console.warn(`⚠️ Unknown skin: ${skinId} or skinData not loaded yet`);
            // Fallback to default if skinData exists
            if (this.skinData && this.skinData['default']) {
                this.currentSkin = 'default';
            }
        }
    }
    
    render(ctx) {
        // Draw dash trail first (behind player)
        this.renderDashTrail(ctx);
          // Draw Overclock effects first (behind player)
        if (this.isOverclocked) {
            this.renderOverclockEffects(ctx);
        }
        
        // Render equipped visual effects (behind player)
        this.renderVisualEffects(ctx);        // Choose color based on state and current skin
        let baseSkinColor = this.getSkinColor(); // Get the base skin color
        let currentColor = baseSkinColor;
        let glowColor = '#00ffff';
        let glowIntensity = 0;
        
        // Set different colors and glows based on player state
        if (this.isFlashing) {
            currentColor = this.damageColor;
            glowColor = '#ff0000';
            glowIntensity = 15;
        } else if (this.invulnerable) {
            // Flicker effect during invulnerability with semi-transparency
            const flickerRate = 10; // flickers per second
            const flickerTime = Date.now() / 1000;
            if (Math.floor(flickerTime * flickerRate) % 2 === 0) {
                currentColor = 'rgba(255, 255, 255, 0.3)';
                glowColor = '#ffffff';
                glowIntensity = 10;
            }
        } else if (this.isOverclocked) {
            // Special Overclock color and glow
            currentColor = 'rgba(255, 0, 255, 0.4)'; // Semi-transparent magenta
            glowColor = '#ff00ff';
            glowIntensity = 25;
            
            // Add pulsing effect during Overclock
            const pulseRate = 3; // pulses per second
            const pulseTime = Date.now() / 1000;
            const pulseFactor = 0.5 + 0.5 * Math.sin(pulseTime * Math.PI * 2 * pulseRate);
            glowIntensity = 15 + 15 * pulseFactor;
        } else if (this.isGlitched) {
            // Glitch effect color with erratic flickering
            const glitchColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
            const glitchIndex = Math.floor(this.glitchVisualTimer * 20) % glitchColors.length;
            currentColor = glitchColors[glitchIndex].replace('#', 'rgba(').replace(')', ', 0.4)');
            glowColor = glitchColors[glitchIndex];
            glowIntensity = 15 + Math.random() * 10;
        } else if (this.isDashing) {
            // Special dash color with glow
            currentColor = 'rgba(0, 255, 255, 0.4)'; // Semi-transparent cyan
            glowColor = '#00ffff';
            glowIntensity = 20;
        } else {
            // Normal state - use the skin color
            currentColor = baseSkinColor;
        }// Determine which sprite to use
        let spriteToRender = this.currentSprite;
        let spriteIsLoaded = this.spriteLoaded;
        let isOGStyle = false;

        // Check if current skin is OG-style
        if (window.game && window.game.shopData && window.game.shopData.playerSkins) {
            const skinData = window.game.shopData.playerSkins[this.currentSkin];
            if (skinData && skinData.isOGStyle) {
                isOGStyle = true;
                spriteIsLoaded = false; // Force circle rendering for OG skins
            }
        }
        
        // Use OverClock sprite during overclock mode (only for sprite-based skins)
        if (this.isOverclocked && this.overclockSpriteLoaded && !isOGStyle) {
            spriteToRender = this.overclockSprite;
            spriteIsLoaded = true;
        }if (spriteIsLoaded && spriteToRender) {
            // Apply glow effect if needed
            if (glowIntensity > 0) {
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = glowIntensity;
            }
            
            // Apply skin-specific effects
            this.applySkinEffects(ctx);

            // Save context for rotation
            ctx.save();
            
            // Move to player position and rotate to face aim direction
            ctx.translate(this.x, this.y);
            ctx.rotate(this.aimDirection + Math.PI / 2); // Add PI/2 to align sprite properly

            // Draw the sprite
            ctx.drawImage(
                spriteToRender,
                -this.spriteSize / 2,
                -this.spriteSize / 2,
                this.spriteSize,
                this.spriteSize
            );

            // Restore context
            ctx.restore();        } else {
            // Fallback to circle rendering (used for OG-style skins and when sprites aren't loaded)
            // Apply skin-specific effects
            this.applySkinEffects(ctx);
            
            // Enhanced circle rendering for OG-style skins
            if (isOGStyle) {
                ctx.save();
                
                // Add glow effect if needed
                if (glowIntensity > 0) {
                    ctx.shadowColor = glowColor;
                    ctx.shadowBlur = glowIntensity;
                }
                
                // Draw main circle (body)
                ctx.fillStyle = currentColor;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw directional line
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                const lineLength = this.radius * 1.3;
                const lineEndX = this.x + Math.cos(this.aimDirection) * lineLength;
                const lineEndY = this.y + Math.sin(this.aimDirection) * lineLength;
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(lineEndX, lineEndY);
                ctx.stroke();
                
                // Draw simple rounded droplet at the end
                ctx.fillStyle = '#ffffff';
                ctx.save();
                ctx.translate(lineEndX, lineEndY);
                ctx.rotate(this.aimDirection);
                
                // Simple rounded droplet shape (like water drop)
                ctx.beginPath();
                const dropRadius = this.radius * 0.25;
                
                // Draw main rounded part
                ctx.arc(0, dropRadius * 0.3, dropRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw pointed top
                ctx.beginPath();
                ctx.moveTo(-dropRadius * 0.5, dropRadius * 0.3);
                ctx.quadraticCurveTo(0, -dropRadius * 1.2, dropRadius * 0.5, dropRadius * 0.3);
                ctx.fill();
                
                ctx.restore();
                ctx.restore();
            } else {
                // Simple circle for non-OG fallback
                ctx.fillStyle = currentColor;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }// Draw glitch effects
        if (this.isGlitched) {
            this.renderGlitchEffects(ctx);
        }

        // Reset shadow
        ctx.shadowBlur = 0;

        // Render bullets
        for (let bullet of this.bullets) {
            bullet.render(ctx);
        }
    }
    
    renderOverclockEffects(ctx) {
        // Draw energy rings around player during Overclock
        const time = Date.now() / 1000;
        const ringCount = 3;
        
        for (let i = 0; i < ringCount; i++) {
            const ringRadius = this.radius + 15 + i * 8;
            const rotationSpeed = 2 + i * 0.5; // Different speeds for each ring
            const rotation = time * rotationSpeed * (i % 2 === 0 ? 1 : -1); // Alternating directions
            
            // Draw energy ring segments
            const segmentCount = 8;
            const segmentLength = Math.PI / 6; // Arc length of each segment
            
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 10;
            
            for (let j = 0; j < segmentCount; j++) {
                const segmentAngle = (j / segmentCount) * Math.PI * 2 + rotation;
                const startAngle = segmentAngle - segmentLength / 2;
                const endAngle = segmentAngle + segmentLength / 2;
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, ringRadius, startAngle, endAngle);
                ctx.stroke();
            }
        }
        
        // Draw energy particles
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            const particleAngle = (i / particleCount) * Math.PI * 2 + time * 3;
            const particleDistance = this.radius + 25 + 10 * Math.sin(time * 4 + i);
            const particleX = this.x + Math.cos(particleAngle) * particleDistance;
            const particleY = this.y + Math.sin(particleAngle) * particleDistance;
            
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.shadowBlur = 0;
    }
    
    renderDashTrail(ctx) {
        if (this.dashTrail.length === 0) return;
        
        // Draw trail segments
        for (let i = 0; i < this.dashTrail.length; i++) {
            const trail = this.dashTrail[i];
            const size = this.radius * (0.3 + trail.alpha * 0.7); // Shrinking trail
            
            ctx.globalAlpha = trail.alpha * 0.6;
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(trail.x, trail.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1.0; // Reset alpha
    }
    
    renderGlitchEffects(ctx) {
        // Draw scrambled lines and data corruption effects
        const time = this.glitchVisualTimer;
        const intensity = this.glitchIntensity;
        
        // Random glitch lines
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < 8; i++) {
            if (Math.random() < intensity) {
                const angle = Math.random() * Math.PI * 2;
                const length = 10 + Math.random() * 15;
                const startX = this.x + (Math.random() - 0.5) * this.radius * 2;
                const startY = this.y + (Math.random() - 0.5) * this.radius * 2;
                const endX = startX + Math.cos(angle) * length;
                const endY = startY + Math.sin(angle) * length;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
        
        // Digital corruption squares
        ctx.fillStyle = '#ff0000';
        for (let i = 0; i < 6; i++) {
            if (Math.random() < intensity * 0.7) {
                const size = 2 + Math.random() * 4;
                const offsetX = (Math.random() - 0.5) * this.radius * 2.5;
                const offsetY = (Math.random() - 0.5) * this.radius * 2.5;
                
                ctx.fillRect(this.x + offsetX, this.y + offsetY, size, size);
            }
        }
        
        // Distortion effect around player
        const distortionRadius = this.radius + 5;
        const segments = 16;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < segments; i++) {
            if (Math.random() < intensity * 0.5) {
                const angle = (i / segments) * Math.PI * 2;
                const jitter = (Math.random() - 0.5) * 8;
                const radius = distortionRadius + jitter;
                const x = this.x + Math.cos(angle) * radius;
                const y = this.y + Math.sin(angle) * radius;
                
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
      setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
        this.speed = this.baseSpeed * this.speedMultiplier;
        console.log(`🏃 Player speed adjusted: ${Math.round(this.speed)} (${Math.round(this.speedMultiplier * 100)}% of base)`);
    }    getSkinColor() {
        // Check if current skin is an OG-style color skin
        if (window.game && window.game.shopData && window.game.shopData.playerSkins) {
            const skinData = window.game.shopData.playerSkins[this.currentSkin];
            if (skinData && skinData.isOGStyle && skinData.color) {
                // Handle rainbow skin with shifting colors
                if (skinData.isRainbow) {
                    const time = Date.now() / 1000;
                    const hue = (time * 60) % 360; // Complete cycle every 6 seconds
                    return `hsl(${hue}, 100%, 50%)`;
                }
                return skinData.color;
            }
        }
        // Return the base color for sprite-based or default skins
        return this.color;
    }
      setEquippedEffects(effects) {
        // Ensure effects is always an array
        if (!Array.isArray(effects)) {
            effects = [];
        }
        this.equippedEffects = [...effects]; // Create a copy
        this.initializeEffectParticles();
        console.log(`🎨 Player effects updated:`, this.equippedEffects);
    }
    
    initializeEffectParticles() {        // Clear existing particles
        this.effectParticles = [];
        this.effectTimers.clear();
        
        // Initialize particles for each equipped effect
        this.equippedEffects.forEach(effectId => {
            switch(effectId) {
                case 'particle-trail':
                    this.effectTimers.set('particle-trail', 0);
                    break;
                case 'energy-rings':
                    this.effectTimers.set('energy-rings', 0);
                    break;
                case 'pulse-wave':
                    this.effectTimers.set('pulse-wave', 0);
                    break;
            }
        });
    }
    
    updateVisualEffects(deltaTime) {
        // Update visual effect timers
        this.effectTimers.forEach((timer, effectId) => {
            this.effectTimers.set(effectId, timer + deltaTime);
        });
        
        // Update particle effects
        this.updateEffectParticles(deltaTime);
        
        // Generate new particles for equipped effects
        this.equippedEffects.forEach(effectId => {
            this.generateEffectParticles(effectId, deltaTime);
        });
    }
    
    updateEffectParticles(deltaTime) {
        // Update existing particles
        for (let i = this.effectParticles.length - 1; i >= 0; i--) {
            const particle = this.effectParticles[i];
            particle.life -= deltaTime;
            
            // Update particle position and properties
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.alpha = Math.max(0, particle.life / particle.maxLife);
            
            // Remove dead particles
            if (particle.life <= 0) {
                this.effectParticles.splice(i, 1);
            }
        }
    }
    
    generateEffectParticles(effectId, deltaTime) {
        const timer = this.effectTimers.get(effectId) || 0;
          switch(effectId) {
            case 'particle-trail':
                // Generate particles every 0.05 seconds
                if (timer % 0.05 < deltaTime) {
                    this.createParticleTrail();
                }                break;
                
            case 'energy-rings':
                // Generate energy rings every 0.2 seconds
                if (timer % 0.2 < deltaTime) {
                    this.createEnergyRings();
                }
                break;
                
            case 'pulse-wave':
                // Generate pulse waves every 0.5 seconds
                if (timer % 0.5 < deltaTime) {
                    this.createPulseWave();
                }
                break;
        }
    }
    
    createParticleTrail() {
        // Create glowing trail particles behind the player
        const numParticles = 2;
        for (let i = 0; i < numParticles; i++) {
            this.effectParticles.push({
                x: this.x + (Math.random() - 0.5) * this.radius,
                y: this.y + (Math.random() - 0.5) * this.radius,
                vx: (Math.random() - 0.5) * 50,
                vy: (Math.random() - 0.5) * 50,
                life: 0.8,
                maxLife: 0.8,
                alpha: 1,
                color: '#00ffff',
                size: 3 + Math.random() * 4,                type: 'particle-trail'
            });
        }
    }

    createEnergyRings() {
        // Create orbital energy ring particles
        const ringCount = 2;
        const baseRadius = this.radius + 20;
        
        for (let ring = 0; ring < ringCount; ring++) {
            const radius = baseRadius + ring * 15;
            const particles = 8;
            
            for (let i = 0; i < particles; i++) {
                const angle = (Math.PI * 2 / particles) * i + Date.now() * 0.002 * (ring + 1);
                const x = this.x + Math.cos(angle) * radius;
                const y = this.y + Math.sin(angle) * radius;
                
                this.effectParticles.push({
                    x: x,
                    y: y,
                    vx: 0,
                    vy: 0,
                    life: 0.6,
                    maxLife: 0.6,
                    alpha: 1,
                    color: ring === 0 ? '#00ff00' : '#0080ff',
                    size: 3,
                    type: 'energy-rings'
                });
            }
        }
    }
    
    createPulseWave() {
        // Create expanding pulse wave
        const numParticles = 16;
        const baseRadius = this.radius + 10;
        
        for (let i = 0; i < numParticles; i++) {
            const angle = (Math.PI * 2 / numParticles) * i;
            const speed = 150; // pixels per second
            
            this.effectParticles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                maxLife: 1.0,
                alpha: 1,
                color: '#ff8000',
                size: 4,
                type: 'pulse-wave'
            });        }
    }

    renderVisualEffects(ctx) {
        // Render all effect particles
        this.effectParticles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.alpha;
            
            switch(particle.type) {
                case 'particle-trail':
                    this.renderParticleTrail(ctx, particle);
                    break;
                case 'energy-rings':
                    this.renderEnergyRing(ctx, particle);
                    break;
                case 'pulse-wave':
                    this.renderPulseWave(ctx, particle);
                    break;
            }
            
            ctx.restore();
        });
    }

    renderParticleTrail(ctx, particle) {
        // Create glowing particle effect
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    }

    renderEnergyRing(ctx, particle) {
        // Draw energy ring particle as a small glowing dot
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    renderPulseWave(ctx, particle) {
        // Draw pulse wave particle as an expanding ring
        ctx.strokeStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2;
        
        const radius = particle.size * (1 - particle.alpha + 0.5);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    applySkinEffects(ctx) {
        // Apply special visual effects based on equipped skin
        if (!this.currentSkin || this.currentSkin === 'default') return;
        
        switch(this.currentSkin) {
            case 'developer':
                // Developer Core - Cyan glowing effect
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 25;
                
                // Add pulsing effect
                const devPulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005);
                ctx.shadowBlur = 25 * devPulse;
                
                // Add cyan overlay glow
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = `rgba(0, 255, 255, ${0.3 * devPulse})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
                
            case 'legendary':
                // Neural God - Rainbow shifting effect
                const time = Date.now() * 0.003;
                const hue = (time * 60) % 360;
                const rainbowColor = `hsl(${hue}, 100%, 50%)`;
                
                ctx.shadowColor = rainbowColor;
                ctx.shadowBlur = 30;
                
                // Add rainbow pulse rings
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                
                for (let i = 0; i < 3; i++) {
                    const ringHue = (hue + i * 120) % 360;
                    const ringRadius = this.radius + 5 + i * 8;
                    const alpha = 0.4 * (0.5 + 0.5 * Math.sin(time + i));
                    
                    ctx.strokeStyle = `hsla(${ringHue}, 100%, 50%, ${alpha})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                
                ctx.restore();
                break;
        }
    }
}
