import Phaser from 'https://esm.sh/phaser@3.70.0';
import * as Tone from 'https://esm.sh/tone@14.7.77';

export class StartScene extends Phaser.Scene {
    constructor() {
        super('StartScene');
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Background
        this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);

        // Tutorial Panel
        this.panel = this.add.image(0, 0, 'tutorial-panel').setOrigin(0.5);

        // Start Button
        this.startBtn = this.add.image(0, 0, 'btn-start').setOrigin(0.5);
        this.startBtn.setInteractive({ useHandCursor: true });

        // Hover effects
        this.startBtn.on('pointerover', () => this.startBtn.setScale(1.05));
        this.startBtn.on('pointerout', () => this.startBtn.setScale(1));
        this.startBtn.on('pointerdown', () => this.startBtn.setScale(0.95));

        this.startBtn.on('pointerup', async () => {
            this.startBtn.setScale(1.05);

            // Initial Audio Context Start
            if (Tone.context.state !== 'running') {
                try {
                    await Tone.start();
                } catch (e) {
                    console.warn('Tone.start failed, proceeding anyway:', e);
                }
            }

            this.scene.start('GameScene');
        });

        // Resize handler
        this.scale.on('resize', this.resize, this);
        this.resize({ width, height });

        // Entrance Animation
        this.panel.setAlpha(0);
        const originalPanelY = this.panel.y; // Capture target Y
        this.panel.y += 50;

        this.startBtn.setAlpha(0);
        const originalBtnY = this.startBtn.y; // Capture target Y
        this.startBtn.y += 50;

        this.tweens.add({
            targets: this.panel,
            alpha: 1,
            y: originalPanelY,
            duration: 800,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: this.startBtn,
            alpha: 1,
            y: originalBtnY,
            delay: 300,
            duration: 800,
            ease: 'Back.easeOut'
        });
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        this.cameras.main.setViewport(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;

        // Background: Cover Logic
        if (this.bg) {
            const scaleX = width / this.bg.width;
            const scaleY = height / this.bg.height;
            const scale = Math.max(scaleX, scaleY);
            this.bg.setScale(scale).setPosition(cx, cy).setOrigin(0.5);
        }

        if (this.panel) {
            this.panel.setPosition(cx, cy);

            // Responsive Panel Scaling
            // Try to fit within 90% width and 70% height
            // But don't scale UP beyond 1.0 (pixel art/crispness check)
            const padding = 40;
            const availableW = Math.max(width - padding * 2, 300);
            const availableH = Math.max(height * 0.7, 300);

            const scaleW = availableW / this.panel.width;
            const scaleH = availableH / this.panel.height;

            // Use the smaller scale to fit both dimensions
            const finalScale = Math.min(scaleW, scaleH, 1);

            this.panel.setScale(finalScale);
        }

        if (this.startBtn) {
            // Position relative to panel or bottom
            // Ideally below panel, but if screen is short, stick to bottom
            const panelBottom = this.panel ? (this.panel.y + (this.panel.height * this.panel.scaleY) / 2) : cy;
            const targetY = Math.max(panelBottom + 80, height - 100);

            this.startBtn.setPosition(cx, targetY);

            // Also scale button if screen is very narrow
            if (width < 400) {
                this.startBtn.setScale(0.8);
            } else {
                this.startBtn.setScale(1);
            }
        }
    }
}
