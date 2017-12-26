////////////////////////////////////////////////////////////////////////////////
// ShuffleCupJS
// Created by Andrew McPherran
////////////////////////////////////
var camera, scene, controls, renderer, gui, lights;
var cups = [], cupPositions, ball;
var preRound = true, inRound = false; // Round state tracking
var roundCycle = 0, moveCycle = 0, liftCycle = 0; // Animation cycles
var roundDuration, swapsPerRound, swapTime, liftTime = 40; // Timing variables
// Global score-related variables
var score = 0, scoredThisRound = true;

var cameraControls;
var clock = new THREE.Clock();
var keyboard = new KeyboardState();

// Global variables for mouse-intersection handling
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2(), INTERSECTED, SELECTED, objects = [];

var canvasWidth = 1200;
var canvasHeight = 800;

// Global asset Loading Manager
var manager = new THREE.LoadingManager();
manager.onProgress = function ( item, loaded, total ) {
	console.log( item, loaded, total );
};

// Set up and fill the Scene
function fillScene() {
	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0x808080, 2000, 4000 );
	// Load the Skybox
	scene.background = new THREE.CubeTextureLoader(manager)
		.setPath('assets/skybox/')
		.load([
			'negx.jpg',
			'posx.jpg',
			'posy.jpg',
			'negy.jpg',
			'negz.jpg',
			'posz.jpg'
		]);

    // GUI CONFIGURATION
	gui = new dat.GUI({
		autoPlace: false,
    height : (70 * 4),
		width  : (50 * 6)
	});
	controls = {
		cupCount: 3.0,
		swapsPerRound: 5,
		roundDuration: 100
	};
	roundDuration = controls.roundDuration;
	swapsPerRound = controls.swapsPerRound;
	gui.add(controls, 'cupCount').min(1).max(6).step(1).name('Cup Count');
	gui.add(controls, 'swapsPerRound').min(1).max(40).step(1).name('Swaps per Round');
	gui.add(controls, 'roundDuration').min(25).max(200).step(5).name('Round Duration');
    gui.domElement.style.position = "relative";
    gui.domElement.style.bottom= "232px";
    gui.domElement.style.left = "50px";

	// LIGHTS
	setupLights();
	lights.forEach(function(light) {
		scene.add(light);
	});
    
	// Draw the Table surface
	drawTable();
    
	// Get some cups!!!
	cups.push(new Cup(false, 4)); // New unoccupied Cup at Position 4
	cups.push(new Cup(false, 3)); // New unoccupied Cup at Position 3
	cups.push(new Cup(false, 5)); // New unoccupied Cup at Position 5
    
	// Add the new Cups to the scene
	scene.add(cups[0].model);
	scene.add(cups[1].model);
	scene.add(cups[2].model);
    
	// Get the ball!!
	ball = new Ball();
    // Add the new Ball to the scene
	scene.add(ball.model);

}

// Draw the table surface
function drawTable() {
	var material = new THREE.MeshPhongMaterial();
	var loader = new THREE.TextureLoader(manager);
    // Load the color map texture
	loader.load('assets/tiles/Tiles05_COL_VAR1_3K.jpg', function(texture) {
		material.map = texture;
		material.needsUpdate = true;
	});
    // Load the normal map texture
	loader.load('assets/tiles/Tiles05_NRM_3K.jpg', function(texture) {
		material.normalMap = texture;
		material.needsUpdate = true;
	});
    // Load the specular map texture
	loader.load('assets/tiles/Tiles05_REFL_3K.jpg', function(texture) {
		material.specularMap = texture;
		material.needsUpdate = true;
	});
    // Load the displacement map texture
	var disp = loader.load('assets/tiles/Tiles05_DISP_3K.jpg', function(texture) {
		material.displacementMap = texture;
		material.needsUpdate = true;
	});
	var geometry = new THREE.BoxGeometry(800, 55, 800, 100, 100, 100);
	box = new THREE.Mesh(geometry, material);
	box.position.set(0, 50, 0);
	scene.add(box);
}

