import Phaser from 'https://esm.sh/phaser@3.70.0';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // LOCAL ASSETS (GitHub / static server için)
        // NEW ASSETS
        this.load.image('bg', 'assets/bg.png');
        this.load.image('balloon-blue', 'assets/balloon-blue.png');
        this.load.image('balloon-yellow', 'assets/balloon-yellow.png');
        this.load.image('balloon-red', 'assets/balloon-red.png');
        this.load.image('balloon-green', 'assets/balloon-green.png');

        this.load.image('btn-pump', 'assets/btn-pump.png');
        this.load.image('btn-collect', 'assets/btn-collect.png');
        this.load.image('btn-start', 'assets/btn-start.png');

        this.load.image('tutorial-panel', 'assets/tutorial-panel.png');
        this.load.image('ui-header', 'assets/ui-header.png');
        this.load.image('ui-footer', 'assets/ui-footer.png');

        this.load.image('icon-safe', 'assets/icon-safe.png');
        this.load.image('icon-pot', 'assets/icon-pot.png');
        this.load.image('icon-count', 'assets/icon-count.png');

        // Legacy support if needed (or remove if fully replaced)
        // this.load.image('background-paper',   'assets/background-paper.webp');
        this.load.image('balloon-white', 'assets/balloon-glossy.webp'); // Keep for shard particles if needed
        // this.load.image('balloon-deflated',   'assets/balloon-deflated.webp');
        // this.load.image('balloon-semi',       'assets/balloon-semi.webp');
        // this.load.image('balloon-full',       'assets/balloon-full.webp');


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