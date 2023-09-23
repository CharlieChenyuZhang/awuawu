import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import "@fontsource/press-start-2p";
import lofiBeatMp3 from "./sounds/lofi-beat.mp3";
import { Configuration, OpenAIApi } from "openai";

require("./main.css");
// configure openai
const configuration = new Configuration({
  apiKey: "", // FIXME: don't commit this
});

const openai = new OpenAIApi(configuration);

// FEATURE FLAGS
let ENABLE_AUTO_JUMP = false;
let TREX_JUMP_SPEED = 11;

// Constants
const CACTUS_SPAWN_X = 20;
const CACTUS_DESTROY_X = -20;
const CACTUS_MAX_SCALE = 1;
const CACTUS_MIN_SCALE = 0.5;
const CACTUS_SPAWN_MAX_INTERVAL = 4;
const CACTUS_SPAWN_MIN_INTERVAL = 2;

const PTERODACTYL_MIN_Y = 4;
const PTERODACTYL_MAX_Y = 5;
const PTERODACTYL_SPAWN_X = -5;
const PTERODACTYL_SPAWN_INTERVAL = 10;
const PTERODACTYL_SPEED = 2;

const GRAVITY = -50;
const FLOOR_SPEED = -10;
const SKYSPHERE_ROTATE_SPEED = 0.02;
const SCORE_INCREASE_SPEED = 10;

// Global variables.
const scene = new THREE.Scene();
let infoElement;
const clock = new THREE.Clock();
const mixers = [];
let trex;
let cactus;
let floor;
let pterodactyl;
let skySphere;
let directionalLight;
let jump = false;
let vel = 0;
let nextCactusSpawnTime = 0;
let nextPterodactylResetTime = 0;
let score = 0;
let isGameOver = true;
const cactusGroup = new THREE.Group();
scene.add(cactusGroup);
let renderer;
let camera;
let textInputElement;

function createInfoElement() {
  infoElement = document.createElement("div");
  infoElement.id = "info";
  infoElement.innerHTML = "Press spacebar to start/jump!";
  document.body.appendChild(infoElement);
}
createInfoElement();

async function callAPI(inputText) {
  // Replace this with your actual API call
  // const response = await fetch("YOUR_API_ENDPOINT", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({ text: inputText }),
  // });

  // const data = await response.json();
  // console.log("API Response:", data);
  console.log("!!! calling...", inputText);
  // return "result";

  try {
    // it saved the previous convo between the AI and bot
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: `
      Act as a teaching assistant. Your task is to analyze student's input
      and translate it to the following format. 
      Please note: ENABLE_AUTO_JUMP is a boolean value. TREX_JUMP_SPEED is an int in the interval of 10 and 22.
      When you can't decide, use the default value. ENABLE_AUTO_JUMP=false,TREX_JUMP_SPEED=10
  
      Below is an example
  
      Student says: Whenever the dino sees a cactus, it will jump automatically. 
  
      Your analysis: 
      {"ENABLE_AUTO_JUMP": true, "TREX_JUMP_SPEED": 10}
  
      Student says: I want the t-rex jumps higher.
  
      Your analysis:
      {"ENABLE_AUTO_JUMP": false, "TREX_JUMP_SPEED": 11}

      """
      ALWAYS return in the format of "ENABLE_AUTO_JUMP:VALUE,TREX_JUMP_SPEED=VALUE" without any space and any other words.
      When you can't determine the value, use the default one.
  
      """ 
      Here is the previous stats

      {"ENABLE_AUTO_JUMP": ${ENABLE_AUTO_JUMP}, "TREX_JUMP_SPEED": ${TREX_JUMP_SPEED}}

      """
  
      Student says: ${inputText}
  
      Your analysis:
      `,
      temperature: 0.6,
      max_tokens: 200,
    });
    let what2say;
    let hasError = true;
    try {
      what2say = completion.data.choices[0].text;
      what2say = JSON.parse(what2say.trim());
      hasError = false;
    } catch (error) {
      // swallow the error, won't crash the program
      console.log("openai error", error);
    }

    if (!hasError) {
      const new_ENABLE_AUTO_JUMP = what2say?.ENABLE_AUTO_JUMP;
      const new_TREX_JUMP_SPEED = what2say?.TREX_JUMP_SPEED;
      console.log("new ENABLE_AUTO_JUMP", new_ENABLE_AUTO_JUMP);
      console.log("new TREX_JUMP_SPEED", new_TREX_JUMP_SPEED);

      if (new_ENABLE_AUTO_JUMP !== ENABLE_AUTO_JUMP) {
        ENABLE_AUTO_JUMP = new_ENABLE_AUTO_JUMP;
        const autoJumpLabel = document.getElementById("autoJumpLabel");
        autoJumpLabel.innerHTML = `Easter egg (see if you can trigger me): ${
          !ENABLE_AUTO_JUMP ? "not yet" : "congrats! AutoMode enabled!"
        }`;
      }

      if (new_TREX_JUMP_SPEED !== TREX_JUMP_SPEED) {
        TREX_JUMP_SPEED = new_TREX_JUMP_SPEED;
        document.getElementById(
          "jumpHeight"
        ).innerHTML = `T-Rex Jump Height: ${TREX_JUMP_SPEED}`;
      }
    }

    // ENABLE_AUTO_JUMP: boolean true / false
    // JUMP HEIGHT: int from [10,22]
  } catch (error) {
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
    }
  }
}

