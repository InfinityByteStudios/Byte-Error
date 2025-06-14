// Firebase Authentication Manager for NeuroCore: Byte Wars
window.AuthManager = class {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.initializeFirebase();
        this.setupEventListeners();
    }

    initializeFirebase() {
        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyCo5hr7ULHLL_0UAAst74g8ePZxkB7OHFQ",
            authDomain: "shared-sign-in.firebaseapp.com",
            projectId: "shared-sign-in",
            storageBucket: "shared-sign-in.firebasestorage.app",
            messagingSenderId: "332039027753",
            appId: "1:332039027753:web:aa7c6877d543bb90363038",
            measurementId: "G-KK5XVVLMVN"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        this.auth = firebase.auth();

        // Set up auth state listener
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.user = user;
                this.isAuthenticated = true;
                this.onAuthSuccess(user);
                console.log('🔐 User signed in:', user.displayName || user.email);
            } else {
                this.user = null;
                this.isAuthenticated = false;
                console.log('🔓 User signed out');
            }
        });
    }

    setupEventListeners() {
        // Google Sign-In
        document.getElementById('googleSignInBtn')?.addEventListener('click', () => {
            this.signInWithGoogle();
        });

        // GitHub Sign-In
        document.getElementById('githubSignInBtn')?.addEventListener('click', () => {
            this.signInWithGitHub();
        });

        // Play Offline
        document.getElementById('playOfflineBtn')?.addEventListener('click', () => {
            this.playOffline();
        });
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            
            const result = await this.auth.signInWithPopup(provider);
            console.log('✅ Google sign-in successful:', result.user.displayName);
        } catch (error) {
            console.error('❌ Google sign-in error:', error);
            this.showAuthError('Failed to sign in with Google. Please try again.');
        }
    }

    async signInWithGitHub() {
        try {
            const provider = new firebase.auth.GithubAuthProvider();
            provider.addScope('user:email');
            
            const result = await this.auth.signInWithPopup(provider);
            console.log('✅ GitHub sign-in successful:', result.user.displayName);
        } catch (error) {
            console.error('❌ GitHub sign-in error:', error);
            this.showAuthError('Failed to sign in with GitHub. Please try again.');
        }
    }

    playOffline() {
        console.log('🎮 Playing offline mode');
        this.hideAuthOverlay();
        // Start the game without authentication
        if (window.game) {
            window.game.startGame();
        }
    }

    onAuthSuccess(user) {
        console.log('🎉 Authentication successful!');
        this.hideAuthOverlay();
        
        // Store user data for game use
        this.userProfile = {
            uid: user.uid,
            name: user.displayName || 'Player',
            email: user.email,
            photoURL: user.photoURL,
            provider: user.providerData[0]?.providerId || 'unknown'
        };

        // Start the game
        if (window.game) {
            window.game.setUserProfile(this.userProfile);
            window.game.startGame();
        }
    }

    showAuthOverlay() {
        const overlay = document.getElementById('authOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    hideAuthOverlay() {
        const overlay = document.getElementById('authOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showAuthError(message) {
        // Create a simple notification for auth errors
        const notification = document.createElement('div');
        notification.className = 'auth-error-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 3000;
            font-size: 14px;
            box-shadow: 0 5px 15px rgba(255, 68, 68, 0.3);
            animation: slideInRight 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }

    async signOut() {
        try {
            await this.auth.signOut();
            console.log('👋 User signed out successfully');
        } catch (error) {
            console.error('❌ Sign out error:', error);
        }
    }

    getUserProfile() {
        return this.userProfile || null;
    }

    isUserAuthenticated() {
        return this.isAuthenticated;
    }
};

// Add CSS for error notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