// Cup Object constructor
var Cup = function(hasBall, position) {
	this.hasBall = hasBall;             // Whether this Cup is occupied by the Ball
	this.lifted = false;                // Whether this Cup should be "lifted"
	this.position = position;           // The index of this Cup's position in the cupPositions array
	this.model = getCupModel(position); // Generate the THREE.JS Mesh object representing this Cup
	this.model.userData = this;         // Pointer from the Mesh back to this Cup
	cupPositions[position][0] = true;   // Mark this Cup's position as Occupied
	cupPositions[position][2] = cups.length; // Mark that (^) position as Occupied by this Cup
}
// Move a Cup to a specified cupPosition
Cup.prototype.move = function (position) {
	cupPositions[this.position][0] = false; // Mark this Cup's current position as Unoccupied
	this.position = position;               // Mark this Cup's position as the new position
	cupPositions[this.position][0] = true;  // Mark this Cup's new position as Occupied
	cupPositions[this.position][2] = cups.indexOf(this); // Mark that (^) position as Occupied by this Cup
	return;
};
// Remove a Cup
Cup.prototype.remove = function () {
	cupPositions[this.position][0] = false; // Mark this Cup's position as Unoccupied
	scene.remove(this.model);               // Remove this Cup's model from the scene
	return;
};

// Ball Object constructor
var Ball = function() {
    // Pick a random Cup to start in
	var startCup = cups[THREE.Math.randInt(0, cups.length-1)]; 
	this.currentCup = startCup;      // Mark this Ball's current Cup as startCup
	this.currentCup.hasBall = true;  // Mark this Ball's current Cup as having the Ball
	var startPosition = cupPositions[startCup.position]; // Get the starting position for this Ball
	this.model = getBallModel(startPosition[1]);         // Get a THREE.JS Mesh for this Ball
	this.model.userData = this;                          // Pointer from the Mesh back to this Ball
}
// Move a Ball to a specified Cup
Ball.prototype.move = function (cup) {
	this.currentCup.hasBall = false; // Mark that this Ball's currentCup no longer has the Ball
	// Change the Cup that this Ball is assigned to to the given cup
	this.currentCup = cup;
	this.currentCup.hasBall = true;
	// X,Y,Z world position of cup to move Ball to
	var x = cupPositions[cup.position][1].x;
	var y = cupPositions[cup.position][1].y;
	var z = cupPositions[cup.position][1].z;
	this.model.position.set(x,y,z);
}

// Get a 3D representation of a Ball, place at given position
function getBallModel(position) {
	var loader = new THREE.TextureLoader(manager);
	// Diffuse Texture
	var dif = loader.load('assets/marble/Marble13_COL_1K.jpg');
	// Normal Texture
	var norm = loader.load('assets/marble/Marble13_NRM_1K.jpg');
	// Specular Map Texture
	var gloss = loader.load('assets/marble/Marble13_GLOSS_1K.jpg');
	var material = new THREE.MeshPhongMaterial({
		map: dif,
		normalMap: norm,
		specularMap: gloss,
	});
	var geometry = new THREE.SphereGeometry(20, 32, 32);
	var ball = new THREE.Mesh(geometry, material);
	ball.position.set(position.x, position.y-20, position.z);
	return ball;
}

