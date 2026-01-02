import Phaser from 'phaser';

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

        this.add.image(0, 0, 'background-paper').setOrigin(0, 0).setDisplaySize(width, height);

        // Panel size increased to fit stats
        const panelH = 500;
        const panel = this.add.graphics();
        panel.fillStyle(0xfffdf5, 1);
        panel.lineStyle(4, 0xd0c0a0, 1);
        panel.fillRoundedRect(width/2 - 350, height/2 - panelH/2, 700, panelH, 30);
        panel.strokeRoundedRect(width/2 - 350, height/2 - panelH/2, 700, panelH, 30);

        this.add.text(width/2, height/2 - panelH/2 + 50, 'Test Tamamlandı', {
            font: 'bold 50px Calibri',
            color: '#5a4a3a'
        }).setOrigin(0.5);

        this.add.text(width/2, height/2 - panelH/2 + 100, `Toplam Kazanç: $${this.score}`, {
            font: 'bold 36px Calibri',
            color: '#81c784'
        }).setOrigin(0.5);

        // Stats Display
        // Labels: overall risk, efficiency, adaptation, loss sensitivity, decision speed
        const statsConfig = [
            { label: 'Genel risk alma eğilimi', score: this.stats.GRA_score },
            { label: 'Risk-getiri verimliliği', score: this.stats.RV_score },
            { label: 'Öğrenme ve uyum düzeyi', score: this.stats.OA_score },
            { label: 'Kayıp duyarlılığı', score: this.stats.KD_score },
            { label: 'Karar verme hızı', score: this.stats.Speed_score }
        ];

        let startY = height/2 - panelH/2 + 160;
        const gap = 45;

        statsConfig.forEach((stat, i) => {
            const scoreVal = stat.score !== undefined ? stat.score : 0;

            // Label
            this.add.text(width/2 - 200, startY + (i * gap), stat.label, {
                font: 'bold 24px Calibri',
                color: '#8a7a6a'
            }).setOrigin(0, 0.5);

            // Score with /100
            this.add.text(width/2 + 200, startY + (i * gap), `${scoreVal}/100`, {
                font: 'bold 24px Calibri',
                color: '#5a4a3a'
            }).setOrigin(1, 0.5);
            
            // Optional: Add simple dots to connect them visually
            const dots = this.add.graphics();
            dots.lineStyle(2, 0xe0d0b0, 1);
            // Simple visual connector
            // dots.beginPath();
            // dots.moveTo(width/2 - 180 + (stat.label.length * 10), startY + (i * gap) + 5); 
            // dots.lineTo(width/2 + 120, startY + (i * gap) + 5);
            // dots.strokePath();
        });

        // Play Again Button
        const btnY = height/2 + panelH/2 + 60;
        
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x81c784, 1);
        btnBg.fillRoundedRect(width/2 - 320, btnY - 40, 300, 80, 20); // Moved left
        
        const restartText = this.add.text(width/2 - 170, btnY, 'Tekrar Oyna', {
            font: 'bold 30px Calibri',
            color: '#ffffff'
        }).setOrigin(0.5);

        const restartBtn = this.add.zone(width/2 - 170, btnY, 300, 80);
        restartBtn.setInteractive({ useHandCursor: true });
        restartBtn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        // CSV Export Button
        const exportBtnBg = this.add.graphics();
        exportBtnBg.fillStyle(0xffd54f, 1); // Yellowish
        exportBtnBg.fillRoundedRect(width/2 + 20, btnY - 40, 300, 80, 20); // Moved right
        
        const exportText = this.add.text(width/2 + 170, btnY, 'CSV İndir', {
            font: 'bold 30px Calibri',
            color: '#5a4a3a'
        }).setOrigin(0.5);

        const exportBtn = this.add.zone(width/2 + 170, btnY, 300, 80);
        exportBtn.setInteractive({ useHandCursor: true });
        exportBtn.on('pointerdown', () => {
            this.downloadCSV();
        });
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