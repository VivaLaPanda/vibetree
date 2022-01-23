const ctx = document.getElementById('canvas').getContext("2d");
canvas.width = window.innerWidth * .99;
canvas.height = window.innerHeight * .997;

/* Seeded random functions
   randSeed(int)  int is a seed value
   randSI()  random integer 0 or 1
   randSI(max) random integer from  0 <= random < max
   randSI(min, max) random integer from min <= random < max
   randS()  like Math.random
   randS(max) random float 0 <= random < max
   randS(min, max) random float min <= random < max
   
   */
const seededRandom = (() => {
    var seed = 1;
    return { max : 2576436549074795, reseed (s) { seed = s }, random ()  { return seed = ((8765432352450986 * seed) + 8507698654323524) % this.max }}
})();
const randSeed = (seed) => seededRandom.reseed(seed|0);
const randSI = (min = 2, max = min + (min = 0)) => (seededRandom.random() % (max - min)) + min;
const randS  = (min = 1, max = min + (min = 0)) => (seededRandom.random() / seededRandom.max) * (max - min) + min;


/* TREE CONSTANTS all angles in radians and lengths/widths are in pixels */
const angMin = 0.1;  // branching angle min and max
const angMax = 0.6;
const lengMin = 0.7;  // length reduction per branch min and max
const lengMax = 0.9;
var widthMin; // width reduction per branch min max 6
var widthMax;
var trunkStartingHeight; // 1/this
var trunkMin;  // trunk base width ,min and max
var trunkMax;
var maxBranches; // max number of branches

/* const angMin = 0.01;  // branching angle min and max
const angMax= 0.6;
var lengMin = 0.7;  // length reduction per branch min and max
var lengMax = 0.9;
var widthMin = 0.6; // width reduction per branch min max 6
var widthMax = 0.8;
var trunkStartingHeight = 10; // 1/this
var trunkMin = 6;  // trunk base width ,min and max
var trunkMax = 10;
var maxBranches = 3; // max number of branches */

var baseInk = 10;
var ink = baseInk;

/* canvas.onmousewheel = function (event) {
	if (event.wheelDelta > 0) {
		passTime(1)
	} else {
		passTime(-1)
	}
} */

var age = 1
var agingDirection = 1;
var stopAging = false;
function passTime(time) {
	if (stopAging) {
		return
	}
	
	age += time * agingDirection
	
	if (baseInk <= 1) {
		agingDirection *= -1;
		restartTree();
	}

	// lengMax += agingDirection * .00000025 * age;
	// if (lengMax > 1) { lengMax = 1 };
	
	trunkStartingHeight = 10 + (age * .015 * -1)
	if (trunkStartingHeight < 1) {trunkStartingHeight = 2}
	
	// widthMax *= 1.001;
	trunkMax *= .00001 * age;
	maxBranches += agingDirection * age;
	
	baseInk += agingDirection * (age * .03);
}

canvas.addEventListener("click", ()=> {
	agingDirection *= -1;
	stopAging = false;
})

const windX = -1;   // wind direction vector
const windY = 0;
const bendability = 6; // greater than 1. The bigger this number the more the thin branches will bend first

// the canvas height you are scaling up or down to a different sized canvas
const windStrength = 0.01 * bendability * ((200 ** 2) / (canvas.height ** 2));  // wind strength


// The wind is used to simulate branch spring back the following
// two number control that. Note that the sum on the two following should
// be below 1 or the function will oscillate out of control
const windBendRectSpeed = 0.01;  // how fast the tree reacts to the wing
const windBranchSpring = 0.98;   // the amount and speed of the branch spring back

const gustProbability = 1/100; // how often there is a gust of wind

// Values trying to have a gusty wind effect
var windCycle = 0;
var windCycleGust = 0;
var windCycleGustTime = 0;
var currentWind = 0;
var windFollow = 0;
var windActual = 0;


// The seed value for the tree
var treeSeed = Math.random() * 10000 | 0;

// Vars to build tree with
var branchCount = 0;
var maxTrunk = 0;
var treeGrow = 0.01; // this value should not be zero

