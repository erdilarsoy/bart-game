import Phaser from 'https://esm.sh/phaser@3.70.0';

export class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOverScene');
    }

    init(data) {
        this.score = data.score || 0;
        this.stats = data.stats || {};
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);

        // Main Container for centering
        this.resultsContainer = this.add.container(width / 2, height / 2);

        // Panel size
        const panelH = 500;
        const panelW = 700;

        // Draw panel relative to container center (0,0)
        const panel = this.add.graphics();
        panel.fillStyle(0xfffdf5, 1);
        panel.lineStyle(4, 0xd0c0a0, 1);
        panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 30);
        panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 30);
        this.resultsContainer.add(panel);

        const titleParams = { font: 'bold 50px Calibri', color: '#5a4a3a' };
        const scoreParams = { font: 'bold 36px Calibri', color: '#81c784' };

        const titleText = this.add.text(0, -panelH / 2 + 50, 'Test Tamamlandı', titleParams).setOrigin(0.5);
        this.resultsContainer.add(titleText);

        const scoreText = this.add.text(0, -panelH / 2 + 100, `Toplam Kazanç: $${this.score}`, scoreParams).setOrigin(0.5);
        this.resultsContainer.add(scoreText);

        // Stats Display
        const statsConfig = [
            { label: 'Genel risk alma eğilimi', score: this.stats.GRA_score },
            { label: 'Risk-getiri verimliliği', score: this.stats.RV_score },
            { label: 'Öğrenme ve uyum düzeyi', score: this.stats.OA_score },
            { label: 'Kayıp duyarlılığı', score: this.stats.KD_score },
            { label: 'Karar verme hızı', score: this.stats.Speed_score }
        ];

        let startY = -panelH / 2 + 160;
        const gap = 45;

        statsConfig.forEach((stat, i) => {
            const scoreVal = stat.score !== undefined ? stat.score : 0;
            const yPos = startY + (i * gap);

            // Label (Left side of container center)
            const label = this.add.text(-200, yPos, stat.label, { font: 'bold 24px Calibri', color: '#8a7a6a' }).setOrigin(0, 0.5);
            this.resultsContainer.add(label);

            // Score (Right side of container center)
            const score = this.add.text(200, yPos, `${scoreVal}/100`, { font: 'bold 24px Calibri', color: '#5a4a3a' }).setOrigin(1, 0.5);
            this.resultsContainer.add(score);
        });

        // Buttons
        const btnY = panelH / 2 + 60;

        // Play Again
        const restartText = this.add.text(-170, btnY, 'Tekrar Oyna', { font: 'bold 30px Calibri', color: '#ffffff' }).setOrigin(0.5);
        // We need a background shape for the button
        const restartBg = this.add.graphics();
        restartBg.fillStyle(0x81c784, 1);
        restartBg.fillRoundedRect(-320, btnY - 40, 300, 80, 20);
        this.resultsContainer.add(restartBg);
        this.resultsContainer.add(restartText);

        const restartBtn = this.add.zone(-170, btnY, 300, 80);
        restartBtn.setInteractive({ useHandCursor: true });
        restartBtn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
        this.resultsContainer.add(restartBtn);

        // Export
        const exportBg = this.add.graphics();
        exportBg.fillStyle(0xffd54f, 1);
        exportBg.fillRoundedRect(20, btnY - 40, 300, 80, 20);
        this.resultsContainer.add(exportBg);

        const exportText = this.add.text(170, btnY, 'CSV İndir', { font: 'bold 30px Calibri', color: '#5a4a3a' }).setOrigin(0.5);
        this.resultsContainer.add(exportText);

        const exportBtn = this.add.zone(170, btnY, 300, 80);
        exportBtn.setInteractive({ useHandCursor: true });
        exportBtn.on('pointerdown', () => {
            this.downloadCSV();
        });
        this.resultsContainer.add(exportBtn);

        // Resize handler
        this.scale.on('resize', this.resize, this);
        this.resize(this.scale.gameSize);
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

        if (this.resultsContainer) {
            this.resultsContainer.setPosition(cx, cy);

            // Container size is approx 700x500
            const nominalW = 750; // Plus some margin
            const nominalH = 600;

            const availableW = width * 0.9;
            const availableH = height * 0.9;

            const scaleW = availableW / nominalW;
            const scaleH = availableH / nominalH;

            const finalScale = Math.min(scaleW, scaleH, 1);
            this.resultsContainer.setScale(finalScale);
        }
    }

    downloadCSV() {
        const log = window.trialLog || [];
        if (log.length === 0) {
            console.warn('No trial log data found to export');
            return;
        }

        // Define headers (matching DESIGN_NOTES.md field names)
        const headers = [
            'blockName', 'balloonColor', 'balloonCount', 'timesPumped', 'explosion',
            'earningsThisBalloon', 'totalEarningsSoFar', 'totalAdjustedBartScoreSoFar', 'averagePumpRT'
        ];

        // Convert data to CSV string
        const csvRows = [headers.join(',')];

        log.forEach(row => {
            const values = headers.map(header => {
                const val = row[header];
                // Escape quotes if needed, though our data is simple
                return JSON.stringify(val);
            });
            csvRows.push(values.join(','));
        });

        // Add Summary Stats at the bottom (optional but useful)
        csvRows.push(''); // Empty row
        csvRows.push('SUMMARY SCORES');
        const stats = window.stats || {};
        Object.keys(stats).forEach(key => {
            csvRows.push(`${key},${stats[key]}`);
        });

        const csvString = csvRows.join('\n');

        // Trigger download
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bart_results_${Date.now()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}