// Get a 3D representation of a Cup
function getCupModel(p) {
	var cup = new THREE.Group();
	var material = new THREE.MeshPhongMaterial({
		side: THREE.DoubleSide,
		color: 0x9b0101,
		shininess: 100
	});
	// material.color.setRGB(THREE.Math.randFloat(0, 1), THREE.Math.randFloat(0, 1), THREE.Math.randFloat(0, 1)); // Randomly color the mesh for easier testing
	var geometry1 = new THREE.CylinderGeometry(30, 40, 80, 25, 1, true);
	var geometry2 = new THREE.CylinderGeometry(30, 30, 10, 25, 1, false);
	var mainCylinder = new THREE.Mesh(geometry1, material);
	var endCylinder = new THREE.Mesh(geometry2, material);
	mainCylinder.position.set(0, 0, 0);
	endCylinder.position.set(0, 42, 0);

	cup.add(mainCylinder);
	cup.add(endCylinder);
	cup.position.set(cupPositions[p][1].x, cupPositions[p][1].y, cupPositions[p][1].z);
	objects.push(mainCylinder, endCylinder);
	return cup;
}

// Set the possible cup positions
function initializeCupPositions() {
	cupPositions = [
		// [Occupied, Vector Position, Index of Occupant]
		[false, new THREE.Vector3().set(200, 120, 0), -1],
		[false, new THREE.Vector3().set(100, 120, -50), -1],
		[false, new THREE.Vector3().set(100, 120, 50), -1],
		[false, new THREE.Vector3().set(0, 120, 100), -1],
		[false, new THREE.Vector3().set(0, 120, 0), -1],
		[false, new THREE.Vector3().set(0, 120, -100), -1],
	];
}

// Get a new unoccupied cup position
function getNewPosition(p) {
    // Loop through all the cupPositions
	for (var i=0; i<cupPositions.length; i++) {
        // If the cupPosition is unoccupied, and it doesn't equal the given current position (p)
		if (cupPositions[i][0] == false && i != p) {
            // Return that position
			return i;
		}
	}
    // Otherwise return null
	return null;
}

function init() {
	// CANVAS
	var canvasRatio = canvasWidth / canvasHeight;
	// RENDERER
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize(canvasWidth, canvasHeight);
	renderer.setClearColor( 0xAAAAAA, 1.0 );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.domElement.addEventListener( 'mousemove', onDocumentMouseMove, false );
	renderer.domElement.addEventListener( 'mousedown', onDocumentMouseDown, false );
	renderer.domElement.addEventListener( 'mouseup', onDocumentMouseUp, false );
	// CAMERA
	camera = new THREE.PerspectiveCamera( 45, canvasRatio, 1, 10000 );

	// CONTROLS
	cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
	camera.position.set( -500, 600, 0);
	cameraControls.target.set(100, 120, 0);
	// HTML LABELS
	    // Score Label
		scoreLabel = document.createElement('div');
		scoreLabel.style.position = 'relative';
		scoreLabel.style.width = 150;
		scoreLabel.style.height = 50;
		scoreLabel.style.bottom = canvasHeight + 40;
		scoreLabel.style.left = canvasWidth/2 - 150/2;
		scoreLabel.style.background = "black";
		scoreLabel.style.fontSize = 32;
		scoreLabel.style.textAlign = 'center';
		scoreLabel.style.color = "white";
		scoreLabel.style.borderWidth = 10;
		scoreLabel.style.fontFamily = "sans-serif";
		scoreLabel.style.paddingTop = 8;
		// Instructions
		instructionBox = document.createElement('div');
		instructionBox.style.position = 'relative';
		instructionBox.style.width = 500;
		instructionBox.style.height = 100;
		instructionBox.style.bottom = 272;
		instructionBox.style.left = 50;
		instructionBox.style.color = "white";
		instructionBox.style.background = "black";
		instructionBox.style.paddingLeft = 20;
		instructionBox.style.paddingTop = 30;
		instructionBox.style.fontSize = 18;
		instructionBox.style.fontFamily = "sans-serif";
		instructionBox.innerHTML = (
			"Press the Space Bar to begin a new round. <br>" +
			"Click on a Cup to raise it, Click it again to lower it. <br>"+
			"Streak will reset if you guess wrong, try not to."
		);

	initializeCupPositions();
}

