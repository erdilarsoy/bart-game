## BART – Gamified HR Version (Simplified)

### 1. Purpose

This game is a gamified version of the Balloon Analogue Risk Task (BART).  
Goal: measure how a person balances reward and risk under uncertainty for HR use (decision-making, risk taking, learning from feedback).

Results will later be converted into HR-friendly 0–100 scores and percentiles.

---

### 2. Core task logic

On each trial:

- Player sees one balloon.  
- **Pump**: balloon grows, money for this balloon increases (+1 per pump).  
- **Collect**: current balloon ends safely, money for this balloon is added to total earnings.  
- If the balloon explodes before Collect, money for that balloon is 0 (previous total stays).

Explosion rule: at trial start, draw a hidden “explosion pump count” from a distribution that depends on balloon type (low / medium / high risk). When pumps reach that value, the balloon explodes.

---

### 3. Balloon types and risk levels

Three risk levels:

- **Low risk (blue-type)**  
  Mean explosion point ≈ 64 pumps  

- **Medium risk (yellow-type)**  
  Mean explosion point ≈ 16 pumps  

- **High risk (red-type)**  
  Mean explosion point ≈ 4 pumps  

Visuals can be mapped to safer palettes (e.g. Indigo–Teal, Lemon–Amber, Coral–Magenta) but logic stays: low/medium/high risk with above means.

---

### 4. Block and trial structure

Total: **63 trials** per participant.

1. **Tutorial block (3 trials)**  
   - `blockName = "tutorial"`  
   - `balloonCount = 1–3`  
   - Teaches Pump vs Collect.  
   - Earnings and data are not used in HR scores.

2. **Main test block (60 trials)**  
   - `blockName = "main"`  
   - `balloonCount = 1–60`  
   - Trials are grouped into 6 sessions of 10 trials each:  
     - Trials 1–20: low-risk balloons (blue-type distribution)  
     - Trials 21–40: medium-risk balloons (yellow-type distribution)  
     - Trials 41–60: high-risk balloons (red-type distribution)  
   - Within each session, explosion points are randomized but the **exact sequence is fixed** and identical for all participants.

Only the 60 main trials are used for HR scoring.

---

### 5. Data logging per trial

For every trial, log one object/row with at least:

1. `blockName`  
   `"tutorial"` or `"main"`  

2. `balloonColor`  
   Logical type, e.g. `"low" | "medium" | "high"`  

3. `balloonCount`  
   Tutorial: 1–3, main: 1–60  

4. `timesPumped`  
   Number of pumps on this balloon  

5. `explosion`  
   `1` if exploded, `0` otherwise  

6. `earningsThisBalloon`  
   Money earned on this balloon (0 if exploded)  

7. `totalEarningsSoFar`  
   Running total at the end of this trial (main block only)  

8. `totalAdjustedBartScoreSoFar`  
   Adjusted BART score up to this trial (mean pumps on non-exploded balloons in main block so far)  

9. `averagePumpRT`  
   Average response time between pump presses on this trial

This log array (e.g. `trialLog`) is the single source of truth for all metrics.

---

### 6. Main HR metrics (high level)

All metrics are computed from **main block only** (60 trials). Naming can be used directly in code as function names.

1. **Overall risk level – `computeOverallRisk(trials)`**  
   - Based on adjusted BART score and “riskRatio” (pumps / mean explosion for that color).  
   - Output: raw value + standardized 0–100 score.  

2. **Risk–return efficiency – `computeEfficiency(trials)`**  
   - Total earnings / total pumps.  
   - Output: raw efficiency + 0–100 score.  

3. **Adaptation / learning – `computeAdaptation(trials)`**  
   - Change in risk behavior across the 3 main phases: low (trials 1–20), medium (21–40), high (41–60).  
   - Output: trend indicator + 0–100 score.  

4. **Loss sensitivity – `computeLossSensitivity(trials)`**  
   - Change in pumps immediately after explosions (before vs after).  
   - Output: raw loss sensitivity + 0–100 score.  

5. **Decision speed – `computeDecisionSpeed(trials)`**  
   - Uses `averagePumpRT` across main trials (mean and variability).  
   - Output: speed index + 0–100 score.

The game client shows a simple result screen with these five metrics (both raw and 0–100), using HR-friendly Turkish labels:

- Overall risk: “Genel risk alma eğilimi”  
- Efficiency: “Risk–getiri verimi”  
- Adaptation: “Uyum ve öğrenme”  
- Loss sensitivity: “Kayıp duyarlılığı”  
- Decision speed: “Karar hızı”
