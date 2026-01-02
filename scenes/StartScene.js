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
        const bg = this.add.image(0, 0, 'background-paper').setOrigin(0, 0);
        bg.displayWidth = width;
        bg.displayHeight = height;

        // Container for content
        const content = this.add.container(width / 2, height / 2);

        // Title
        const title = this.add.text(0, -350, 'Nasıl Oynanır?', {
            font: 'bold 80px Calibri',
            color: '#5a4a3a'
        }).setOrigin(0.5);

        // Instructions Panel
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0xffffff, 0.9);
        panelBg.lineStyle(4, 0xd0c0a0, 1);
        panelBg.fillRoundedRect(-500, -250, 1000, 550, 30);
        panelBg.strokeRoundedRect(-500, -250, 1000, 550, 30);
        
        content.add([panelBg, title]);

        const instructions = [
            "• Her turda karşınıza bir balon gelecek.",
            "• 'Şişir' butonuna basarak balonu şişirin ve para kazanın.",
            "• DİKKAT: Balon her an patlayabilir!",
            "• Balon patlarsa o turdaki tüm kazancınızı kaybedersiniz.",
            "• Patlamadan önce 'Kasaya Gönder' diyerek paranızı kurtarın.",
            "• Amaç: Riskleri yöneterek en çok parayı toplamak."
        ];

        let startY = -200;
        instructions.forEach(line => {
            const text = this.add.text(-450, startY, line, {
                font: 'bold 36px Calibri',
                color: '#5a4a3a',
                wordWrap: { width: 900 }
            }).setOrigin(0, 0);
            content.add(text);
            startY += 80;
        });

        // Start Button
        const btnY = 380;
        const btn = this.add.container(0, btnY);
        
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x81c784, 1); // Green like Collect button
        btnBg.lineStyle(4, 0x519657, 1);
        btnBg.fillRoundedRect(-200, -50, 400, 100, 25);
        btnBg.strokeRoundedRect(-200, -50, 400, 100, 25);
        
        const btnText = this.add.text(0, 0, 'Oyuna Başla', {
            font: 'bold 40px Calibri',
            color: '#ffffff',
            shadow: { offsetX: 2, offsetY: 2, color: '#333', blur: 2, fill: true }
        }).setOrigin(0.5);
        
        btn.add([btnBg, btnText]);
        content.add(btn);

        // Interaction
        const hitZone = this.add.zone(0, 0, 400, 100);
        btn.add(hitZone);
        hitZone.setInteractive({ useHandCursor: true });
        
        hitZone.on('pointerover', () => btn.setScale(1.05));
        hitZone.on('pointerout', () => btn.setScale(1));
        hitZone.on('pointerdown', () => btn.setScale(0.95));
        hitZone.on('pointerup', async () => {
            btn.setScale(1.05);
            
            // Initial Audio Context Start
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            
            this.scene.start('GameScene');
        });

        // Add subtle animation to container
        this.tweens.add({
            targets: content,
            y: height/2 + 10,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
}