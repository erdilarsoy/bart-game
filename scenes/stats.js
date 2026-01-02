/**
 * HR Metrics calculation functions for BART game
 * All functions operate on main block trials only
 * Each function returns { raw: number, score: number } where score is 0-100
 */

/**
 * Calculate risk ratio for a trial: timesPumped / mean explosion point for that color
 */
function calculateRiskRatio(trial) {
    const meanExplosion = {
        'low': 64,
        'medium': 16,
        'high': 4
    }[trial.balloonColor] || 16;
    
    return trial.timesPumped / meanExplosion;
}

/**
 * 1. Overall Risk Level
 * Based on adjusted BART score and riskRatio (pumps / mean explosion for that color)
 */
export function computeOverallRisk(trials) {
    const mainTrials = trials.filter(t => t.blockName === 'main');
    if (mainTrials.length === 0) {
        return { raw: 0, score: 50 };
    }

    // Calculate adjusted BART score (mean pumps on non-exploded balloons)
    const nonExploded = mainTrials.filter(t => t.explosion === 0);
    const adjustedBartScore = nonExploded.length > 0
        ? nonExploded.reduce((sum, t) => sum + t.timesPumped, 0) / nonExploded.length
        : 0;

    // Calculate average risk ratio
    const riskRatios = mainTrials.map(calculateRiskRatio);
    const avgRiskRatio = riskRatios.reduce((sum, r) => sum + r, 0) / riskRatios.length;

    // Combine adjusted BART score and risk ratio for overall risk
    // Weighted combination: 50% adjusted BART (normalized), 50% risk ratio
    const normalizedBart = adjustedBartScore / 64; // Normalize by max expected (low risk mean)
    const raw = (normalizedBart + avgRiskRatio) / 2;

    // Normalize to 0-100 score (higher = more risk taking)
    // Assuming typical range: raw ~0.2-0.8, we'll scale it
    const score = Math.max(0, Math.min(100, Math.round((raw - 0.2) / 0.6 * 100)));

    return { raw, score };
}

/**
 * 2. Risk-Return Efficiency
 * Total earnings / total pumps
 */
export function computeEfficiency(trials) {
    const mainTrials = trials.filter(t => t.blockName === 'main');
    if (mainTrials.length === 0) {
        return { raw: 0, score: 50 };
    }

    const totalEarnings = mainTrials.reduce((sum, t) => sum + (t.earningsThisBalloon || 0), 0);
    const totalPumps = mainTrials.reduce((sum, t) => sum + t.timesPumped, 0);

    const raw = totalPumps > 0 ? totalEarnings / totalPumps : 0;

    // Normalize to 0-100 score (higher = more efficient)
    // Typical range might be 0-50, we'll scale it
    const score = Math.max(0, Math.min(100, Math.round(raw / 50 * 100)));

    return { raw, score };
}

/**
 * 3. Adaptation / Learning
 * Change in risk behavior across the 3 main phases: low (trials 1-20), medium (21-40), high (41-60)
 */