function createControlPanel() {
  const controlPanel = document.createElement("div");
  controlPanel.id = "control-panel";

  // Checkbox for auto-jump feature
  // const autoJumpCheckbox = document.createElement("input");
  // autoJumpCheckbox.type = "checkbox";
  // autoJumpCheckbox.id = "autoJumpCheckbox";
  // autoJumpCheckbox.checked = false; // default value

  const autoJumpLabel = document.createElement("div");
  autoJumpLabel.id = `autoJumpLabel`;
  autoJumpLabel.innerHTML = `Easter egg (see if you can trigger me): ${
    !ENABLE_AUTO_JUMP ? "not yet" : "congrats! AutoMode enabled!"
  }`;

  // Input for T-Rex jump speed
  // const jumpSpeedInput = document.createElement("input");
  // jumpSpeedInput.type = "number";
  // jumpSpeedInput.value = TREX_JUMP_SPEED; // default value

  const jumpSpeedLabel = document.createElement("div");
  jumpSpeedLabel.id = "jumpHeight";
  jumpSpeedLabel.htmlFor = "jumpSpeedInput";
  jumpSpeedLabel.innerHTML = `T-Rex Jump Height: ${TREX_JUMP_SPEED}`;

  // Add them to the control panel
  // controlPanel.appendChild(autoJumpCheckbox);
  controlPanel.appendChild(autoJumpLabel);
  controlPanel.appendChild(document.createElement("br"));
  controlPanel.appendChild(jumpSpeedLabel);

  document.body.appendChild(controlPanel);

  // music control
  // Add a line break for separation
  controlPanel.appendChild(document.createElement("br"));

  // Create a button for toggling music
  const toggleMusicButton = document.createElement("button");
  toggleMusicButton.id = "toggleMusicButton";
  toggleMusicButton.innerHTML = "Music: off";

  // Add the button to the control panel
  controlPanel.appendChild(toggleMusicButton);

  document.body.appendChild(controlPanel);

  // CALL API
  // Create a text area for user input
  const inputTextArea = document.createElement("textarea");
  inputTextArea.id = "userInputArea";
  inputTextArea.rows = 4;
  inputTextArea.cols = 50;

  // Create a button for submitting the user input
  const submitButton = document.createElement("button");
  submitButton.id = "openAiButton";
  submitButton.innerHTML = "Submit";

  // Add event listener for the submit button
  submitButton.addEventListener("click", async () => {
    const inputText = document.getElementById("userInputArea").value;
    await callAPI(inputText);
  });

  // Append the text area and submit button to the control panel
  controlPanel.appendChild(document.createElement("br"));
  controlPanel.appendChild(inputTextArea);
  controlPanel.appendChild(document.createElement("br"));
  controlPanel.appendChild(submitButton);

  document.body.appendChild(controlPanel);
}

createControlPanel();

function createAudioElement() {
  const audioElement = document.createElement("audio");
  audioElement.id = "bg-music";
  audioElement.src = lofiBeatMp3; // Replace with the path to your own audio file
  audioElement.type = "audio/mp3";
  audioElement.loop = true; // Enable looping

  document.body.appendChild(audioElement);
}

createAudioElement();

function createCamera() {
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1, 10);
  camera.lookAt(3, 3, 0);
}
createCamera();

function createRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x7f7f7f);
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);
}
createRenderer();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  update(delta);

  renderer.render(scene, camera);
}
animate();