function restartTree() {
    branchCount = 0;
	widthMin = 0.6; // width reduction per branch min max 6
	widthMax = 0.8;
	trunkStartingHeight = 10; // 1/this
	trunkMin = 6;  // trunk base width ,min and max
	trunkMax = 10;
	maxBranches = 3; // max number of branches
	age = 1;
	
	baseInk = 10;
	ink = baseInk;

	treeSeed = Math.random() * 10000 | 0;
	treeGrow = 0.1; // regrow tree
}

var growthQueue = [];

// Starts a new tree
function drawTree(seed) {
    branchCount = 0;
	ink = baseInk;
    treeGrow += 0.01;
    randSeed(seed);
    maxTrunk = randSI(trunkMin, trunkMax);
	growthQueue.push({
		"x": canvas.width / 2,
		"y": canvas.height,
		"dir": -Math.PI / 2, 
		"length" : canvas.height / trunkStartingHeight, 
		"width": maxTrunk
	});
	while (growthQueue.length > 0) {
		var branch = growthQueue.shift();
		treeGrow -= 0.2;
		drawBranch(
			branch.x,branch.y,
			branch.dir, 
			branch.length, 
			branch.width
		);
		treeGrow += 0.2;
	}
}

// Recusive tree
function drawBranch(x, y, dir, leng, width) {
    branchCount ++;
    const treeGrowVal = (treeGrow > 1 ? 1 : treeGrow < 0.1 ? 0.1 : treeGrow) ** 2 ;
    
	if (leng > ink) {
		leng = ink;
		ink = 0;
	} else {
		ink -= leng
	}
	
	if (leng == 0) {
		return;
	}
	
    // get wind bending force and turn branch direction
    const xx = Math.cos(dir) * leng * treeGrowVal;
    const yy = Math.sin(dir) * leng * treeGrowVal;
    const windSideWayForce = windX * yy - windY * xx;
    
    // change direction by addition based on the wind and scale to 
    // (windStrength * windActual) the wind force
    // ((1 - width / maxTrunk) ** bendability)  the amount of bending due to branch thickness
    // windSideWayForce the force depending on the branch angle to the wind
    dir += (windStrength * windActual) * ((1 - width / maxTrunk) ** bendability) * windSideWayForce;
    
    // draw the branch
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.lineTo(x, y);
    x += xx;
    y += yy;
    ctx.lineTo(x, y);
    ctx.stroke();
	
	if (x > canvas.width || y > canvas.height) {
		stopAging = true;
	}
    
    // Make sure we're not growing too much
	if (branchCount < maxBranches) {
		// to stop recusive bias (due to branch count limit)
		// random select direction of first recusive bend
		const rDir = randSI() ? -1 : 1;

		growthQueue.push({
			"x": x,
			"y": y,
			"dir": dir + randS(angMin, angMax) * rDir, 
			"length" : leng * randS(lengMin, lengMax), 
			"width": width * randS(widthMin, widthMax)
		});


		// bend next branch the other way
		growthQueue.push({
			"x": x,
			"y": y,
			"dir": dir + randS(angMin, angMax) * -rDir, 
			"length" : leng * randS(lengMin, lengMax), 
			"width": width * randS(widthMin, widthMax)
		});
	}
}

// Dont ask this is a quick try at wind gusts 
// Wind needs a spacial component this sim does not include that.

function updateWind() {
    if (Math.random() < gustProbability) {
        windCycleGustTime = (Math.random() * 10 + 1) | 0;
    }
    if (windCycleGustTime > 0) {
        windCycleGustTime --;
        windCycleGust += windCycleGustTime/20
    } else {
        windCycleGust *= 0.99;
    }        
    windCycle += windCycleGust;
    currentWind = (Math.sin(windCycle/40) * 0.6 + 0.4) ** 2;
    currentWind = currentWind < 0 ? 0 : currentWind;
    windFollow += (currentWind - windActual) * windBendRectSpeed;
    windFollow *= windBranchSpring ;
    windActual += windFollow;
}
restartTree();
requestAnimationFrame(update);
function update() {
	ctx.fillStyle = 'black';
	ctx.strokeStyle = 'white';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    updateWind();
	passTime(.1);
    drawTree(treeSeed);
    requestAnimationFrame(update);
}