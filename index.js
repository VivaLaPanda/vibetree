const ctx = document.getElementById('canvas').getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const defaultTree = {
	"trunk": 0,
	"angMin": 0.1,
	"angMax": 0.6,
	"lengMin": 0.7,
	"lengMax": 0.9,
	"widthMin": 0.6,
	"widthMax": 0.8,
	"trunkStartingHeight": 20,
	"trunkMin": 10,
	"trunkMax": 15,
	"trunk": 0,
	"currentBranches": 0,
	"maxBranches": 7000,
	
	"agingDirection": 1,
	"inkPot": 1,
	"ink": 1,
	"inkFactor": 8,
	"heightFactor": 7.5,
	"growthModifier": 1,
	"glowModifier": 0,
	"minGrowthMod": .1,
	"maxGrowthMod": 5,
	
	"bendability": 6, // greater than 1. The bigger this number the more the thin branches will bend first
	"windState": {},
	
	"seed": Math.random() * 10000 | 0,
	"growthQueue": [],
}

function setRandom(tree) {
	tree.seededRandom = (() => {
		var seed = 1;
		return { max : 2576436549074795, reseed (s) { seed = s }, random ()  { return seed = ((8765432352450986 * seed) + 8507698654323524) % this.max }}
	})();
	tree.randSeed = (seed) => tree.seededRandom.reseed(seed|0);
	tree.randSI = (min = 2, max = min + (min = 0)) => (tree.seededRandom.random() % (max - min)) + min;
	tree.randS  = (min = 1, max = min + (min = 0)) => (tree.seededRandom.random() / tree.seededRandom.max) * (max - min) + min;
}

function windStrength(tree) {
	return 0.01 * tree.bendability * ((200 ** 2) / (canvas.height ** 2));  // wind strength
}

const defaultWind = {
	"x": -1, // wind direction vector
	"y": 0,
	
	"bendRectSpeed": 0.01, // how fast the tree reacts to the wing
	"branchSpring": 0.88, // the amount and speed of the branch spring back
	"gustProbability": 1/100, // how often there is a gust of wind
	
	"cycle": 0,
	"cycleGust": 0,
	"cycleGustTime": 0,
	"current": 0,
	"follow": 0,
	"actual": 0,
}

function drawTree(tree) {
	tree.currentBranches = 0;
	tree.randSeed(tree.seed);
	tree.trunk = tree.randSI(tree.trunkMin, tree.trunkMax);
	tree.ink = tree.inkPot;
	tree.growthQueue.push({
		"x": canvas.width / 2,
		"y": canvas.height,
		"dir": -Math.PI / 2, 
		"length" : canvas.height / tree.trunkStartingHeight, 
		"width": tree.trunk,
	});
	while (tree.growthQueue.length > 0) {
		var branch = tree.growthQueue.shift();
		drawBranch(
			tree,
			branch.x,branch.y,
			branch.dir, 
			branch.length, 
			branch.width
		);
	}
}

function drawBranch(tree, x, y, dir, leng, width) {
	tree.currentBranches++;

	// Withdraw ink from the inkpot until we're out
	if (leng > tree.ink) {
		leng = tree.ink;
		tree.ink = 0;
	} else {
		tree.ink -= leng
	}
	
	if (leng == 0) {
		return;
	}
	
	// get wind bending force and turn branch direction
	const wind = tree.windState;
	const xx = Math.cos(dir) * leng * 2; // TODO: Check treegrow
	const yy = Math.sin(dir) * leng * 2;
	const windSideWayForce = wind.x * yy - wind.y * xx;
	
	// change direction by addition based on the wind and scale to 
	// (windStrength * windActual) the wind force
	// ((1 - width / maxTrunk) ** bendability)  the amount of bending due to branch thickness
	// windSideWayForce the force depending on the branch angle to the wind
	dir += (windStrength(tree) * wind.actual) * ((1 - width / tree.trunk) ** tree.bendability) * windSideWayForce;
	
	// draw the branch
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.lineTo(x, y);
	x += xx;
	y += yy;
	ctx.lineTo(x, y);
	ctx.stroke();
	
	if (x > canvas.width || y > canvas.height) {
		tree.agingDirection = 0
	}
    
    // Make sure we're not growing too much
	if (tree.currentBranches < tree.maxBranches) {
		// to stop recusive bias (due to branch count limit)
		// random select direction of first recusive bend
		const rDir = tree.randSI() ? -1 : 1;

		tree.growthQueue.push({
			"x": x,
			"y": y,
			"dir": dir + tree.randS(tree.angMin, tree.angMax) * rDir, 
			"length" : leng * tree.randS(tree.lengMin, tree.lengMax), 
			"width": width * tree.randS(tree.widthMin, tree.widthMax)
		});

        // bend other dir
		tree.growthQueue.push({
			"x": x,
			"y": y,
			"dir": dir + tree.randS(tree.angMin, tree.angMax) * -rDir, 
			"length" : leng * tree.randS(tree.lengMin, tree.lengMax), 
			"width": width * tree.randS(tree.widthMin, tree.widthMax)
		});
	}
}

