import Phaser from 'phaser';
import * as Tone from 'tone';
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
            'training': { color: 0x4CAF50, maxPumps: 32, valuePerPump: 1, sprite: 'balloon-white', name: 'Training' },
            'low': { color: 0x008080, maxPumps: 128, valuePerPump: 5, sprite: 'balloon-white', name: 'Low Risk' }, 
            'medium': { color: 0xFFBF00, maxPumps: 32, valuePerPump: 15, sprite: 'balloon-white', name: 'Medium Risk' },
            'high': { color: 0xFF4081, maxPumps: 8, valuePerPump: 50, sprite: 'balloon-white', name: 'High Risk' }
        };
        
        // Data Logging
        this.trialLog = [];
    }

    create() {
        // Expose log globally for easy access
        window.trialLog = this.trialLog;
        
        // Ensure Audio Context is running on any input
        this.input.on('pointerdown', async () => {
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
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
        const bg = this.add.image(0, 0, 'background-paper').setOrigin(0, 0);
        bg.displayWidth = this.cameras.main.width;
        bg.displayHeight = this.cameras.main.height;

        // Initialize Trials
        this.initTrials();

        // Create UI
        this.createHeader();
        
        this.createBalloonArea();
        this.createStatsPanel();
        this.createActionButtons();

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
        // Trials 1-20: low-risk (blue-type, mean ≈ 64 pumps)
        // Trials 21-40: medium-risk (yellow-type, mean ≈ 16 pumps)
        // Trials 41-60: high-risk (red-type, mean ≈ 4 pumps)
        // Exact sequence is fixed and identical for all participants per DESIGN_NOTES.md
        const mainTypes = [
            ...Array(20).fill('low'),      // Trials 1-20
            ...Array(20).fill('medium'),   // Trials 21-40
            ...Array(20).fill('high')      // Trials 41-60
        ];
        
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
        // Position lower to allow room for growth (origin is bottom)
        // Buttons are at height - 100. Stats at height - 300.
        // Stats box top is at height - 300 - 90 = height - 390.
        // We place balloon knot at height - 420 to give 30px gap.
        this.balloonContainer = this.add.container(width/2, height - 420);
        
        // Sprite with white texture to be tinted
        this.balloonSprite = this.add.image(0, 0, 'balloon-white').setOrigin(0.5, 1); // Origin at bottom knot
        this.balloonContainer.add(this.balloonSprite);
        
        // Start scale
        this.balloonSprite.setScale(0.4);
    }

    createStatsPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const panelY = height - 300;
        
        const cardStyle = { font: 'bold 32px Calibri', color: '#5a4a3a' };
        const labelStyle = { font: 'bold 24px Calibri', color: '#8a7a6a' };
        const numberStyle = { font: 'bold 48px Calibri', color: '#5a4a3a' };
        
        // Helper to make card
        const createCard = (x, titleLines, iconKey, initialValue, isValueMoney) => {
            const card = this.add.container(x, panelY);
            const bg = this.add.graphics();
            bg.fillStyle(0xfffdf5, 1);
            bg.lineStyle(2, 0xd0c0a0, 1);
            bg.fillRoundedRect(-180, -90, 360, 180, 20);
            bg.strokeRoundedRect(-180, -90, 360, 180, 20);
            card.add(bg);

            // Title
            let yOffset = -50;
            titleLines.forEach(line => {
                const text = this.add.text(0, yOffset, line, labelStyle).setOrigin(0.5);
                card.add(text);
                yOffset += 30;
            });

            // Value + Icon Container
            const valueContainer = this.add.container(0, 40);
            const icon = this.add.image(-40, 0, iconKey).setScale(0.2); // Adjust scale based on actual asset
            // Limit icon size
            if(icon.displayHeight > 60) icon.setDisplaySize(60, 60); // approximate aspect ratio
            
            const valueText = this.add.text(20, 0, initialValue, numberStyle).setOrigin(0, 0.5);
            
            valueContainer.add([icon, valueText]);
            // Center the value container
            const totalW = 60 + valueText.width;
            valueContainer.x = -totalW/2 + 30; // approx centering
            
            card.add(valueContainer);
            
            return { container: card, valueText: valueText, valueContainer: valueContainer };
        };

        const spacing = 420;
        this.cardCurrent = createCard(width/2 - spacing, ['Bu balonun', 'potansiyel kazancı'], 'icon-coin', '0', true);
        this.cardTotal = createCard(width/2, ['Şimdiye kadar', 'toplanan para'], 'icon-coins-stack', '0', true);
        
        // Balloon count card slightly different
        const cardCount = this.add.container(width/2 + spacing, panelY);
        const bg = this.add.graphics();
        bg.fillStyle(0xfffdf5, 1);
        bg.lineStyle(2, 0xd0c0a0, 1);
        bg.fillRoundedRect(-180, -90, 360, 180, 20);
        bg.strokeRoundedRect(-180, -90, 360, 180, 20);
        cardCount.add(bg);
        const lbl = this.add.text(0, -55, 'Kalan balon sayısı', labelStyle).setOrigin(0.5);
        this.phaseLabel = this.add.text(0, -25, '(Deneme)', { font: 'bold 24px Calibri', color: '#8a7a6a' }).setOrigin(0.5);
        
        // Update initial text to reflect new trial count
        this.trialText = this.add.text(0, 35, '', numberStyle).setOrigin(0.5, 0.5);
        
        cardCount.add([lbl, this.phaseLabel, this.trialText]);
        this.cardCount = { container: cardCount, text: this.trialText };
    }

    createActionButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const btnY = height - 100;
        
        // Helper
        const createButton = (x, color, strokeColor, text, callback) => {
            const btn = this.add.container(x, btnY);
            
            // Background
            const bg = this.add.graphics();
            bg.fillStyle(color, 1);
            bg.lineStyle(4, strokeColor, 1);
            bg.fillRoundedRect(-200, -50, 400, 100, 25);
            bg.strokeRoundedRect(-200, -50, 400, 100, 25);
            
            // Highlight
            const highlight = this.add.graphics();
            highlight.lineStyle(4, 0xffffff, 0.3);
            highlight.strokeRoundedRect(-196, -46, 392, 92, 20);
            
            // Text
            const txt = this.add.text(0, 0, text, {
                font: 'bold 40px Calibri',
                color: '#5a4a3a',
                shadow: { offsetX: 1, offsetY: 1, color: '#fff', blur: 0, fill: true }
            }).setOrigin(0.5);
            
            btn.add([bg, highlight, txt]);
            
            // Use a Zone for interaction - clearer hit area handling
            const hitZone = this.add.zone(0, 0, 400, 100);
            btn.add(hitZone);
            
            hitZone.setInteractive({ useHandCursor: true });
            
            hitZone.on('pointerover', () => {
                btn.setScale(1.05);
            });

            hitZone.on('pointerout', () => {
                btn.setScale(1);
            });

            hitZone.on('pointerdown', () => {
                btn.setScale(0.95); // Press effect via scale instead of Y
            });
            
            hitZone.on('pointerup', () => {
                btn.setScale(1.05); // Return to hover scale
                console.log('Button clicked:', text);
                // Ensure audio context is ready on interaction
                if (Tone.context.state !== 'running') {
                    Tone.context.resume();
                }
                callback();
            });
            
            return btn;
        };

        // Yellow: 0xffe066 (Reference-ish), Green: 0x88cc66
        this.pumpBtn = createButton(width/2 - 220, 0xffd54f, 0xcca000, 'Şişir', () => {
            console.log('Pump action triggered');
            this.pumpBalloon();
        });
        this.collectBtn = createButton(width/2 + 220, 0x81c784, 0x519657, 'Kasaya Gönder $$', () => {
            console.log('Collect action triggered');
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
        this.balloonContainer.setPosition(this.cameras.main.width/2, this.cameras.main.height - 420);

        // Update UI
        // Start with deflated balloon
        this.balloonSprite.setTexture('balloon-deflated');
        this.balloonSprite.setTint(this.currentBalloonConfig.color); // Apply specific color
        
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

        // Texture State Management
        // 0 -> Deflated (Initial)
        // 1-3 -> Semi
        // 4+ -> Full
        if (nextPumpCount === 1) {
            this.balloonSprite.setTexture('balloon-semi');
        } else if (nextPumpCount === 4) {
            this.balloonSprite.setTexture('balloon-full');
        }

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
            // "Pshhh" sound for air pumping
            const noise = new Tone.Noise("white").toDestination();
            const filter = new Tone.Filter(1000, "lowpass").toDestination();
            
            noise.connect(filter);
            noise.volume.value = -10;
            
            // Envelope for the "whoosh"
            noise.start();
            filter.frequency.setValueAtTime(800, Tone.now());
            filter.frequency.rampTo(2000, 0.1); // Open up filter
            
            noise.stop("+0.2"); // Short burst
            
            // Cleanup
            setTimeout(() => {
                noise.dispose();
                filter.dispose();
            }, 300);
        } catch(e) {}

        // Floating Text Effect
        const floatText = this.add.text(
            this.balloonContainer.x + (Math.random() * 60 - 30), 
            this.balloonContainer.y - (this.balloonSprite.displayHeight * targetScale) / 2, 
            `+$${this.currentBalloonConfig.valuePerPump}`, 
            {
                font: 'bold 40px Calibri',
                color: '#5a4a3a',
                stroke: '#ffffff',
                strokeThickness: 4
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
        
        // Ensure audio context is ready on interaction
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }
        
        // Add to bank
        this.totalMoney += this.currentMoney;
        
        // Log Success
        this.logTrial(false);
        
        // Play Cash Register Sound
        try {
            // A sequence of sounds to mimic "Ka-Ching"
            const synth = new Tone.PolySynth(Tone.Synth).toDestination();
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
            const metal = new Tone.MetalSynth({
                frequency: 200,
                envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
                harmonicity: 5.1,
                modulationIndex: 32,
                resonance: 4000,
                octaves: 1.5
            }).toDestination();
            metal.volume.value = -15;
            metal.triggerAttackRelease("32n", now + 0.1);
            
        } catch(e) {
            console.error('Audio play error', e);
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
        
        // Ensure audio context is running
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }

        // Play explosion sound via Tone.js
        try {
            // Louder explosion
            const noise = new Tone.Noise("brown").toDestination();
            noise.volume.value = 0; // Increased from -10 to 0 (max without clipping usually)
            
            const filter = new Tone.Filter(3000, "lowpass").toDestination();
            noise.connect(filter);
            
            noise.start();
            noise.volume.rampTo(-Infinity, 1.2); // Longer decay
            filter.frequency.rampTo(100, 1.0); 
            
            setTimeout(() => {
                noise.stop();
                noise.dispose();
                filter.dispose();
            }, 1500);
        } catch(e) {
            console.error('Audio play error', e);
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
        
        // Wait for visual transition before starting next trial logic
        this.time.delayedCall(500, () => {
            this.startTrial();
        });
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
        this.cardCurrent.valueText.setText(this.currentMoney.toString());
        this.cardTotal.valueText.setText(this.totalMoney.toString());
        
        // Trial Text Logic:
        // Update to show REMAINING balloons (Countdown)
        let countString = '';
        if (this.currentTrialIndex < 3) {
            // Tutorial: 3 total. Index 0 -> 3 left.
            countString = `${3 - this.currentTrialIndex}`;
            this.phaseLabel.setText('(Deneme)');
        } else {
            // Main: 60 total. Index 3 -> 60 left.
            countString = `${60 - (this.currentTrialIndex - 3)}`;
            this.phaseLabel.setText('(Test)');
        }
        
        this.trialText.setText(countString);
        
        // Center values again
        const centerValue = (cardObj) => {
            const valW = cardObj.valueText.width;
            const container = cardObj.valueContainer;
            // Total width of icon (60) + padding (20) + text (valW)
            const totalW = 80 + valW;
            // We want to center this block in the parent card (which is at 0,0 locally)
            // But valueContainer is at (0, 40).
            // Inside valueContainer: Icon at -40. Text at 20.
            // Visually: [Icon] [Text]
            // We shift the whole container X so that the visual center aligns with 0.
            // Visual center is at (-40 + (totalW/2)) relative to container origin?
            // Let's simpler: Set container.x such that the visual midpoint is at 0.
            // Visual Left = -70 (icon left edge approx), Visual Right = 20 + valW.
            // Midpoint = (-70 + 20 + valW) / 2 = (valW - 50) / 2.
            // We want container.x + Midpoint = 0  => container.x = -(valW - 50) / 2
            
            container.x = -(valW - 50) / 2;
        };
        
        centerValue(this.cardCurrent);
        centerValue(this.cardTotal);
    }
}