// Animate the lifting/lowering of a Cup model
function animateCupLift(cup) {
	var a = THREE.Math.mapLinear(liftCycle, 0, liftTime, 0, 1);
	if (!cup.lifted) { // If the cup is not already lifted
		var targetPos = cup.model.position.clone().setY(200);
	} else {
		var targetPos = cup.model.position.clone().setY(120);
	}
	cup.model.position.lerp(targetPos, a);
}

// Animate the movement of all Cup models
function animateCupsMoving() {
	// Loop through all the cups
	for (var c=0; c<cups.length; c++) {
		var a = THREE.Math.mapLinear(moveCycle, 0, swapTime, 0, 1);
		cups[c].model.position.lerp(cupPositions[cups[c].position][1], a);
        // If this Cup has the Ball, move the Ball too
		if (cups[c].hasBall) {
			ball.model.position.lerp(cupPositions[cups[c].position][1], a);
		}
	}
	moveCycle++;
}

// Change the positions of every cup
function moveCups() {
	// Loop through all the cups, starting at end of the array
	for (var c = cups.length-1; c > 0; c--) {
		// Pick a random Cup between 0 and c
        var j = THREE.Math.randInt(0, c);
        // Store the position of cups[c] for later use
		var temp = cups[c].position;
        // Swap the positions of cups[c] and cups[j]
		cups[c].move(cups[j].position);
		cups[j].move(temp);
	}
}

// Main animation handling function
function animate() {
	// Don't allow updates to round duration and SpR during a round
	if (!inRound) {
		roundDuration = controls.roundDuration;
		swapsPerRound = controls.swapsPerRound;
	}

	swapTime = roundDuration/swapsPerRound;

	keyboard.update();
	var playerReady = (typeof keyboard.down("space") !== "undefined");

	// If not currently in a round, and player is ready.
	if (!inRound && playerReady) {
		inRound = true;           // Start the Round
		preRound = false;         // No longer in the "pre-Round" phase
		scoredThisRound = false;  // Mark that the player has not yet scored in this Round
		moveCups();               // Move the Cups
	} else if (inRound) { // If currently in a round.
		//console.log('We're roundin');
		cycle = ++cycle;
		if (moveCycle >= swapTime) { // If a full movement of all cups has finished...
			moveCycle = 0;
			moveCups();              //  start another movement of the cups.
            
		} else {                    // If still in the process of moving cups...
			animateCupsMoving();    //  keep animating movement.
		}
        // If it's time for the current Round to end...
		if (cycle >= controls.roundDuration) {
			inRound = false;      // Mark that we're no longer in a Round
			moveCycle = swapTime; // Finish moving the cups
			animateCupsMoving();
			moveCycle = 0;
		}
	} else { // If not currently in a round, and player is not ready.
		cycle = 0;
	}

	// Handle Cup-Lifting and Scoring
	if (!inRound && SELECTED != null) { // If not in a Round, and Player has clicked on a Cup
		animateCupLift(SELECTED); // Animate lifting the SELECTED Cup
		if (liftCycle >= liftTime) {    // If the animation has finished
			liftCycle = 0;
			if (SELECTED.lifted == true) { // and If the SELECTED Cup is currently Lifted
				SELECTED.lifted = false;   // mark the Cup as needing to be "un-lifted" (lowered)
				preRound = true;           // enter the "pre-Round" phase
                // If the Cup selected has the Ball, and the Player hasn't scored yet this round
				if (SELECTED.hasBall && !scoredThisRound) {
					scoredThisRound = true; // Mark that the player has scored this round
					score++;                //  and increase the score by 1.
				} else { // Otherwise...
					scoredThisRound = true; // mark that the player has tried to score this round
					score = 0;              //  and reset the streak to 0.
				}
			} else { // If the SELECTED Cup is not currently Lifted...
				SELECTED.lifted = true; // mark it for Lift off.
			}
			SELECTED = null;
		} else liftCycle++;
	}

	// Handle adding and removing cups
	if (controls.cupCount != cups.length && !inRound) {
		var diff = controls.cupCount - cups.length;
		if (diff < 0) {
			var poppedCup = cups.pop()
			if (poppedCup.hasBall = true) {
				ball.currentCup.model.children[0].material.opacity = 1;
				ball.currentCup.model.children[0].material.transparent = false;
				ball.currentCup.model.children[1].material.opacity = 1;
				ball.currentCup.model.children[1].material.transparent = false;
				ball.move(cups[THREE.Math.randInt(0, cups.length-1)]);
			}
			poppedCup.remove();
			objects.pop();objects.pop();
		} else {
			// Add a new Cup to the cups array
			cups.push(new Cup(false, getNewPosition(-1)));
			// Add the new Cup model to the scene
			scene.add(cups[cups.length-1].model);
		}
	}

	// Before a round starts, make the cup containing the ball transparent
	if (preRound) {
		ball.currentCup.model.children[0].material.opacity = 0.5;
		ball.currentCup.model.children[0].material.transparent = true;
		ball.currentCup.model.children[1].material.opacity = 0.5;
		ball.currentCup.model.children[1].material.transparent = true;
	} else {
		ball.currentCup.model.children[0].material.opacity = 1;
		ball.currentCup.model.children[0].material.transparent = false;
		ball.currentCup.model.children[1].material.opacity = 1;
		ball.currentCup.model.children[1].material.transparent = false;
	}

	window.requestAnimationFrame(animate);
	render();
}

