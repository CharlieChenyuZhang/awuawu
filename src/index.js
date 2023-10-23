import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import "@fontsource/press-start-2p";
import lofiBeatMp3 from "./sounds/lofi-beat.mp3";
import { Configuration, OpenAIApi } from "openai";

require("./main.css");
// configure openai
const configuration = new Configuration({
  apiKey: "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", // FIXME: don't commit this
});

let LEVEL = 1;
let pauseCactus = false;
let LEVEL2PauseOnce = false;

const LEVEL_1_PROMPT = `
Act as a teacher and help me analyze the sentence provided by the student.
If you detect them using the word 'high' or 'higher', say "try again".
If the overall meaning is not clear that the game character should jump higher, say "try again".
If the meaning of user's sentence is to jump higher without the usage of word high or higher, simply say "good job", for other meanings, say 'try again'.
Don't say antying else. Don't give them answers directly.

Below is what the user provided: 
`;

let cactusHitCount = 0;
let controlPanelOpen = false;
const TIMES_BEFORE_HINT = 3;

let showControlPanel = true;

const LEVEL_2_PROMPT = (
  ENABLE_AUTO_JUMP,
  TREX_JUMP_SPEED
) => `Act as a teaching assistant. Your task is to analyze student's input
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

Your analysis:`;

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

let GRAVITY = -50;
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
  console.log("!!! calling...", inputText);
  // return "result";

  if (LEVEL === 1) {
    try {
      // it saved the previous convo between the AI and bot
      const completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: LEVEL_1_PROMPT + inputText,
        temperature: 0.6,
        max_tokens: 200,
      });
      let what2say;
      let hasError = true;
      try {
        what2say = completion.data.choices[0].text;
        // what2say = JSON.parse(what2say.trim());
        console.log("what2say", what2say);
        hasError = false;

        // TODO: display try again

        if (what2say.toLowerCase().includes("good job")) {
          // move to the next level
          if (true || LEVEL === 1) {
            console.log("moving to the next level");
            // from level 1 to level 2, we increase the jump height
            TREX_JUMP_SPEED = 20;
            showControlPanel = false;

            // remove the contorlpanel
            var elementToRemove = document.getElementById("control-panel");

            elementToRemove.parentNode.removeChild(elementToRemove);

            controlPanelOpen = false;
            // from level 2 to level 3,

            restartGame();
            LEVEL++;
            return;
          }
        } else {
          const controlPanel = document.getElementById("control-panel");
          const errorMessage = document.createElement("div");
          errorMessage.innerText = "Not quite there yet. Please try again.";
          errorMessage.style.color = "red";

          controlPanel.append(errorMessage);
        }
      } catch (error) {
        // swallow the error, won't crash the program
        console.log("openai error", error);

        // TODO: display try again
      }

      // if (!hasError) {
      //   const new_ENABLE_AUTO_JUMP = what2say?.ENABLE_AUTO_JUMP;
      //   const new_TREX_JUMP_SPEED = what2say?.TREX_JUMP_SPEED;
      //   console.log("new ENABLE_AUTO_JUMP", new_ENABLE_AUTO_JUMP);
      //   console.log("new TREX_JUMP_SPEED", new_TREX_JUMP_SPEED);

      //   if (new_ENABLE_AUTO_JUMP !== ENABLE_AUTO_JUMP) {
      //     ENABLE_AUTO_JUMP = new_ENABLE_AUTO_JUMP;
      //   }

      //   if (new_TREX_JUMP_SPEED !== TREX_JUMP_SPEED) {
      //     TREX_JUMP_SPEED = new_TREX_JUMP_SPEED;
      //     // document.getElementById(
      //     //   "jumpHeight"
      //     // ).innerHTML = `T-Rex Jump Height: ${TREX_JUMP_SPEED}`;
      //   }
      // }

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
  } else if (LEVEL === 2) {
    // do nothing
    if (inputText.toLowerCase().includes("decrease")) {
      // from level 1 to level 2, we increase the jump height
      GRAVITY = -30;
      showControlPanel = false;

      // remove the contorlpanel
      var elementToRemove = document.getElementById("control-panel");

      elementToRemove.parentNode.removeChild(elementToRemove);

      controlPanelOpen = false;
      // from level 2 to level 3,
      pauseCactus = false;
      restartGame();
      LEVEL++;
      return;
    } else {
      // FIXME: show the error message
      const controlPanel = document.getElementById("control-panel");
      const errorMessage = document.createElement("div");
      errorMessage.innerText = "Not quite there yet. Please try again";
      errorMessage.style.color = "red";

      controlPanel.append(errorMessage);
    }
  } else {
    // do nothing
  }
}