function createLighting() {
  directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.intensity = 2;
  directionalLight.position.set(0, 10, 0);

  const targetObject = new THREE.Object3D();
  targetObject.position.set(0, 0, 0);
  scene.add(targetObject);
  directionalLight.target = targetObject;

  scene.add(directionalLight);

  const light = new THREE.AmbientLight(0x7f7f7f); // soft white light
  light.intensity = 1;
  scene.add(light);
}
createLighting();

function load3DModels() {
  // Instantiate a loader.
  const loader = new GLTFLoader();

  // Load T-Rex model.
  loader.load(
    "models/t-rex/scene.gltf",
    function (gltf) {
      trex = gltf.scene;

      trex.position.x = 0.4;
      trex.scale.setScalar(0.2);
      trex.rotation.y = Math.PI / 3;

      scene.add(trex);

      const mixer = new THREE.AnimationMixer(trex);
      const clip = THREE.AnimationClip.findByName(gltf.animations, "run");
      if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
      }
      mixers.push(mixer);
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    function (error) {
      console.log("An error happened");
    }
  );

  // Load pterodactyl (flying dinosaur) model.
  loader.load("models/pterodactyl/scene.gltf", function (gltf) {
    pterodactyl = gltf.scene;

    pterodactyl.rotation.y = Math.PI / 2;
    pterodactyl.scale.multiplyScalar(4);

    respawnPterodactyl();

    scene.add(pterodactyl);

    const mixer = new THREE.AnimationMixer(pterodactyl);
    const clip = THREE.AnimationClip.findByName(gltf.animations, "flying");
    const action = mixer.clipAction(clip);
    action.play();
    mixers.push(mixer);
  });

  loader.load(
    "models/cactus/scene.gltf",
    function (gltf) {
      gltf.scene.scale.setScalar(0.05);
      gltf.scene.rotation.y = -Math.PI / 2;

      cactus = gltf.scene;
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    function (error) {
      console.log("An error happened");
    }
  );
}
load3DModels();

function createFloor() {
  const geometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
  const texture = THREE.ImageUtils.loadTexture("sand.jpg");
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xc4733b,
  });

  floor = new THREE.Mesh(geometry, material);
  floor.material.side = THREE.DoubleSide;
  floor.rotation.x = -Math.PI / 2;

  floor.castShadow = false;
  floor.receiveShadow = true;

  scene.add(floor);
}
createFloor();

function createSkySphere(file) {
  const geometry = new THREE.SphereGeometry(500, 60, 40);
  // Invert the geometry on the x-axis so that all of the faces point inward
  geometry.scale(-1, 1, 1);

  const texture = new THREE.TextureLoader().load(file);
  texture.encoding = THREE.sRGBEncoding;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  skySphere = new THREE.Mesh(geometry, material);

  scene.add(skySphere);
}
createSkySphere("desert.jpg");

function enableShadow(renderer, light) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  light.castShadow = true;

  //Set up shadow properties for the light
  light.shadow.mapSize.width = 512;
  light.shadow.mapSize.height = 512;
  light.shadow.camera.near = 0.001;
  light.shadow.camera.far = 500;
}
enableShadow(renderer, directionalLight);

function handleInput() {
  const callback = (event) => {
    if (isGameOver) {
      restartGame();
      return;
    }

    if (event.code === "Space") {
      jump = true;

      // const bgMusic = document.getElementById("bg-music");
      // bgMusic.play();
    }
  };

  document.addEventListener("keydown", callback, false);
  renderer.domElement.addEventListener("touchstart", callback);
  renderer.domElement.addEventListener("click", callback);

  // Listen for changes to the auto-jump feature checkbox
  // document
  //   .getElementById("autoJumpCheckbox")
  //   .addEventListener("change", function () {
  //     window.ENABLE_AUTO_JUMP = this.checked;
  //   });

  // Listen for changes to the T-Rex jump speed
  // document
  //   .getElementById("jumpSpeedInput")
  //   .addEventListener("input", function () {
  //     TREX_JUMP_SPEED = parseFloat(this.value);
  //   });

  // Get the audio element
  const bgMusic = document.getElementById("bg-music");

  // Listen for button clicks to toggle music
  document
    .getElementById("toggleMusicButton")
    .addEventListener("click", function () {
      if (bgMusic.paused) {
        bgMusic.play();
        toggleMusicButton.innerHTML = "Music: On";
      } else {
        bgMusic.pause();
        toggleMusicButton.innerHTML = "Music: Off";
      }
    });
}
handleInput();