function render() {
	var delta = clock.getDelta();
	cameraControls.update(delta);

	// Score display
	scoreLabel.innerHTML = "Streak: " + score;
	document.body.children[0].appendChild(scoreLabel);
	// Instruction Box display
	document.body.children[0].appendChild(instructionBox);

	renderer.render(scene, camera);
}

function addToDOM() {
  var canvas = document.getElementById('canvas');
  canvas.appendChild(renderer.domElement);
  canvas.appendChild(gui.domElement);
}

// LIGHTS Configuration
function setupLights() {
	lights = [];
	// First Directional Light
	var light = new THREE.DirectionalLight( 0xffffff, 0.7 );
	light.position.set( 200, 1500, 500 );
	light.castShadow = true;
	light.intensity = 0.5;
	lights.push(light);
	// Second Directional Light
	light = new THREE.DirectionalLight( 0xffffff, 0.9 );
	light.position.set( -500, 1000, 0 );
	light.castShadow = true;
	light.intensity = 1;
	lights.push(light);
	// Ambient Light
	light = new THREE.AmbientLight( 0x222222 );
	lights.push(light);
}

// Handles mouse movement event
function onDocumentMouseMove( event ) {
	event.preventDefault();
  // this converts window mouse values to x and y mouse coordinates that range between -1 and 1 in the canvas
  mouse.set(
     (( event.clientX / window.innerWidth ) * 2 - 1) *
     (window.innerWidth/canvasWidth),
     (-((event.clientY - ($("#canvas").position().top + (canvasHeight/2))) / window.innerHeight) * 2 )
     * (window.innerHeight/canvasHeight));
}
// Handles mouse down event
function onDocumentMouseDown( event ) {
	event.preventDefault();
	raycaster.setFromCamera( mouse, camera );
	var intersects = raycaster.intersectObjects( objects );
	//console.log(objects);
	if ( intersects.length > 0 ) {
		cameraControls.enabled = false;
		SELECTED = intersects[ 0 ].object;
		SELECTED = SELECTED.parent.userData;
	}
}
// Handles mouse up event
function onDocumentMouseUp( event ) {
	event.preventDefault();
	cameraControls.enabled = true;
	canvas.style.cursor = 'auto';
}

try {
  init();
	fillScene();
	addToDOM();
	animate();
} catch(error) {
  console.log("Your program encountered an unrecoverable error, can not draw on canvas. Error was:");
  console.log(error);
}
