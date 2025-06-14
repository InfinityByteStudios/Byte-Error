// Main Game class - handles game initialization and main loop
window.Game = class {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize audio manager
        this.audioManager = new AudioManager();
          // Set up dynamic canvas resizing
        this.setupCanvasResize();
          // Initialize game systems
        this.arena = new Arena(this.canvas.width, this.canvas.height);
        this.input = new InputManager(this); // Pass game reference for custom key bindings
        this.difficultyManager = new DifficultyManager(); // Add difficulty system
        
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
          // Apply current skin to player (after shop data is loaded)
        setTimeout(() => {
            this.player.setSkin(this.currentSkin);
            this.player.setEquippedEffects(this.equippedEffects);
        }, 100);
        
        // Apply difficulty modifiers to player
        this.difficultyManager.applyPlayerModifiers(this.player);
          this.enemyManager = new EnemyManager(this.arena, this.difficultyManager);
        this.upgradeSystem = new UpgradeSystem(); // Add upgrade system
        this.visualEffects = new VisualEffects(); // Visual effects system
        
        // Initialize UI system
        this.ui = new ModernUI();
        this.ui.setGame(this);

        // Game state
        this.score = 0;
        this.kills = 0;
        this.gameOver = false;
        this.paused = true; // Start paused during splash screen
        this.wasManuallyPaused = false; // Track manual pause state
        
        // Survival time tracking
        this.gameStartTime = null;        this.survivalTime = 0;
        
        // Game timing
        this.lastTime = 0;
        this.running = true;        this.gameStarted = false; // Track if game has started
        
        // Set up upgrade system event listener
        this.setupUpgradeEventListener();
        
        // Set up auto-pause when user switches tabs
        this.setupAutoFocusPause();
        
        // ByteCoin system
        this.byteCoins = 0;
        this.byteCoinMultiplier = 1; // For future upgrades that increase coin gains        // Shop system
        this.shopVisible = false;
        this.ownedSkins = ['default']; // Array of owned skin IDs
        this.currentSkin = 'default'; // Currently equipped skin
        this.ownedEffects = []; // Array of owned visual effect IDs
        this.equippedEffects = []; // Array of currently equipped effect IDs
        this.shopData = this.initializeShopData();
        
        // Load owned skins from localStorage
        this.loadOwnedSkins();
        
        // Ensure shop starts hidden
        setTimeout(() => {
            const shopOverlay = document.getElementById('shopOverlay');
            if (shopOverlay) {
                shopOverlay.classList.add('hidden');
                shopOverlay.style.display = 'none';
            }
        }, 10);
        
        // Overlay tracking for auto-pause
        this.openOverlays = new Set();
        
        // Control bindings system
        this.keyBindings = {
            moveUp: 'KeyW',
            moveDown: 'KeyS', 
            moveLeft: 'KeyA',
            moveRight: 'KeyD',
            dash: 'Space',
            overclock: 'KeyQ',
            pause: 'KeyP',
            shop: 'KeyM',
            help: 'KeyH',            changelog: 'KeyC'
        };
        this.loadKeyBindings();        this.isListeningForKey = false;        this.currentBindingAction = null;
        
        // Debug mode state
        this.debugModeUnlocked = false;
        
        // Set up key binding event listeners
        this.setupKeyBindingListeners();
        
        // Set up global key handlers
        this.setupGlobalKeyHandlers();
          this.showSplashScreen();
    }
    
    showSplashScreen() {
        // Try to start intro music immediately when game loads
        console.log('🎵 Attempting to start Loading Intro music...');
        this.audioManager.testAutoplayAndPrompt().then(result => {
            if (result.success) {
                console.log('✅ Audio autoplay successful');
                // If autoplay works, proceed normally
                this.proceedWithSplashSequence();
            } else if (result.requiresPrompt) {
                console.log('🔇 Audio autoplay blocked, showing prompt');
                // If autoplay is blocked, show audio prompt
                this.showAudioPrompt();
            }
        });
    }

    proceedWithSplashSequence() {
        // Show studio splash screen for 3 seconds, then transition to game logo
        setTimeout(() => {
            this.showGameLogo();
        }, 3000);
    }    showAudioPrompt() {
        const audioPrompt = document.getElementById('audioPrompt');
        const enableAudioBtn = document.getElementById('enableAudioBtn');
        const continueWithoutAudioBtn = document.getElementById('continueWithoutAudioBtn');
        
        if (audioPrompt && enableAudioBtn && continueWithoutAudioBtn) {
            // Show the audio prompt overlay
            audioPrompt.classList.remove('hidden');
            
            // Set up event listeners for the buttons
            const enableAudioHandler = () => {
                console.log('🎵 User enabled audio');
                this.audioManager.enableAudioAfterInteraction().then(success => {
                    if (success) {
                        console.log('✅ Audio enabled after user interaction');
                    } else {
                        console.log('❌ Audio still failed after user interaction');
                    }
                });
                this.hideAudioPromptAndProceed();
                enableAudioBtn.removeEventListener('click', enableAudioHandler);
                continueWithoutAudioBtn.removeEventListener('click', continueWithoutAudioHandler);
            };
            
            const continueWithoutAudioHandler = () => {
                console.log('🔇 User chose to continue without audio');
                this.audioManager.disableAudio();
                this.hideAudioPromptAndProceed();
                enableAudioBtn.removeEventListener('click', enableAudioHandler);
                continueWithoutAudioBtn.removeEventListener('click', continueWithoutAudioHandler);
            };
            
            enableAudioBtn.addEventListener('click', enableAudioHandler);
            continueWithoutAudioBtn.addEventListener('click', continueWithoutAudioHandler);
        } else {
            console.warn('Audio prompt elements not found, proceeding without audio prompt');
            this.proceedWithSplashSequence();
        }
    }

    hideAudioPromptAndProceed() {
        const audioPrompt = document.getElementById('audioPrompt');
        if (audioPrompt) {
            audioPrompt.classList.add('hidden');
        }
        this.proceedWithSplashSequence();
    }showGameLogo() {
        const studioSplash = document.getElementById('studioSplash');
        const gameSplash = document.getElementById('gameSplash');
        
        if (studioSplash && gameSplash) {
            // Start fading out studio splash
            studioSplash.classList.remove('active');
            studioSplash.classList.add('fade-out');
            
            // Start fading in game logo slightly before studio splash finishes
            setTimeout(() => {
                gameSplash.classList.add('fade-in');
            }, 300);
            
            // Clean up studio splash after it's fully faded
            setTimeout(() => {
                studioSplash.style.display = 'none';
                studioSplash.classList.remove('fade-out');                // Show game logo for 2.0 seconds, then start audio crossfade and visual transition
                setTimeout(() => {
                    // Start audio crossfade 500ms before visual transition for seamless experience
                    this.audioManager.crossfadeAudio().catch(error => {
                        console.log('🔇 Enhanced crossfade failed, attempting fallback audio start:', error);
                    });
                    
                    // Start visual transition after brief delay
                    setTimeout(() => {
                        this.startGameFromLogo();
                    }, 500);
                }, 2000);
            }, 1000);
        } else {            this.hideSplashScreen();
        }
    }
    
    startGameFromLogo() {
        const gameSplash = document.getElementById('gameSplash');
        const gameContainer = document.getElementById('gameContainer');
        
        // Audio crossfade is handled earlier in showGameLogo() for perfect timing
        console.log('🎬 Starting visual transition to game...');
        
        if (gameSplash) {
            // Start fading out game logo
            gameSplash.classList.remove('fade-in');
            gameSplash.classList.add('fade-out');
            
            // Start showing game container with fade slightly before logo finishes
            setTimeout(() => {
                if (gameContainer) {
                    gameContainer.style.opacity = '0';
                    gameContainer.style.display = 'block';
                    gameContainer.style.transition = 'opacity 1s ease-in-out';
                    
                    // Fade in game container
                    setTimeout(() => {
                        gameContainer.style.opacity = '1';
                    }, 50);
                }            }, 300);
            
            // Clean up game splash after fade completes
            setTimeout(() => {
                gameSplash.style.display = 'none';
                gameSplash.classList.remove('fade-out');
                this.showAuthenticationScreen();
            }, 1000);
        } else {
            this.showAuthenticationScreen();
        }
    }
    
    showAuthenticationScreen() {
        console.log('🔐 Showing authentication screen...');
        
        // Initialize the AuthManager if it doesn't exist
        if (!window.authManager) {
            window.authManager = new AuthManager();
        }
        
        // Show the authentication overlay
        window.authManager.showAuthOverlay();
    }
    
    setUserProfile(userProfile) {
        this.userProfile = userProfile;
        console.log('👤 User profile set:', userProfile.name);
    }
    
    startGame() {
        console.log('🎮 Starting game after authentication...');
        this.showDifficultySelection();
    }
    
    hideSplashScreen() {
        // This method is now only used as a fallback if splash elements are missing
        const studioSplash = document.getElementById('studioSplash');
        const gameSplash = document.getElementById('gameSplash');
        
        if (studioSplash) studioSplash.style.display = 'none';
        if (gameSplash) gameSplash.style.display = 'none';
        this.start();
    }

    showDifficultySelection() {
        // Only show difficulty selection if game hasn't started or is over
        if (this.gameStarted && !this.gameOver) {
            console.log('Cannot show difficulty selection during active gameplay');
            return;
        }
        
        // Reset game state
        this.gameStarted = false;
        this.paused = true;
        
        // Show the difficulty selection screen
        const difficultyScreen = document.getElementById('difficultyScreen');
        if (difficultyScreen) {
            difficultyScreen.style.display = 'flex';
            
            // Create difficulty options if they don't exist
            if (!difficultyScreen.querySelector('.difficulty-option')) {
                this.createDifficultyOptions();
            }
        }
        
        // Set up event listeners for difficulty selection
        this.setupDifficultyEventListeners();
    }

    setupDifficultyEventListeners() {
        const difficultyOptions = document.querySelectorAll('.difficulty-option');
        
        difficultyOptions.forEach(option => {
            option.addEventListener('click', (event) => {
                const difficulty = event.currentTarget.getAttribute('data-difficulty');
                this.selectDifficulty(difficulty);
            });
        });
    }

    selectDifficulty(difficulty) {
        // Ignore difficulty selection if game is already in progress
        if (this.gameStarted && !this.gameOver) {
            console.log('Cannot change difficulty during active gameplay');
            return;
        }
        
        console.log(`🎮 Player selected difficulty: ${difficulty}`);
          // Reset game state
        this.score = 0;
        this.kills = 0;
        this.gameOver = false;
        this.paused = false;
        this.gameStartTime = null; // Reset to null, will be set when game actually starts
        this.survivalTime = 0;        // Reset player to center
        if (this.player) {
            this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
            // Apply current skin to new player
            this.player.setSkin(this.currentSkin);
            // Apply equipped effects to new player
            this.player.setEquippedEffects(this.equippedEffects);
        }
        
        // Set the difficulty in the difficulty manager
        if (this.difficultyManager.setDifficulty(difficulty)) {
            // Re-apply difficulty modifiers to player
            this.difficultyManager.applyPlayerModifiers(this.player);
            
            // Update enemy manager with new difficulty
            this.enemyManager = new EnemyManager(this.arena, this.difficultyManager);
            
            // Reset arena
            this.arena.resetSafeZone();
            
            // Hide difficulty selection screen
            const difficultyScreen = document.getElementById('difficultyScreen');
            if (difficultyScreen) {
                difficultyScreen.style.display = 'none';
            }
            
            // Start the game
            this.start();
        } else {
            console.error(`Failed to set difficulty: ${difficulty}`);
        }
    }

    changeDifficultyOnGameOver() {
        console.log('🎮 Player requested difficulty change from game over screen');
        
        // Hide game over screen
        const gameOverScreen = document.getElementById('gameOverScreen');
        if (gameOverScreen) {
            gameOverScreen.style.display = 'none';
        }
        
        // Reset to pre-game state
        this.gameOver = false;
        this.gameStarted = false;
        
        // Show difficulty selection
        this.showDifficultySelection();
    }    start() {
        this.gameStarted = true;
        this.paused = false; // Unpause the game when it starts
        this.gameStartTime = Date.now(); // Set the actual start time
        
        // Show the game container if it's not already visible
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer && gameContainer.style.display === 'none') {
            gameContainer.style.display = 'block';
        }
        
        // Ensure canvas is properly sized
        this.setupCanvasResize();
          // Give canvas focus for input
        this.canvas.focus();
        
        // Start the game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }
      setupCanvasResize() {
        // Function to resize canvas to fill viewport
        const resizeCanvas = () => {
            const canvas = this.canvas;
            const container = canvas.parentElement;
            
            // Get actual viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Set canvas internal resolution
            canvas.width = viewportWidth;
            canvas.height = viewportHeight;
            
            // Optimize canvas context for performance
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            
            // Update arena dimensions if it exists
            if (this.arena) {
                this.arena.width = viewportWidth;
                this.arena.height = viewportHeight;
            }
            
            // Reposition player to center if it exists
            if (this.player) {
                this.player.x = viewportWidth / 2;
                this.player.y = viewportHeight / 2;            }
        };
        
        // Initial resize
        resizeCanvas();
        
        // Resize on window resize
        window.addEventListener('resize', resizeCanvas);
        
        // Also handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(resizeCanvas, 100); // Small delay to ensure proper dimensions
        });
    }    gameLoop(currentTime) {
        if (!this.lastTime) {
            this.lastTime = currentTime;
        }
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
          if (!this.gameOver && !this.paused) {
            this.update(deltaTime);
              // Update survival time
            if (this.gameStartTime !== null && this.gameStarted) {
                this.survivalTime = (Date.now() - this.gameStartTime) / 1000;
            } else {
                this.survivalTime = 0; // Ensure it's 0 before game starts
            }
        }
        
        // Handle input regardless of pause state (so pause/unpause works)
        this.handleGameInput();
        
        this.render();
          // Update UI with current game data
        const gameData = {
            player: this.player,
            score: this.score,
            kills: this.kills,
            survivalTime: this.survivalTime,
            byteCoins: this.byteCoins,
            enemyCount: this.enemyManager.getActiveEnemyCount(),
            enemyManager: this.enemyManager,
            upgradeSystem: this.upgradeSystem,
            gameOver: this.gameOver,
            paused: this.paused,
            shopVisible: this.shopVisible,
            arena: this.arena,
            enemies: this.enemyManager.enemies
        };
        
        this.ui.update(deltaTime, gameData);
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update(deltaTime) {
        // Don't update game if game over
        if (this.gameOver) return;        // Update player and capture action events for visual effects
        const playerActionEvents = this.player.update(deltaTime, this.input, this.arena, this);
        
        // Update arena (safe zone timer)
        this.arena.update(deltaTime, this.player.x, this.player.y);
        
        // Trigger visual effects for player actions
        if (playerActionEvents && playerActionEvents.dashActivated) {
            this.visualEffects.onDashUsed(this.player.x, this.player.y);
        }
        if (playerActionEvents && playerActionEvents.overclockActivated) {
            this.visualEffects.onOverclockActivated(this.player.x, this.player.y);
        }
        
        // Update enemies
        this.enemyManager.update(deltaTime, this.player);
          // Update visual effects
        this.visualEffects.update(deltaTime);
        
        // Handle difficulty-based healing
        this.handleDifficultyHealing(deltaTime);
          // Check bullet-enemy collisions
        const collisionResult = this.enemyManager.checkBulletCollisions(this.player.bullets, this.visualEffects);
        if (collisionResult.points > 0) {
            this.score += collisionResult.points;
            this.kills += collisionResult.kills;
            this.addByteCoins(collisionResult.byteCoins || 0);
            
            // Call player onKill method for each kill (to charge Overclock)
            for (let i = 0; i < collisionResult.kills; i++) {
                this.player.onKill();
            }
            
            // Trigger UI flash effects for visual feedback
            this.ui.flashScore();
            this.ui.flashKill();
        }        // Check player-enemy collisions
        const hitEnemy = this.enemyManager.checkPlayerCollisions(this.player, this.arena);
        if (hitEnemy) {
            // Get enemy-specific damage from difficulty manager
            const damage = this.difficultyManager.getEnemyDamage(hitEnemy.type);
            const playerDied = this.player.takeDamage(damage);
            
            // Trigger visual effects for player damage
            this.visualEffects.onPlayerHit(this.player.x, this.player.y, damage);if (playerDied) {
                // Reset safe zone when player dies
                this.arena.resetSafeZone();
                this.gameOver = true;
                console.log('Game Over!');
            }
        }
        
        // Check for wave completion to show upgrade menu
        this.checkForWaveCompletion();
    }render() {
        // Reset all canvas settings at the start
        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = 'transparent';
        
        // Apply screen shake offset
        const shakeOffset = this.visualEffects.getScreenShakeOffset();
        this.ctx.save();
        this.ctx.translate(shakeOffset.x, shakeOffset.y);
        
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(-shakeOffset.x, -shakeOffset.y, this.canvas.width, this.canvas.height);
        
        // Apply Overclock screen effects
        if (this.player.isOverclocked) {
            this.renderOverclockScreenEffects();
        }
        
        // Render arena
        this.arena.render(this.ctx);
        
        // Reset alpha between major renders
        this.ctx.globalAlpha = 1.0;
        
        // Render enemies
        this.enemyManager.render(this.ctx);
        
        // Reset alpha between major renders
        this.ctx.globalAlpha = 1.0;
        
        // Render player
        this.player.render(this.ctx);
        
        // Reset alpha between major renders
        this.ctx.globalAlpha = 1.0;
        
        // Render visual effects (sparks, damage numbers, etc.)
        this.visualEffects.render(this.ctx);
        
        // Reset alpha between major renders
        this.ctx.globalAlpha = 1.0;
        
        // Apply final Overclock overlay effects
        if (this.player.isOverclocked) {
            this.renderOverclockOverlay();
        }
        
        // Restore transform
        this.ctx.restore();
        
        // Render UI elements on top
        this.ui.render(this.ctx);
    }
    
    setupUpgradeEventListener() {
        // Listen for upgrade selection events from UI
        document.addEventListener('upgradeSelected', (event) => {
            const upgradeId = event.detail.upgradeId;
            console.log(`🔧 Player selected upgrade: ${upgradeId}`);
            
            // Apply the upgrade
            const upgradeEffects = this.upgradeSystem.applyUpgrade(upgradeId);
            
            // Update player with new effects
            const allEffects = this.upgradeSystem.getActiveEffects();
            this.player.applyUpgradeEffects(allEffects);
            
            // Hide upgrade menu and continue game
            this.ui.hideUpgradeMenu();
            this.upgradeSystem.setUpgradeMenuVisible(false);
            
            // Continue to next wave
            this.enemyManager.continueAfterUpgrade();
        });
    }
    
    loadKeyBindings() {
        // Load key bindings from localStorage or use defaults
        const savedBindings = localStorage.getItem('neurocoreKeyBindings');
        if (savedBindings) {
            try {
                this.keyBindings = { ...this.keyBindings, ...JSON.parse(savedBindings) };
                console.log('🎮 Key bindings loaded from localStorage');
            } catch (error) {
                console.warn('❌ Failed to load key bindings, using defaults');
            }
        }
    }
    
    saveKeyBindings() {
        // Save key bindings to localStorage
        localStorage.setItem('neurocoreKeyBindings', JSON.stringify(this.keyBindings));
        console.log('💾 Key bindings saved');
    }
    
    setupKeyBindingListeners() {
        // Set up event listeners for key binding customization
        document.addEventListener('keydown', (event) => {
            if (this.isListeningForKey && this.currentBindingAction) {
                event.preventDefault();
                this.setKeyBinding(this.currentBindingAction, event.code);
                this.completeKeyBinding(event.code);
            }
        });
    }
    
    startKeyBinding(action) {
        // Start listening for a key to bind to an action
        this.isListeningForKey = true;
        this.currentBindingAction = action;
        this.showKeyBindingInstruction();
        console.log(`🎯 Listening for key binding for action: ${action}`);
    }
    
    setKeyBinding(action, keyCode) {
        // Set a key binding for an action
        if (action && keyCode) {
            this.keyBindings[action] = keyCode;
            console.log(`🎮 Key binding set: ${action} = ${keyCode}`);
        }
    }
    
    resetKeyBindings() {
        // Reset key bindings to defaults
        this.keyBindings = {
            dash: 'Space',
            overclock: 'KeyQ',
            pause: 'KeyP',
            shop: 'KeyM',
            help: 'KeyH',
            changelog: 'KeyC'
        };
        this.saveKeyBindings();
        this.updateKeyBindingDisplay();
        console.log('🔄 Key bindings reset to defaults');
    }
    
    updateKeyBindingDisplay() {
        // Update the UI to show current key bindings
        Object.keys(this.keyBindings).forEach(action => {
            const element = document.getElementById(`key-${action}`);
            if (element) {
                element.textContent = this.getKeyDisplayName(this.keyBindings[action]);
            }
        });
    }
    
    getKeyDisplayName(keyCode) {
        // Convert key code to display-friendly name
        const keyMap = {
            'Space': 'SPACE',
            'KeyQ': 'Q',
            'KeyW': 'W',
            'KeyE': 'E',
            'KeyR': 'R',
            'KeyT': 'T',
            'KeyA': 'A',
            'KeyS': 'S',
            'KeyD': 'D',
            'KeyF': 'F',
            'KeyP': 'P',
            'KeyM': 'M',
            'KeyH': 'H',
            'KeyC': 'C',
            'ShiftLeft': 'L-SHIFT',
            'ShiftRight': 'R-SHIFT',
            'ControlLeft': 'L-CTRL',
            'ControlRight': 'R-CTRL'
        };
        return keyMap[keyCode] || keyCode;
    }
    
    showKeyBindingInstruction() {
        // Show instruction to press a key
        const instruction = document.createElement('div');
        instruction.id = 'keyBindingInstruction';
        instruction.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: #00ffff;
            padding: 20px;
            border: 2px solid #00ffff;
            border-radius: 10px;
            text-align: center;
            z-index: 10000;
            font-family: 'Courier New', monospace;
            font-size: 16px;
        `;
        instruction.innerHTML = `
            <div>Press a key to bind to this action</div>
            <div style="margin-top: 10px; font-size: 12px;">Press ESC to cancel</div>
        `;
        document.body.appendChild(instruction);
    }
    
    hideKeyBindingInstruction() {
        // Hide the key binding instruction
        const instruction = document.getElementById('keyBindingInstruction');
        if (instruction) {
            document.body.removeChild(instruction);
        }
    }
    
    cancelKeyBinding() {
        // Cancel key binding process
        this.isListeningForKey = false;
        this.currentBindingAction = null;
        this.hideKeyBindingInstruction();
        console.log('❌ Key binding cancelled');
    }
    
    completeKeyBinding(keyCode) {
        // Complete the key binding process
        this.isListeningForKey = false;
        this.currentBindingAction = null;
        this.hideKeyBindingInstruction();
        this.saveKeyBindings();
        this.updateKeyBindingDisplay();
        console.log(`✅ Key binding completed: ${keyCode}`);
    }
    
    setupGlobalKeyHandlers() {
        // Set up global key handlers that work regardless of focus
        document.addEventListener('keydown', (event) => {
            // Handle escape key during key binding
            if (this.isListeningForKey && event.code === 'Escape') {
                event.preventDefault();
                this.cancelKeyBinding();
                return;
            }
            
            // Handle other global keys (pause, etc.)
            this.handleGlobalKeyPress(event);
        });
    }
    
    handleGlobalKeyPress(event) {
        // Handle global key presses (pause, shop, help, etc.)
        switch (event.code) {
            case this.keyBindings.pause:
                event.preventDefault();
                this.togglePause();
                break;
            case this.keyBindings.shop:
                if (this.gameStarted && !this.gameOver) {
                    event.preventDefault();
                    this.toggleShop();
                }
                break;
            case this.keyBindings.help:
                event.preventDefault();
                this.ui.toggleHelp();
                break;
            case this.keyBindings.changelog:
                event.preventDefault();
                this.ui.toggleChangelog();
                break;
        }
    }
    
    handleEscapeKey() {
        // Handle escape key for closing overlays
        if (this.ui.helpVisible) {
            this.ui.hideHelp();
        } else if (this.ui.settingsVisible) {
            this.ui.hideSettings();
        } else if (this.shopVisible) {
            this.hideShop();
        }
    }
    
    togglePause() {
        // Toggle pause state
        if (this.gameStarted && !this.gameOver) {
            this.paused = !this.paused;
            this.wasManuallyPaused = this.paused;
            
            if (this.debugModeUnlocked) {
                console.log(this.paused ? '⏸️ Game Paused' : '▶️ Game Resumed');
            }
        }
    }
    
    toggleShop() {
        // Toggle shop visibility
        if (this.shopVisible) {
            this.hideShop();
        } else {
            this.showShop();
        }
    }
    
    showShop() {
        // Show the shop overlay
        const shopOverlay = document.getElementById('shopOverlay');
        if (shopOverlay) {
            shopOverlay.classList.remove('hidden');
            this.shopVisible = true;
            this.setOverlayOpen('shop', true);
        }
    }
    
    hideShop() {
        // Hide the shop overlay
        const shopOverlay = document.getElementById('shopOverlay');
        if (shopOverlay) {
            shopOverlay.classList.add('hidden');
            this.shopVisible = false;
            this.setOverlayOpen('shop', false);
        }
    }

    setupAutoFocusPause() {
        // Function to pause the game when the window loses focus
        const handleVisibilityChange = () => {
            if (document.hidden) {
                this.pauseGame();
            } else {
                this.resumeGame();
            }        };
        
        // Initial check and setup
        document.addEventListener('visibilitychange', handleVisibilityChange);
        if (document.hidden) {
            this.pauseGame();
        }
    }
    
    checkForWaveCompletion() {
        // Check if wave is completed and upgrade menu should be shown
        if (this.enemyManager.getWaveState() === 'completed' && 
            !this.upgradeSystem.shouldShowUpgradeMenu()) {
            
            // Generate upgrade choices and show menu
            const upgradeChoices = this.upgradeSystem.generateUpgradeChoices();
            this.upgradeSystem.setUpgradeMenuVisible(true);
            this.ui.showUpgradeMenu(upgradeChoices);
        }
    }
    
    handleDifficultyHealing(deltaTime) {
        // Handle difficulty-based healing
        const healingMode = this.difficultyManager.getCurrentDifficulty().healingType;
        
        if (healingMode === 'gradual' && this.gameStarted && !this.gameOver) {
            const healingRate = this.difficultyManager.getCurrentDifficulty().healingRate;
            if (healingRate > 0) {
                this.player.heal(healingRate * deltaTime);
            }
        }
    }
    
    addByteCoins(amount) {
        if (this.debugModeUnlocked) {
            // In debug mode, don't actually change the amount - show infinite
            console.log(`🪙 ByteCoins gained: ${amount} (Debug mode: infinite coins)`);
            return;
        }
        
        this.byteCoins += Math.floor(amount * this.byteCoinMultiplier);
        this.ui.updateByteCoins(this.byteCoins);
        console.log(`🪙 ByteCoins: ${this.byteCoins} (+${amount})`);
    }
    
    start() {
        this.gameStarted = true;
        this.paused = false;
        this.gameStartTime = Date.now();
        
        // Start the game loop if not already running
        if (!this.running) {
            this.running = true;
            this.gameLoop();
        }
        
        console.log('🎮 Game started!');
    }
    
    gameLoop(currentTime = 0) {
        if (!this.running) return;
        
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;
        
        // Update survival time if game is active
        if (this.gameStarted && !this.paused && !this.gameOver && this.gameStartTime) {
            this.survivalTime = (currentTime - this.gameStartTime) / 1000;
        }
        
        // Update game state if not paused
        if (!this.paused && this.gameStarted) {
            this.update(deltaTime);
        }
        
        // Update UI
        this.ui.update(deltaTime, {
            player: this.player,
            arena: this.arena,
            enemyManager: this.enemyManager,
            upgradeSystem: this.upgradeSystem,
            score: this.score,
            kills: this.kills,
            paused: this.paused,
            gameOver: this.gameOver,
            survivalTime: this.survivalTime,
            shopVisible: this.shopVisible || false
        });
        
        // Render game
        this.render();
        
        // Continue loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    render() {
        // Reset all canvas settings at the start
        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = 'transparent';
        
        // Apply screen shake offset
        const shakeOffset = this.visualEffects.getScreenShakeOffset();
        this.ctx.save();
        this.ctx.translate(shakeOffset.x, shakeOffset.y);
        
               
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(-shakeOffset.x, -shakeOffset.y, this.canvas.width, this.canvas.height);
        
        // Apply Overclock screen effects
        if (this.player.isOverclocked) {
            this.renderOverclockScreenEffects();
        }
        
        // Render arena
        this.arena.render(this.ctx);
        
        // Reset alpha between major renders
        this.ctx.globalAlpha = 1.0;
        
        // Render enemies
        this.enemyManager.render(this.ctx);
        
        // Reset alpha between major renders
        this.ctx.globalAlpha = 1.0;
        
        // Render player
        this.player.render(this.ctx);
        
        // Reset alpha between major renders
        this.ctx.globalAlpha = 1.0;
        
        // Render visual effects (sparks, damage numbers, etc.)
        this.visualEffects.render(this.ctx);
        
        // Reset alpha between major renders
        this.ctx.globalAlpha = 1.0;
        
        // Apply final Overclock overlay effects
        if (this.player.isOverclocked) {
            this.renderOverclockOverlay();
        }
        
        // Restore transform
        this.ctx.restore();
        
        // Render UI elements on top
        this.ui.render(this.ctx);
    }
    
    renderOverclockScreenEffects() {
        // Render screen overlay effects during Overclock
        this.ctx.save();
        
        // Create a subtle pulsing overlay
        const time = Date.now() / 1000;
        const pulse = 0.05 + 0.03 * Math.sin(time * 8);
        
        this.ctx.fillStyle = `rgba(255, 0, 255, ${pulse})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.restore();
    }
    
    renderOverclockOverlay() {
        // Additional overlay effects during Overclock
        this.ctx.save();
        
        // Create glowing border effect
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#ff00ff';
        this.ctx.strokeRect(5, 5, this.canvas.width - 10, this.canvas.height - 10);
        
        this.ctx.restore();
    }

    initializeShopData() {
        return {
            skins: {
                'developer-core': {
                    id: 'developer-core',
                    name: 'Developer Core',
                    type: 'premium',
                    cost: 1000,
                    description: 'Elite developer neural interface',
                    color: '#ff6600',
                    glowColor: '#ff9944'
                },
                'neural-god': {
                    id: 'neural-god',
                    name: 'Neural God',
                    type: 'premium',
                    cost: 2000,
                    description: 'Transcendent AI consciousness',
                    color: '#gold',
                    glowColor: '#ffff00'
                },
                'og-red': { id: 'og-red', name: 'OG Red', type: 'og', cost: 500, description: 'Classic red interface', color: '#ff0000' },
                'og-blue': { id: 'og-blue', name: 'OG Blue', type: 'og', cost: 500, description: 'Classic blue interface', color: '#0080ff' },
                'og-green': { id: 'og-green', name: 'OG Green', type: 'og', cost: 500, description: 'Classic green interface', color: '#00ff00' },
                'og-yellow': { id: 'og-yellow', name: 'OG Yellow', type: 'og', cost: 500, description: 'Classic yellow interface', color: '#ffff00' },
                'og-purple': { id: 'og-purple', name: 'OG Purple', type: 'og', cost: 500, description: 'Classic purple interface', color: '#8000ff' },
                'og-cyan': { id: 'og-cyan', name: 'OG Cyan', type: 'og', cost: 0, description: 'Free classic cyan interface', color: '#00ffff' }
            },
            effects: {
                'particle-trail': { id: 'particle-trail', name: 'Particle Trail', cost: 750, description: 'Stunning particle trail' },
                'energy-rings': { id: 'energy-rings', name: 'Energy Rings', cost: 1000, description: 'Pulsing energy rings' },
                'pulse-wave': { id: 'pulse-wave', name: 'Pulse Wave', cost: 1250, description: 'Rhythmic pulse waves' }
            }
        };
    }

    loadOwnedSkins() {
        // In the new system, purchases don't persist
        // Reset to defaults each game session
        this.ownedSkins = ['default', 'og-cyan']; // Default skin + free cyan OG
        this.currentSkin = 'default';
        this.ownedEffects = [];
        this.equippedEffects = [];
        
        console.log('🛒 Shop data reset for new session');
        console.log('👕 Owned skins:', this.ownedSkins);
        console.log('🎨 Owned effects:', this.ownedEffects);
    }
    
    pauseGame() {
        if (!this.paused && this.gameStarted) {
            this.paused = true;
            this.wasManuallyPaused = false; // This is auto-pause
            console.log('⏸️ Game auto-paused (focus lost)');
        }
    }
    
    resumeGame() {
        if (this.paused && this.gameStarted && !this.wasManuallyPaused) {
            this.paused = false;
            console.log('▶️ Game auto-resumed (focus gained)');
        }
    }
      setOverlayOpen(overlayName, isOpen) {
        // Track which overlays are open for pause management
        console.log(`📋 Overlay ${overlayName} ${isOpen ? 'opened' : 'closed'}`);
    }
};