function createControlPanelLevel() {
  const controlPanelLevel = document.createElement("div");
  controlPanelLevel.id = "control-panel-level";

  const levelLabel = document.createElement("div");
  levelLabel.id = "levelLabel";
  levelLabel.innerHTML = `Level: ${LEVEL}`;

  // Add them to the control panel
  // controlPanel.appendChild(autoJumpCheckbox);
  controlPanelLevel.appendChild(levelLabel);

  document.body.appendChild(controlPanelLevel);
}

createControlPanelLevel();

function createControlPanel() {
  controlPanelOpen = true;
  const controlPanel = document.createElement("div");
  controlPanel.id = "control-panel";

  // Create a div element for the typewritten text
  const typewriterText = document.createElement("div");
  typewriterText.id = "typewriter-text";
  controlPanel.appendChild(typewriterText);

  document.body.appendChild(controlPanel);

  const typewriterTextMandarin = document.createElement("div");
  typewriterTextMandarin.id = "typewriter-text-mando";
  controlPanel.appendChild(typewriterTextMandarin);

  document.body.appendChild(controlPanel);

  // Add them to the control panel
  controlPanel.appendChild(document.createElement("br"));
  // controlPanel.appendChild(jumpSpeedLabel);

  document.body.appendChild(controlPanel);

  // music control
  // Add a line break for separation
  controlPanel.appendChild(document.createElement("br"));

  document.body.appendChild(controlPanel);

  controlPanel.style.position = "fixed";
  controlPanel.style.top = "50%";
  controlPanel.style.left = "50%";
  controlPanel.style.transform = "translate(-50%, -50%)";
  controlPanel.style.backgroundColor = "white";
  controlPanel.style.padding = "20px";
  controlPanel.style.border = "1px solid #ccc";
  controlPanel.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
  controlPanel.style.zIndex = "999"; // Ensure it's on top of other elements
  // controlPanel.style.height = "60vh";

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

  // Text for the typewriting effect
  const textToType =
    "As you may have noticed, the T-Rex didn't jump very effectively and collided with the cacti. \
    Could you form a COMPLETE sentence to advise the T-Rex on how to jump in a way that avoids the cacti? Remember, don’t use the words 'high' or 'higher'. \
    Consider various expressions to convey this instruction. Please write your response in the text area below.";

  const textToTypeLv2 = `In physics, gravity plays a crucial role in determining how high different creatures, like a T-Rex dinosaur, can jump.
  Question: If you want the T-Rex to jump higher with the same amount of effort, should we increase or decrease the gravity?`;
  // TODO: T-Rex, try to leap in a way that allows you to clear the cacti successfully.

  const typewriterDelay = 20; // Adjust typing speed (milliseconds per character) FIXME: after testing, use 20
  let currentCharacter = 0;

  // Function to simulate typewriting effect
  function typeNextCharacter(input) {
    if (currentCharacter < input.length) {
      typewriterText.textContent += input.charAt(currentCharacter);
      currentCharacter++;
      setTimeout(() => typeNextCharacter(input), typewriterDelay);
    }
  }

  // Start the typewriting effect
  if (LEVEL === 1) {
    typeNextCharacter(textToType);
  } else if (LEVEL === 2) {
    typeNextCharacter(textToTypeLv2);
  }
}

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
    if (event.code === "Space" && !controlPanelOpen) {
      if (isGameOver) {
        restartGame();
        return;
      }

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
  // const bgMusic = document.getElementById("bg-music");

  // Listen for button clicks to toggle music
  // document
  //   .getElementById("toggleMusicButton")
  //   .addEventListener("click", function () {
  //     if (bgMusic.paused) {
  //       bgMusic.play();
  //       toggleMusicButton.innerHTML = "Music: On";
  //     } else {
  //       bgMusic.pause();
  //       toggleMusicButton.innerHTML = "Music: Off";
  //     }
  //   });
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

  // const bgMusic = document.getElementById("bg-music");
  // bgMusic.pause();
  // bgMusic.currentTime = 0; // Optional: rewind audio for next playback
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

    const numCactus = pauseCactus ? 0 : randomInt(3, 5);
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
      cactusHitCount++;
      if (cactusHitCount === TIMES_BEFORE_HINT) {
        cactusHitCount = 0;

        if (showControlPanel) {
          createControlPanel();
        }
      }
      gameOver();
      return;
    } else {
      // check the score
      if (score > 100 && !LEVEL2PauseOnce) {
        // update the level on the top right corner
        const levelLabel = document.getElementById("levelLabel");
        levelLabel.innerHTML = `Level: ${LEVEL}`;

        LEVEL2PauseOnce = true;
        pauseCactus = true;
        createControlPanel();
        cactusGroup.children.length = 0; // remove al lcactus
        // pase the score
      }
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