function handleWindowResize() {
  window.addEventListener(
    "resize",
    () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    },
    false
  );
}
handleWindowResize();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function gameOver() {
  isGameOver = true;

  infoElement.innerHTML = "GAME OVER";

  const bgMusic = document.getElementById("bg-music");
  bgMusic.pause();
  bgMusic.currentTime = 0; // Optional: rewind audio for next playback
}

function restartGame() {
  isGameOver = false;
  score = 0;

  respawnPterodactyl();

  cactusGroup.children.length = 0;
}

function respawnPterodactyl() {
  nextPterodactylResetTime = clock.elapsedTime + PTERODACTYL_SPAWN_INTERVAL;
  pterodactyl.position.x = PTERODACTYL_SPAWN_X;
  pterodactyl.position.y = randomFloat(PTERODACTYL_MIN_Y, PTERODACTYL_MAX_Y);
}

function update(delta) {
  if (!cactus) return;
  if (!trex) return;
  if (!floor) return;
  if (!pterodactyl) return;
  if (isGameOver) return;

  for (const mixer of mixers) {
    mixer.update(delta);
  }

  // T-rex jump.
  if (jump) {
    jump = false;

    // Start jumpping only when T-rex is on the ground.
    if (trex.position.y == 0) {
      vel = TREX_JUMP_SPEED;
      trex.position.y = vel * delta;
    }
  }

  if (trex.position.y > 0) {
    vel += GRAVITY * delta;
    trex.position.y += vel * delta;
  } else {
    trex.position.y = 0;
  }

  // Spawn new cacti.
  if (clock.elapsedTime > nextCactusSpawnTime) {
    const interval = randomFloat(
      CACTUS_SPAWN_MIN_INTERVAL,
      CACTUS_SPAWN_MAX_INTERVAL
    );

    nextCactusSpawnTime = clock.elapsedTime + interval;

    const numCactus = randomInt(3, 5);
    for (let i = 0; i < numCactus; i++) {
      const clone = cactus.clone();
      clone.position.x = CACTUS_SPAWN_X + i * 0.5;
      clone.scale.multiplyScalar(
        randomFloat(CACTUS_MIN_SCALE, CACTUS_MAX_SCALE)
      );

      cactusGroup.add(clone);
    }
  }

  // Move cacti.
  for (const cactus of cactusGroup.children) {
    cactus.position.x += FLOOR_SPEED * delta;
  }

  // Remove out-of-the-screen cacti.
  while (
    cactusGroup.children.length > 0 &&
    cactusGroup.children[0].position.x < CACTUS_DESTROY_X // out of the screen
  ) {
    cactusGroup.remove(cactusGroup.children[0]);
  }

  // Check collision.
  const trexAABB = new THREE.Box3(
    new THREE.Vector3(-1, trex.position.y, 0),
    new THREE.Vector3(1, trex.position.y + 2, 0)
  );

  for (const cactus of cactusGroup.children) {
    const cactusAABB = new THREE.Box3();
    cactusAABB.setFromObject(cactus);

    if (cactusAABB.intersectsBox(trexAABB)) {
      gameOver();
      return;
    }
  }

  // Update texture offset to simulate floor moving.
  floor.material.map.offset.add(new THREE.Vector2(delta, 0));

  trex.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = false;
  });

  if (skySphere) {
    skySphere.rotation.y += delta * SKYSPHERE_ROTATE_SPEED;
  }

  if (clock.elapsedTime > nextPterodactylResetTime) {
    respawnPterodactyl();
  } else {
    pterodactyl.position.x += delta * PTERODACTYL_SPEED;
  }

  score += delta * SCORE_INCREASE_SPEED;
  infoElement.innerHTML = Math.floor(score).toString().padStart(5, "0");

  // Feature Flags
  const JUMP_TRIGGER_DISTANCE = 4; // Distance at which T-Rex should jump

  // logic to jump automatically
  (() => {
    if (!ENABLE_AUTO_JUMP) {
      return; // Exit if auto jump is disabled
    }

    // Check distance to incoming cacti and trigger jump if close enough
    for (const cactus of cactusGroup.children) {
      const distanceToTrex = cactus.position.x - trex.position.x;

      const shouldJump =
        distanceToTrex > 0 && distanceToTrex < JUMP_TRIGGER_DISTANCE;

      // If the cactus is within the trigger distance and the conditions meet, jump!
      if (shouldJump && trex.position.y === 0) {
        jump = true;
        break; // No need to check further cacti
      }
    }
  })();
}
