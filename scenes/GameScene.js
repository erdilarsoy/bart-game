import Phaser from 'https://esm.sh/phaser@3.70.0';
import * as Tone from 'https://esm.sh/tone@14.7.77';
import {
    computeOverallRisk,
    computeEfficiency,
    computeAdaptation,
    computeLossSensitivity,
    computeDecisionSpeed
} from './stats.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        // Game State
        this.trials = [];
        this.currentTrialIndex = 0;
        this.currentMoney = 0;
        this.totalMoney = 0;
        this.balloonPumps = 0;
        this.isPumpInProgress = false;

        // Configuration for balloon types
        // Old colors restored:
        // Training -> Green
        // Low -> Teal
        // Medium -> Amber
        // High -> Deep Pink
        this.balloonTypes = {
            'training': { color: null, maxPumps: 32, valuePerPump: 1, sprite: 'balloon-green', name: 'Training' },
            'low': { color: null, maxPumps: 128, valuePerPump: 5, sprite: 'balloon-blue', name: 'Low Risk' },
            'medium': { color: null, maxPumps: 32, valuePerPump: 15, sprite: 'balloon-yellow', name: 'Medium Risk' },
            'high': { color: null, maxPumps: 8, valuePerPump: 50, sprite: 'balloon-red', name: 'High Risk' }
        };

        // Data Logging
        this.trialLog = [];

        // Audio cleanup tracking
        this.audioNodes = [];
    }

    // Cleanup audio nodes on scene shutdown
    shutdown() {
        // Stop and dispose all audio nodes
        if (this.audioNodes) {
            this.audioNodes.forEach(node => {
                try {
                    if (node && typeof node.stop === 'function') {
                        node.stop();
                    }
                    if (node && typeof node.dispose === 'function') {
                        node.dispose();
                    }
                } catch (e) {
                    // Silently handle cleanup errors
                }
            });
            this.audioNodes = [];
        }
    }

    // Helper to track and auto-cleanup audio nodes
    trackAudioNode(node, cleanupTime) {
        if (!node) return node;

        this.audioNodes.push(node);
        if (cleanupTime && this.time) {
            this.time.delayedCall(cleanupTime, () => {
                try {
                    const index = this.audioNodes.indexOf(node);
                    if (index > -1) {
                        // Stop if it has a stop method (and not already stopped)
                        if (node.stop && typeof node.stop === 'function') {
                            try {
                                node.stop();
                            } catch (e) {
                                // Node may already be stopped
                            }
                        }
                        // Disconnect before disposing
                        if (node.disconnect && typeof node.disconnect === 'function') {
                            try {
                                node.disconnect();
                            } catch (e) {
                                // Already disconnected
                            }
                        }
                        // Dispose if it has a dispose method
                        if (node.dispose && typeof node.dispose === 'function') {
                            try {
                                node.dispose();
                            } catch (e) {
                                // May already be disposed
                            }
                        }
                        // Remove from tracking
                        this.audioNodes.splice(index, 1);
                    }
                } catch (e) {
                    // Silently handle any cleanup errors
                }
            });
        }
        return node;
    }

    create() {
        // Expose log globally for easy access
        window.trialLog = this.trialLog;

        // Ensure Audio Context is running on any input
        this.input.on('pointerdown', async () => {
            if (Tone && Tone.context && Tone.context.state !== 'running') {
                try {
                    await Tone.start();
                } catch (e) {
                    console.warn('Failed to start audio context:', e);
                }
            }
        });

        // Periodic audio context check and maintenance (every 5 seconds)
        this.time.addEvent({
            delay: 5000,
            callback: () => {
                // Ensure context is running
                if (Tone.context.state !== 'running') {
                    Tone.start().catch(e => {
                        console.warn('Periodic audio context restart failed:', e);
                    });
                }
                // Cleanup old nodes periodically
                if (this.audioNodes && this.audioNodes.length > 15) {
                    this.cleanupOldAudioNodes();
                }
            },
            loop: true
        });

        // Generate a shard texture for explosion
        const shardGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        shardGraphics.fillStyle(0xffffff);
        shardGraphics.beginPath();
        shardGraphics.moveTo(0, 0);
        shardGraphics.lineTo(10, 5);
        shardGraphics.lineTo(5, 15);
        shardGraphics.lineTo(-5, 10);
        shardGraphics.closePath();
        shardGraphics.fillPath();
        shardGraphics.generateTexture('shard', 20, 20);

        // Setup background
        this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);

        // Add Header/Footer UI
        this.header = this.add.image(0, 0, 'ui-header').setOrigin(0.5, 0); // Position at top
        this.footer = this.add.image(0, 0, 'ui-footer').setOrigin(0.5, 1); // Position at bottom

        // Initialize Trials
        this.initTrials();

        // Create UI
        this.createHeader(); // This method is empty but kept for structure

        this.createBalloonArea();
        this.createStatsPanel();
        this.createActionButtons();

        // Resize handler
        this.scale.on('resize', this.resize, this);
        this.resize(this.scale.gameSize);

        // Start first trial
        this.startTrial();
    }

    createHose() {
        // Removed as requested
    }

    initTrials() {
        // Seeded Random Generator for deterministic order
        let seed = 12345;
        const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        // Helper to generate burst point based on range (1 to max)
        const getBurstPoint = (max) => {
            return Math.floor(seededRandom() * max) + 1;
        };

        // 1. Tutorial Block: 3 trials (using training type for visuals)
        const tutorialTrials = [
            { type: 'training', burstPoint: 8 },
            { type: 'training', burstPoint: 24 },
            { type: 'training', burstPoint: 16 }
        ];

        // 2. Main Block: 60 trials
        // Each color/risk level: 20 trials each (low, medium, high)
        // Mixed order but deterministic (same for all participants)
        const mainTypes = [
            ...Array(20).fill('low'),      // 20 low-risk
            ...Array(20).fill('medium'),   // 20 medium-risk
            ...Array(20).fill('high')      // 20 high-risk
        ];

        // Deterministic shuffle to mix the order
        for (let i = mainTypes.length - 1; i > 0; i--) {
            const j = Math.floor(seededRandom() * (i + 1));
            [mainTypes[i], mainTypes[j]] = [mainTypes[j], mainTypes[i]];
        }

        // Create full trial objects for Main with deterministic burst points
        const mainTrials = mainTypes.map(type => {
            const config = this.balloonTypes[type];
            return {
                type: type,
                burstPoint: getBurstPoint(config.maxPumps)
            };
        });

        // Final Combine: Tutorial + Main
        this.trials = [...tutorialTrials, ...mainTrials];

        this.currentTrialIndex = 0;
        this.totalMoney = 0;
    }

    createHeader() {
        // UI Removed as requested
    }

    createBalloonArea() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Container for balloon to handle scaling/shaking
        // Center of screen essentially
        this.balloonContainer = this.add.container(width / 2, height / 2 - 50);

        // Sprite will be set in startTrial
        this.balloonSprite = this.add.image(0, 0, 'balloon-blue').setOrigin(0.5, 1); // Origin at bottom knot
        this.balloonContainer.add(this.balloonSprite);

        // Start scale
        this.balloonSprite.setScale(0.3);
    }

    createStatsPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // We will use the icon assets to build the stats UI
        // Icons: icon-pot (Potential), icon-safe (Total), icon-count (Remaining)
        // User requested thinner and white font
        const numberStyle = { font: '48px Calibri', color: '#ffffff' };

        // 1. Potential (Left)
        // Position: Bottom Left area
        const statsY = height - 150; // Lower them a bit
        // Spacing: width is 1920. Center is 960. 
        // Let's spread them: Potential (Left), Total (Center), Count (Right)
        // But Buttons are also there.
        // Previous design: Stats were at height - 300. Buttons at height - 100.
        // Let's revert to height - 300 for Stats to be above buttons.
        const statsY_Upper = height - 300;

        const spacing = 450;

        const createStatGroup = (x, iconKey, initialVal) => {
            const container = this.add.container(x, statsY_Upper);

            const icon = this.add.image(0, 0, iconKey).setOrigin(0.5);
            container.add(icon);

            // Value text centered on the icon (assuming icon is a panel)
            // Or slightly below if it's just an icon. 
            // The assets (e.g. POTANSİYELKAZANÇ) likely include text and a box.
            // Let's place the number in the "box" area.
            // Since I can't see the image, I'll stick to center with a slight Y offset if needed.
            // Based on previous code: container.add([icon, valueText])

            // Value text centered on the icon (assuming icon is a panel)
            const valText = this.add.text(0, 5, initialVal, numberStyle).setOrigin(0.5);
            container.add(valText);

            return { container, valText };
        };

        // Left: Potential
        this.statPotential = createStatGroup(width / 2 - spacing, 'icon-pot', '0');

        // Center: Total Safe Money
        this.statTotal = createStatGroup(width / 2, 'icon-safe', '0');

        // Right: Balloon Count
        // For count, we might want a phase label too
        this.statCount = createStatGroup(width / 2 + spacing, 'icon-count', '');

        // Add Phase Label to count container
        this.phaseLabel = this.add.text(0, -60, '(Test)', { font: 'bold 24px Calibri', color: '#8a7a6a' }).setOrigin(0.5);
        this.statCount.container.add(this.phaseLabel);

        // Store references for updates
        // Use consistent names expected by updateStats or update updateStats to use these directly
        this.cardCurrent = { valueText: this.statPotential.valText };
        this.cardTotal = { container: this.statTotal.container, valueText: this.statTotal.valText };

        // Expose trialText alias for updateStats
        this.trialText = this.statCount.valText;
    }

    createActionButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const btnY = height - 100;

        // Helper
        const createButton = (x, key, callback) => {
            const btn = this.add.image(x, btnY, key).setOrigin(0.5);
            btn.setInteractive({ useHandCursor: true });

            btn.on('pointerover', () => btn.setScale(1.05));
            btn.on('pointerout', () => btn.setScale(1));
            btn.on('pointerdown', () => btn.setScale(0.95));
            btn.on('pointerup', () => {
                btn.setScale(1.05);
                // Ensure audio context is ready on interaction
                if (Tone.context.state !== 'running') {
                    Tone.context.resume();
                }
                callback();
            });
            return btn;
        };

        this.pumpBtn = createButton(width / 2 - 200, 'btn-pump', () => {
            this.pumpBalloon();
        });

        this.collectBtn = createButton(width / 2 + 200, 'btn-collect', () => {
            this.collectMoney();
        });
    }

    startTrial() {
        if (this.currentTrialIndex >= this.trials.length) {
            // Compute Final Stats using stats.js functions (main block only)
            const overallRisk = computeOverallRisk(this.trialLog);
            const efficiency = computeEfficiency(this.trialLog);
            const adaptation = computeAdaptation(this.trialLog);
            const lossSensitivity = computeLossSensitivity(this.trialLog);
            const decisionSpeed = computeDecisionSpeed(this.trialLog);

            window.stats = {
                // Raw values
                overallRisk_raw: overallRisk.raw,
                efficiency_raw: efficiency.raw,
                adaptation_raw: adaptation.raw,
                lossSensitivity_raw: lossSensitivity.raw,
                decisionSpeed_raw: decisionSpeed.raw,

                // Normalized scores (0-100)
                overallRisk_score: overallRisk.score,
                efficiency_score: efficiency.score,
                adaptation_score: adaptation.score,
                lossSensitivity_score: lossSensitivity.score,
                decisionSpeed_score: decisionSpeed.score,

                // Legacy field names for GameOverScene compatibility
                GRA_score: overallRisk.score,
                RV_score: efficiency.score,
                OA_score: adaptation.score,
                KD_score: lossSensitivity.score,
                Speed_score: decisionSpeed.score
            };

            console.log('Game Completed. Stats:', window.stats);

            // End Game
            this.scene.start('GameOverScene', { score: this.totalMoney, stats: window.stats });
            return;
        }

        // Ensure Audio Context is active at start of each trial
        // Force start at critical transition points (tutorial to main, every 10 trials)
        if (Tone.context.state !== 'running' || this.currentTrialIndex === 3 || this.currentTrialIndex % 10 === 0) {
            Tone.start().catch(e => {
                console.warn('Audio context start failed:', e);
            });
            // Small delay to ensure context is ready before proceeding
            this.time.delayedCall(50, () => {
                // Context should be ready now
            });
        }

        // Periodic cleanup of old audio nodes (every 10 trials)
        if (this.currentTrialIndex > 0 && this.currentTrialIndex % 10 === 0) {
            this.cleanupOldAudioNodes();
        }

        // Init timing for this trial
        this.pumpRTs = [];
        this.lastActionTime = Date.now();

        const trialData = this.trials[this.currentTrialIndex];
        const typeKey = trialData.type;
        this.currentTrialBurstPoint = trialData.burstPoint;

        this.currentBalloonConfig = this.balloonTypes[typeKey];

        // Reset state
        this.balloonPumps = 0;

        // Reset money if this is the first real trial (index 3)
        // Indices 0, 1, 2 are tutorial. Index 3 is first real trial.
        if (this.currentTrialIndex === 3) {
            this.totalMoney = 0;
        }

        this.currentMoney = 0;

        // Prevent pumping immediately - wait for appearance
        this.isPumpInProgress = true;

        // Stop any running tweens on sprite to prevent size carry-over
        this.tweens.killTweensOf(this.balloonSprite);
        this.tweens.killTweensOf(this.balloonContainer);

        // Reset Container Position - ensure Y is correct relative to UI
        this.balloonContainer.setPosition(this.cameras.main.width / 2, this.cameras.main.height - 420);

        // Update UI
        // Update UI
        // Start with defined sprite
        this.balloonSprite.setTexture(this.currentBalloonConfig.sprite);

        // Remove tint application
        this.balloonSprite.clearTint();

        // Start very small for pop-in animation
        this.balloonSprite.setScale(0.01);

        this.balloonSprite.setAlpha(1);
        this.balloonSprite.setVisible(true);
        this.balloonSprite.setAngle(0); // Reset angle

        this.updateStats();

        // Pop-in Animation
        this.tweens.add({
            targets: this.balloonSprite,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 400,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Allow pumping only after visual entrance is complete
                this.isPumpInProgress = false;
                this.lastActionTime = Date.now(); // Reset RT timer
            }
        });

        // Enable buttons by default
        this.pumpBtn.setAlpha(1);
        this.collectBtn.setAlpha(1);
    }

    pumpBalloon() {
        if (this.isPumpInProgress) return;

        // Record Reaction Time
        const now = Date.now();
        const rt = now - this.lastActionTime;
        this.pumpRTs.push(rt);
        this.lastActionTime = now;

        this.isPumpInProgress = true;

        // Use the pre-determined burst point
        // If next pump count (current + 1) equals the burst point, POP.
        const nextPumpCount = this.balloonPumps + 1;
        const willPop = nextPumpCount >= this.currentTrialBurstPoint;

        // Also check max pumps config just in case
        const max = this.currentBalloonConfig.maxPumps;
        if (this.balloonPumps >= max) {
            this.popBalloon();
            return;
        }

        // Texture State Management - Removed as we use single sprite now
        // But we could change sprites if we had multiple states (deflated, full etc)
        // For now, we rely on scaling physics.

        // "Realistic" Growth:
        const currentScale = this.balloonSprite.scaleX;
        // Growth is faster when small, slower when big
        const growthStep = 0.02 / Math.max(0.2, currentScale);

        // Capped at 1.3 to ensure it fits on screen without hitting top or bottom UI
        const targetScale = Math.min(1.3, currentScale + growthStep);

        // Animate Pump: "Rubber" feel with Back ease
        this.tweens.add({
            targets: this.balloonSprite,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 300, // Slightly longer for more "juice"
            ease: 'Elastic.easeOut', // More bounce!
            easeParams: [1.5, 0.5],
            onComplete: () => {
                if (willPop) {
                    this.popBalloon();
                } else {
                    this.balloonPumps++;
                    this.currentMoney += this.currentBalloonConfig.valuePerPump;
                    this.updateStats();
                    this.isPumpInProgress = false;
                }
            }
        });

        // Secondary "Squash" before expansion - creates anticipation
        this.tweens.add({
            targets: this.balloonSprite,
            scaleX: currentScale * 1.1, // Widen
            scaleY: currentScale * 0.9, // Flatten
            duration: 50,
            yoyo: true,
            repeat: 0,
            onComplete: () => {
                // This triggers the main expansion visually nicely
            }
        });

        // Secondary "Jiggle" to make it feel like a fluid/gas container
        this.tweens.add({
            targets: this.balloonSprite,
            angle: { from: -3, to: 3 }, // More shake
            duration: 80,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut'
        });

        // Shake container less mechanically
        this.tweens.add({
            targets: this.balloonContainer,
            y: this.balloonContainer.y + 4, // More vertical thud
            duration: 60,
            yoyo: true
        });

        // Play inflate sound
        try {
            // Ensure audio context is ready - use start() not resume()
            if (Tone.context.state !== 'running') {
                Tone.start().catch(e => {
                    console.warn('Pump audio context start failed:', e);
                });
            }

            // Only play sound if context is running
            if (Tone.context.state === 'running') {
                // "Pshhh" sound for air pumping
                const filter = this.trackAudioNode(new Tone.Filter(1000, "lowpass").toDestination(), 250);
                const noise = this.trackAudioNode(new Tone.Noise("white").connect(filter), 250);

                noise.volume.value = -10;

                // Envelope for the "whoosh"
                const now = Tone.now();
                noise.start(now);
                filter.frequency.setValueAtTime(800, now);
                filter.frequency.rampTo(2000, 0.1); // Open up filter

                // Stop after 200ms
                noise.stop(now + 0.1);
            }
        } catch (e) {
            console.warn('Pump audio error:', e);
        }

        // Floating Text Effect
        const floatText = this.add.text(
            this.balloonContainer.x + (Math.random() * 60 - 30),
            this.balloonContainer.y - (this.balloonSprite.displayHeight * targetScale) / 2,
            `+${this.currentBalloonConfig.valuePerPump}`,
            {
                font: '40px Calibri',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: floatText,
            y: floatText.y - 100,
            alpha: 0,
            duration: 800,
            ease: 'Back.easeOut',
            onComplete: () => floatText.destroy()
        });
    }

    collectMoney() {
        if (this.isPumpInProgress || this.currentMoney === 0) return;

        // Ensure audio context is ready on interaction - use start() not resume()
        if (Tone.context.state !== 'running') {
            Tone.start().catch(e => {
                console.warn('Collect audio context start failed:', e);
            });
        }

        // Add to bank
        this.totalMoney += this.currentMoney;

        // Log Success
        this.logTrial(false);

        // Play Cash Register Sound
        try {
            // Ensure audio context is ready - use start() not resume()
            if (Tone.context.state !== 'running') {
                Tone.start().catch(e => {
                    console.warn('Collect audio context start failed:', e);
                });
            }

            // Only play sound if context is running
            if (Tone.context.state === 'running') {
                // A sequence of sounds to mimic "Ka-Ching"
                const synth = this.trackAudioNode(new Tone.PolySynth(Tone.Synth).toDestination(), 400);
                synth.set({
                    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
                    volume: -10
                });

                // "Ka" (Mechanical/Noise-like)
                // "Ching" (High Bell)
                const now = Tone.now();
                synth.triggerAttackRelease(["C6", "E6"], "16n", now);
                synth.triggerAttackRelease(["G6", "B6"], "8n", now + 0.1);

                // Add a metallic hit
                const metal = this.trackAudioNode(new Tone.MetalSynth({
                    frequency: 200,
                    envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
                    harmonicity: 5.1,
                    modulationIndex: 32,
                    resonance: 4000,
                    octaves: 1.5
                }).toDestination(), 400);
                metal.volume.value = -15;
                metal.triggerAttackRelease("32n", now + 0.1);
            }
        } catch (e) {
            console.warn('Collect audio error:', e);
        }

        // Animation for collecting
        this.tweens.add({
            targets: this.cardTotal.container,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 100,
            yoyo: true
        });

        this.endTrial();
    }

    popBalloon() {
        // Log Explosion
        this.logTrial(true);

        // Visual Pop
        this.balloonSprite.setVisible(false);

        // Ensure audio context is running - use start() not resume()
        if (Tone.context.state !== 'running') {
            Tone.start().catch(e => {
                console.warn('Pop audio context start failed:', e);
            });
        }

        // Play explosion sound via Tone.js
        try {
            // Ensure audio context is ready - use start() not resume()
            if (Tone.context.state !== 'running') {
                Tone.start().catch(e => {
                    console.warn('Pop audio context start failed:', e);
                });
            }

            // Only play sound if context is running
            if (Tone.context.state === 'running') {
                // Louder explosion
                const filter = this.trackAudioNode(new Tone.Filter(3000, "lowpass").toDestination(), 1500);
                const noise = this.trackAudioNode(new Tone.Noise("brown").connect(filter), 1500);

                noise.volume.value = 0; // Max without clipping usually

                const now = Tone.now();
                noise.start(now);
                noise.volume.rampTo(-Infinity, 1.2); // Longer decay
                filter.frequency.rampTo(100, 1.0);

                // Stop after 1.2 seconds
                noise.stop(now + 1.2);
            }
        } catch (e) {
            console.warn('Explosion audio error:', e);
        }

        // Camera Flash
        this.cameras.main.flash(100, 255, 255, 255);

        // Particles - Shards
        const particles = this.add.particles(0, 0, 'shard', {
            // Fix: Position particles at balloon center (Container Y - ScaledHalfHeight)
            x: this.balloonContainer.x,
            y: this.balloonContainer.y - (this.balloonSprite.displayHeight / 2),
            tint: this.currentBalloonConfig.color,
            speed: { min: 200, max: 800 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            rotate: { start: 0, end: 360 }, // Spin the shards
            lifespan: { min: 500, max: 1000 },
            gravityY: 800,
            quantity: 40,
            emitting: false
        });

        particles.explode();

        this.time.delayedCall(1000, () => {
            particles.destroy();
        });

        // Reset current money
        this.currentMoney = 0;
        this.updateStats();

        this.time.delayedCall(1500, () => {
            this.endTrial();
        });
    }

    endTrial() {
        this.isPumpInProgress = true; // Block input during transition
        this.currentTrialIndex++;

        // Ensure audio context stays active between trials
        // Especially important at transition points
        if (Tone.context.state !== 'running') {
            Tone.start().catch(e => {
                console.warn('Audio context start failed in endTrial:', e);
            });
        } else {
            // Even if running, ensure it's truly active
            // Sometimes context shows as running but isn't actually producing sound
            try {
                // Test context by trying to access it
                const testNode = new Tone.Oscillator().toDestination();
                testNode.start();
                testNode.stop();
                testNode.dispose();
            } catch (e) {
                // Context might be broken, restart it
                console.warn('Audio context test failed, restarting:', e);
                Tone.start().catch(err => {
                    console.warn('Audio context restart failed:', err);
                });
            }
        }

        // Wait for visual transition before starting next trial logic
        this.time.delayedCall(500, () => {
            this.startTrial();
        });
    }

    // Cleanup old audio nodes that should have finished
    cleanupOldAudioNodes() {
        if (!this.audioNodes || this.audioNodes.length === 0) return;

        const now = Date.now();
        // Keep only recent nodes, remove nodes that are likely finished
        const activeNodes = this.audioNodes.filter(node => {
            try {
                // If node has a state property and it's still active, keep it
                if (node.state && node.state !== 'stopped') {
                    return true;
                }
                // Otherwise check if it has volume and is connected
                if (node.volume && node.context && node.context.state === 'running') {
                    return true;
                }
                // If we can't determine, assume it's done and dispose
                return false;
            } catch (e) {
                // If checking state throws error, node is likely disposed
                return false;
            }
        });

        // Dispose nodes that are being removed
        this.audioNodes.forEach(node => {
            if (activeNodes.indexOf(node) === -1) {
                try {
                    if (node.disconnect) node.disconnect();
                    if (node.dispose) node.dispose();
                } catch (e) {
                    // Already disposed
                }
            }
        });

        this.audioNodes = activeNodes;

        // If we still have too many nodes, force cleanup
        if (this.audioNodes.length > 20) {
            console.warn(`Too many audio nodes (${this.audioNodes.length}), forcing cleanup`);
            this.audioNodes.slice(0, 10).forEach(node => {
                try {
                    if (node.disconnect) node.disconnect();
                    if (node.dispose) node.dispose();
                } catch (e) { }
            });
            this.audioNodes = this.audioNodes.slice(10);
        }
    }

    logTrial(exploded) {
        // Calculate Average Pump RT
        const sumRT = this.pumpRTs.reduce((a, b) => a + b, 0);
        const averagePumpRT = this.pumpRTs.length > 0 ? Math.round(sumRT / this.pumpRTs.length) : 0;

        const isTutorial = this.currentTrialIndex < 3;
        const blockName = isTutorial ? 'tutorial' : 'main';
        // balloonCount: 1-3 for tutorial, 1-60 for main
        const balloonCount = isTutorial ? (this.currentTrialIndex + 1) : (this.currentTrialIndex - 3 + 1);

        // Determine balloonColor (logical type: "low" | "medium" | "high")
        const typeKey = this.trials[this.currentTrialIndex].type;
        let balloonColor = 'medium'; // Default for training
        if (typeKey === 'high') balloonColor = 'high';
        else if (typeKey === 'medium') balloonColor = 'medium';
        else if (typeKey === 'low') balloonColor = 'low';

        const timesPumped = this.balloonPumps;
        const explosion = exploded ? 1 : 0;
        const earningsThisBalloon = exploded ? 0 : this.currentMoney;

        // totalEarningsSoFar: running total (main block only)
        const totalEarningsSoFar = isTutorial ? null : this.totalMoney;

        // totalAdjustedBartScoreSoFar: mean pumps on non-exploded balloons in main block so far (including current trial)
        let totalAdjustedBartScoreSoFar = null;
        if (!isTutorial) {
            const mainTrialsSoFar = this.trialLog.filter(t => t.blockName === 'main');
            const nonExplodedPumps = mainTrialsSoFar
                .filter(t => t.explosion === 0)
                .map(t => t.timesPumped);

            // Include current trial if it didn't explode
            if (!exploded) {
                nonExplodedPumps.push(timesPumped);
            }

            if (nonExplodedPumps.length > 0) {
                const sumPumps = nonExplodedPumps.reduce((sum, p) => sum + p, 0);
                totalAdjustedBartScoreSoFar = sumPumps / nonExplodedPumps.length;
            } else {
                totalAdjustedBartScoreSoFar = 0;
            }
        }

        const logEntry = {
            blockName: blockName,
            balloonColor: balloonColor,
            balloonCount: balloonCount,
            timesPumped: timesPumped,
            explosion: explosion,
            earningsThisBalloon: earningsThisBalloon,
            totalEarningsSoFar: totalEarningsSoFar,
            totalAdjustedBartScoreSoFar: totalAdjustedBartScoreSoFar,
            averagePumpRT: averagePumpRT
        };

        this.trialLog.push(logEntry);
        console.log('Trial Logged:', logEntry);
    }

    updateStats() {
        if (!this.cardCurrent || !this.cardTotal || !this.trialText) return;

        this.cardCurrent.valueText.setText(this.currentMoney.toString());
        this.cardTotal.valueText.setText(this.totalMoney.toString());

        // Trial Text Logic:
        // Update to show REMAINING balloons (Countdown)
        let countString = '';
        if (this.currentTrialIndex < 3) {
            // Tutorial: 3 total. Index 0 -> 3 left.
            countString = `${3 - this.currentTrialIndex}`;
            if (this.phaseLabel) this.phaseLabel.setText('(Deneme)');
        } else {
            // Main: 60 total. Index 3 -> 60 left.
            countString = `${60 - (this.currentTrialIndex - 3)}`;
            if (this.phaseLabel) this.phaseLabel.setText('(Test)');
        }

        this.trialText.setText(countString);

        // Animation for total money change (simple scale bump already in collectMoney)
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        this.cameras.main.setViewport(0, 0, width, height);

        const cx = width / 2;

        // Background: Cover Logic
        if (this.bg) {
            const scaleX = width / this.bg.width;
            const scaleY = height / this.bg.height;
            const scale = Math.max(scaleX, scaleY);
            this.bg.setScale(scale).setPosition(cx, height / 2).setOrigin(0.5);
        }

        // Header and Footer: Stretch to width
        let headerBottom = 0;
        let footerTop = height;

        if (this.header) {
            this.header.setPosition(cx, 0); // Top
            this.header.displayWidth = width; // Stretch to full width
            headerBottom = this.header.displayHeight;
        }

        if (this.footer) {
            this.footer.setPosition(cx, height); // Bottom
            this.footer.displayWidth = width; // Stretch to full width
            footerTop = height - this.footer.displayHeight;
        }

        // Layout Areas
        const safeAreaTop = headerBottom + 20;
        const safeAreaBottom = footerTop - 20;
        const safeAreaHeight = safeAreaBottom - safeAreaTop;

        // Layout Strategy:
        // Balloon: Top (Remaining space)
        // Buttons: Middle/Lower
        // Stats: Bottom

        const isSmallScreen = width < 600;

        // 1. Stats (Bottom)
        // Move stats to the bottom area
        const statsCHeight = isSmallScreen ? 80 : 120;
        const statsY = safeAreaBottom - (statsCHeight / 2);

        // 2. Buttons (Above Stats)
        const btnSpacingY = 30; // Gap between Stats and Buttons
        const btnHeight = isSmallScreen ? 80 : 120;
        const btnY = statsY - (statsCHeight / 2) - btnSpacingY - (btnHeight / 2);

        // Update Stats Positions
        if (this.statPotential && this.statPotential.container) {
            // Responsive spacing based on width
            const statSpacing = Math.min(width * 0.28, 350);

            this.statPotential.container.setPosition(cx - statSpacing, statsY);
            this.statTotal.container.setPosition(cx, statsY);
            this.statCount.container.setPosition(cx + statSpacing, statsY);

            // Scale down stats if very narrow
            const statScale = width < 400 ? 0.65 : (width < 600 ? 0.8 : 1);

            // Adjust hit areas or container size if needed, but scaling the container is easiest
            [this.statPotential.container, this.statTotal.container, this.statCount.container].forEach(c => {
                c.setScale(statScale);
            });
        }

        // Update Buttons Positions
        const btnSpacingX = isSmallScreen ? 160 : 350;

        if (this.pumpBtn) {
            this.pumpBtn.setPosition(cx - btnSpacingX / 2, btnY);
            if (isSmallScreen) this.pumpBtn.setScale(0.75); // Slightly smaller on mobile
            else this.pumpBtn.setScale(1);
        }
        if (this.collectBtn) {
            this.collectBtn.setPosition(cx + btnSpacingX / 2, btnY);
            if (isSmallScreen) this.collectBtn.setScale(0.75);
            else this.collectBtn.setScale(1);
        }

        // 3. Balloon - Centered in remaining space above Buttons
        // Remaining space top: safeAreaTop
        // Remaining space bottom: Top of Button area
        const balloonSpaceBottom = btnY - (btnHeight / 2) - 30; // 30px padding
        const balloonAvailableH = balloonSpaceBottom - safeAreaTop;

        let balloonCy = safeAreaTop + balloonAvailableH / 2;
        // Ensure it doesn't get pushed too far up if space is tight
        balloonCy = Math.max(balloonCy, safeAreaTop + 50);

        if (this.balloonContainer) {
            this.balloonContainer.setPosition(cx, balloonCy);

            // Auto-scale balloon
            // Max height allowed
            const maxBalloonH = Math.max(balloonAvailableH * 0.8, 200);
            const baseSpriteHeight = 900;

            // Calculate required scale
            const safeBaseScale = (maxBalloonH / 1.3) / baseSpriteHeight;

            const finalScale = Math.min(0.4, Math.max(0.15, safeBaseScale));

            this.balloonContainer.setScale(finalScale);
        }
    }
}