function updateWind(wind, gustModifier) {
	if (Math.random() < (wind.gustProbability * (gustModifier / 2))) {
			wind.cycleGustTime = (Math.random() * 10 + 1) | 0;
	}
	if (wind.cycleGustTime > 0) {
			wind.cycleGustTime --;
			wind.cycleGust += wind.cycleGustTime/20
	} else {
			wind.cycleGust *= 0.99;
	}        
	wind.cycle += wind.cycleGust;
	currentWind = (Math.sin(wind.cycle/40) * 0.6 + 0.4) ** 2;
	currentWind = currentWind < 0 ? 0 : currentWind;
	wind.follow += (currentWind - wind.actual) * wind.bendRectSpeed;
	wind.follow *= wind.branchSpring ;
	wind.actual += wind.follow;
}

function updateTime(tree) {
	// 0 aging direction means we've paused aging
	if (tree.agingDirection == 0) {
		return
	}
	
	// The tree is of negative age. Reseed and make it grow
	if (tree.inkPot <= 1) {
		tree.agingDirection = 1;
		resetTree(tree, tree.windState);
	}
	
	// Make the inkpot bigger or smaller
	var growthFactor = (tree.inkFactor * tree.agingDirection) - ( (1 / (tree.currentBranches + 1)) * 500 )
	if (growthFactor <= 0) {
		growthFactor = .5
	}
	tree.inkPot += (growthFactor * tree.agingDirection) * tree.growthModifier
   
    const potentialHeight = (1 / (Math.pow(tree.inkPot, 1 / (tree.heightFactor) ))) * 40;
    if (potentialHeight < tree.trunkStartingHeight && potentialHeight > 0) {
	    tree.trunkStartingHeight =  potentialHeight;
    }
}

let analyser
let audioCtx;
function initAudioScanner() {
	if(!audioCtx) {
			audioCtx = new AudioContext();
	}
	stream = document.getElementById("audioPlayer").captureStream();
	const mediaRecorder = new MediaRecorder(stream);
	const source = audioCtx.createMediaStreamSource(stream);
    
	analyser = audioCtx.createAnalyser();
	analyser.fftSize = 32;
	const bufferLength = analyser.frequencyBinCount;
	const dataArray = new Uint8Array(bufferLength);

	source.connect(analyser);
	
	mediaRecorder.start();
	console.log(mediaRecorder.state);
	console.log("recorder started");
}


var minloud = 999999;
var maxloud = 0;
function updateGrowthModifier(tree) {
	var array = new Uint8Array(analyser.fftSize);
	analyser.getByteTimeDomainData(array);
	var average = 0;
	var max = 0;
	for (var a of array) {
			a = Math.abs(a - 128);
			average += a;
			max = Math.max(max, a);
	}

	average /= array.length;
	
	// Mapping from the gain range (0-100) to the growthModRange
	tree.growthModifier = tree.minGrowthMod + ((tree.maxGrowthMod - tree.minGrowthMod) / (100 - 0)) * (average - 0)
	if ((average / 10) > tree.glowModifier) {
		tree.glowModifier += .01;
	} else {
		tree.glowModifier += -.01;
	}
}

function resetTree(tree, wind) {
	Object.assign(tree, defaultTree);
	tree.seed = Math.random() * 10000 | 0;
	setRandom(tree);
	tree.windState = wind;
}

// Create a new tree using the defaults and then reseed it
const wind = {};
Object.assign(wind, defaultWind);
const tree = {};
resetTree(tree, wind);


function update() {
	ctx.fillStyle = 'black';
	ctx.strokeStyle = 'white';
	ctx.fillRect(0,0,canvas.width,canvas.height);
	updateWind(wind, tree.growthModifier);
	updateTime(tree);

    ctx.fillStyle = "black";
    ctx.shadowBlur = tree.glowModifier * 50;
    ctx.shadowColor = "white";
	ctx.fillRect(0,canvas.height,canvas.width,canvas.height);

    ctx.shadowBlur = 0;
	
	updateGrowthModifier(tree);
	drawTree(tree);
	requestAnimationFrame(update);
}

ctx.fillStyle = 'black';
ctx.strokeStyle = 'white';
ctx.fillRect(0,0,canvas.width,canvas.height);

var started = false;
document.body.addEventListener('mouseup', ()=> {
	if (started) { return; }
	
	// Don't set the click handler on the tree right away otherwise it gets confused
	setTimeout(function() {
		canvas.addEventListener("mouseup", ()=> {
			if (tree.agingDirection == 0) {
				tree.agingDirection = -1;
			} else {
				tree.agingDirection = 0;
			}
		});
	});
	
	// Show text
	document.querySelectorAll(".hover-box").forEach((node) => { 
		node.style.display = "block"; 
	})
	document.querySelectorAll(".hover-box").forEach((node) => { 
		setTimeout(function() {
		    node.style.opacity = 1;
		}, 500);
	})

	// Start playing
	var music = document.querySelector("#audioPlayer")
	music.play();
	// Listen to the audio.
	initAudioScanner();
	// Start drawing
	requestAnimationFrame(update);
	started = true;
}, true); 
