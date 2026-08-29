const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.font = "15px Arial";
ctx.fillStyle = "black";
ctx.textAlign = "center";

const bgImage = new Image();bgImage.src = 'assets/background0.webp'; 
const plrImage = new Image();plrImage.src = 'assets/player.webp';
const keycapImage = new Image();keycapImage.src = 'assets/keycap.webp';

let x1 = 0; //bg img 1 x
let x2 = canvas.width; //bg img 2 x
// const bg_speed = 1;

const _cooldowns = {};
function cooldown(actionName, durationMs) {
    const currentTime = performance.now();

    if (!_cooldowns[actionName] || currentTime >= _cooldowns[actionName]) {
        _cooldowns[actionName] = currentTime + durationMs;
        return true;
    }

    return false;
}

let keys = {};
{//handle key presses
window.addEventListener('keydown', (event) => {
    if (event.key === ' ') event.preventDefault(); 
    keys[event.key.toLowerCase()] = true; 
});
window.addEventListener('keyup', (event) => {
    keys[event.key.toLowerCase()] = false;
});
}


let gameKeys = {};

let gr = 0 //g:game r:running  0:no/1:yes/2:paused/3:win

let score = 0;

// let randomLetter_cooldown = 500;

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(gr==0){ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height)} //main menu bg

    if (keys['escape']) { if (cooldown("pause_cool", 500)) { if(gr==1){gr=2}else{gr=1} } }
    if (keys[' '] && gr == 0) { gr = 1;}

    if(gr==0){//main menu
        if (ctx.font != "30px Arial") {
            ctx.font = "30px Arial";
        }
        ctx.fillText("Marathon Recreation", canvas.width/2, 50);
        ctx.font = "15px Arial"
        ctx.fillText("Press [SPACE] to play!", canvas.width/2, 150)
        // if (keys)
    }
    if(gr==2){//pause menu
        if (ctx.font != "30px Arial") {
            ctx.font = "30px Arial";
        }
        ctx.fillText("Paused!", canvas.width/2, 50);
        ctx.font = "15px Arial"
        ctx.fillText("Press [ESC] to resume.", canvas.width/2, 150)
    }
    if(gr==3){//win
        if (ctx.font != "30px Arial") {
            ctx.font = "30px Arial";
        }
        ctx.fillText("You have WONNN!!!!", canvas.width/2, 50);
        ctx.font = "15px Arial";
        ctx.fillText("Screenshot this so you can remember the moment", canvas.width/2, 150);
        ctx.fillText("Refresh the page to play again..", canvas.width/2, 200);
    }

    if (gr==1) {//handle background
        let safeScoreForBg = score <= 0 ? 0.2 : score;
        let bg_speedScoreDynamic = Math.min(8, 1 + (safeScoreForBg * 0.2));
        x1 -= bg_speedScoreDynamic;
        x2 -= bg_speedScoreDynamic;

        if (x1 <= -canvas.width) {
            x1 = x2 + canvas.width;
        }
        if (x2 <= -canvas.width) {
            x2 = x1 + canvas.width;
        }
        ctx.drawImage(bgImage, x1, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImage, x2, 0, canvas.width, canvas.height);
    }
    if (gr==1) {//handle player
        ctx.drawImage(plrImage, 0, 200, 64, 64)
    }
    if (gr == 1) { // handle game logic
        if (ctx.font != "15px Arial") {
            ctx.font = "15px Arial";
        }

        ctx.fillText("let score = "+score.toString()+";", 60, 15)

        let randomLetter_cooldown = Math.max(250, 1000 - (score * 25));
        
        if (cooldown("randomLetter_cool", randomLetter_cooldown)) {
            const randomLetter = () => String.fromCharCode(Math.floor(Math.random() * 26) + 97);
            let spawnedLetter = randomLetter();
            
            gameKeys[spawnedLetter] = {};
            
            gameKeys[spawnedLetter]["a"] = false;
            gameKeys[spawnedLetter]["b"] = -64;
            gameKeys[spawnedLetter]["c"] = Math.floor(Math.random() * (canvas.width - 64));
            gameKeys[spawnedLetter]["d"] = spawnedLetter.toUpperCase();//used to display letter on keycap
        }

        let keysToRemove = [];

        for (let currentLetter in gameKeys) {
            gameKeys[currentLetter]["b"] = gameKeys[currentLetter]["b"] + 1;

            ctx.drawImage(keycapImage, gameKeys[currentLetter]["c"], gameKeys[currentLetter]["b"], 64, 64)
            ctx.fillText(gameKeys[currentLetter]["d"], gameKeys[currentLetter]["c"]+32, gameKeys[currentLetter]["b"]+32)

            if (keys[currentLetter]) {
                gameKeys[currentLetter]["a"] = true;
                score++;
                keysToRemove.push(currentLetter);
            } else if (gameKeys[currentLetter]["b"] >= canvas.height) {
                gameKeys[currentLetter]["a"] = false;
                score--;
                keysToRemove.push(currentLetter);
            }
        }

        for (let letterToDelete of keysToRemove) {
            delete gameKeys[letterToDelete];
        }

        if (score >= 42) {//handle win
            gr = 3;
        }

    }

    
    requestAnimationFrame(gameLoop);
}


bgImage.onload = () => {
    plrImage.onload = () => {
        keycapImage.onload = () => {
            gameLoop();
        }
    }
};