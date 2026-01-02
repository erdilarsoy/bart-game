import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // LOCAL ASSETS (GitHub / static server için)
        this.load.image('background-paper',   'assets/background-paper.webp');
        this.load.image('balloon-white',      'assets/balloon-glossy.webp');
        this.load.image('balloon-deflated',   'assets/balloon-deflated.webp');
        this.load.image('balloon-semi',       'assets/balloon-semi.webp');
        this.load.image('balloon-full',       'assets/balloon-full.webp');
        this.load.image('icon-coin',          'assets/icon-coin.webp');
        this.load.image('icon-coins-stack',   'assets/icon-coins-stack.webp');
        this.load.image('icon-medal',         'assets/icon-medal.webp');
        this.load.image('icon-flower',        'assets/icon-flower.webp');

        // ------------------------------
        // Loading bar UI
        // ------------------------------
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 320, height / 2 - 50, 640, 50);

        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 100,
            text: 'Loading...',
            style: {
                font: 'bold 30px Calibri',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(
                width / 2 - 310,
                height / 2 - 40,
                620 * value,
                30
            );
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            this.scene.start('StartScene');
        });
    }
}