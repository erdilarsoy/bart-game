import Phaser from 'https://esm.sh/phaser@3.70.0';
import { BootScene } from './scenes/BootScene.js';
import { StartScene } from './scenes/StartScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1920,
        height: 1080
    },
    backgroundColor: '#f5f0e6', // Fallback color
    scene: [BootScene, StartScene, GameScene, GameOverScene],
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};

new Phaser.Game(config);