export function computeAdaptation(trials) {
    const mainTrials = trials.filter(t => t.blockName === 'main');
    if (mainTrials.length < 60) {
        return { raw: 0, score: 50 };
    }

    // Split into 3 phases of 20 trials each
    const phase1 = mainTrials.slice(0, 20);   // low risk phase
    const phase2 = mainTrials.slice(20, 40);  // medium risk phase
    const phase3 = mainTrials.slice(40, 60);  // high risk phase

    // Calculate average pumps per phase
    const avgPumps1 = phase1.reduce((sum, t) => sum + t.timesPumped, 0) / phase1.length;
    const avgPumps2 = phase2.reduce((sum, t) => sum + t.timesPumped, 0) / phase2.length;
    const avgPumps3 = phase3.reduce((sum, t) => sum + t.timesPumped, 0) / phase3.length;

    // Calculate how well they adapt: compare actual behavior to expected risk-adjusted behavior
    // Expected: phase1 should be higher pumps (low risk), phase3 should be lower (high risk)
    // Good adaptation: positive trend (higher in phase1, lower in phase3)
    const expectedTrend = avgPumps1 - avgPumps3; // Positive means good adaptation
    
    // Also check consistency across phases relative to risk level
    // Calculate risk-adjusted averages (normalize by mean explosion point)
    const riskAdj1 = avgPumps1 / 64;  // low risk mean = 64
    const riskAdj2 = avgPumps2 / 16;  // medium risk mean = 16
    const riskAdj3 = avgPumps3 / 4;   // high risk mean = 4
    
    // Adaptation score: consistency in risk-adjusted behavior (lower variance = better)
    const meanRiskAdj = (riskAdj1 + riskAdj2 + riskAdj3) / 3;
    const variance = [
        Math.pow(riskAdj1 - meanRiskAdj, 2),
        Math.pow(riskAdj2 - meanRiskAdj, 2),
        Math.pow(riskAdj3 - meanRiskAdj, 2)
    ].reduce((sum, v) => sum + v, 0) / 3;
    
    // Lower variance = better adaptation, so we invert it
    const raw = -Math.sqrt(variance);

    // Normalize to 0-100 score (higher = better adaptation)
    // Typical raw range might be -0.5 to 0, we'll scale it
    const score = Math.max(0, Math.min(100, Math.round((raw + 0.5) / 0.5 * 100)));

    return { raw, score };
}

/**
 * 4. Loss Sensitivity
 * Change in pumps immediately after explosions (before vs after)
 */
export function computeLossSensitivity(trials) {
    const mainTrials = trials.filter(t => t.blockName === 'main');
    if (mainTrials.length < 3) {
        return { raw: 0, score: 50 };
    }

    let deltaSum = 0;
    let deltaCount = 0;

    for (let i = 1; i < mainTrials.length - 1; i++) {
        if (mainTrials[i].explosion === 1) {
            // Compare pumps before explosion (i-1) to after explosion (i+1)
            const pumpsBefore = mainTrials[i - 1].timesPumped;
            const pumpsAfter = mainTrials[i + 1].timesPumped;
            const delta = pumpsAfter - pumpsBefore;
            deltaSum += delta;
            deltaCount++;
        }
    }

    // Negative delta means reduction after explosion (higher sensitivity)
    const raw = deltaCount > 0 ? -(deltaSum / deltaCount) : 0;

    // Normalize to 0-100 score (higher = more sensitive to losses)
    // Typical range might be -10 to 10, we'll scale it
    const score = Math.max(0, Math.min(100, Math.round((raw + 10) / 20 * 100)));

    return { raw, score };
}

/**
 * 5. Decision Speed
 * Uses averagePumpRT across main trials (mean and variability)
 */
export function computeDecisionSpeed(trials) {
    const mainTrials = trials.filter(t => t.blockName === 'main');
    if (mainTrials.length === 0) {
        return { raw: 0, score: 50 };
    }

    const rtValues = mainTrials
        .map(t => t.averagePumpRT)
        .filter(rt => rt !== null && rt !== undefined && rt > 0);

    if (rtValues.length === 0) {
        return { raw: 0, score: 50 };
    }

    // Calculate mean RT in seconds
    const meanRT_ms = rtValues.reduce((sum, rt) => sum + rt, 0) / rtValues.length;
    const meanRT_sec = meanRT_ms / 1000;

    // Calculate standard deviation in seconds
    const variance = rtValues.reduce((sum, rt) => {
        const diff = (rt / 1000) - meanRT_sec;
        return sum + diff * diff;
    }, 0) / rtValues.length;
    const sd_sec = Math.sqrt(variance);

    // Speed index: inverse of mean RT (faster = higher score)
    // Also penalize high variability (inconsistent speed)
    const speedIndex = 1 / Math.max(0.1, meanRT_sec);
    const consistencyPenalty = 1 / (1 + sd_sec);
    
    // Combine speed and consistency
    const raw = speedIndex * consistencyPenalty;

    // Normalize to 0-100 score (higher = faster and more consistent)
    // Typical range might be 0.5-2.0, we'll scale it
    const score = Math.max(0, Math.min(100, Math.round((raw - 0.5) / 1.5 * 100)));

    return { raw, score };
}

