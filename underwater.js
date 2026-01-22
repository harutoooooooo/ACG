import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Boid } from './boid.js';

import vertexShader from './shaders/shader.vert';
import buildingFragmentShader from './shaders/underwater.frag';
import fishVertexShader from './shaders/fish.vert';
import fishFragmentShader from './shaders/fish.frag';

const CAMERA_FOV = 75;
const CAMERA_NEAR = 1.0;
const CAMERA_FAR = 1000.0;
const CAMERA_POSITION = new THREE.Vector3(140, 65, 80);

// Scene setup
const scene = new THREE.Scene();
const deepWaterColor = new THREE.Color('#001e33');
scene.background = deepWaterColor;

// Camera setup
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
camera.position.copy(CAMERA_POSITION);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
};

const clock = new THREE.Clock();

// --- 建物 ---
function setupMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uLightDirection: { value: new THREE.Vector3(1.0, 1.0, 1.0).normalize() },
            uDeepWaterColor: { value: deepWaterColor },
            uShallowWaterColor: { value: new THREE.Color('#006699') },
            uCausticColor: { value: new THREE.Color('#ffffff') },
            uRockColor: {value: new THREE.Color('#341c00')},
            uSedimentColor: {value: new THREE.Color('#000000')},
            uFogNear: { value: 0.0 },
            uFogFar: { value: 250.0 },
            uFogDensity: { value: 5.0 },
            uFogMax: { value: 1.0 },

            uTime: { value: 0.0 },
            uScale: { value: 2.0 }, // 建物の模様サイズ
        },
        vertexShader: vertexShader,
        fragmentShader: buildingFragmentShader
    });
}

// 建物のロード
let obstacles = [];
new GLTFLoader().load('/rikocamtex.glb', (gltf) => {
    const obj = gltf.scene;
    obj.traverse((child) => {
        if (child.isMesh) {
            child.material = setupMaterial();
            obstacles.push(child);
        }
    });
    obj.scale.set(1, 1, 1);
    scene.add(obj);
});

// --- 魚の群れ ---
const FISH_COUNT = 1000;
const boids = [];
const boundSize = { w: 450, h: 100, d: 180 }; // 魚が泳ぐ範囲
const speeds = new Float32Array(FISH_COUNT);
const offsets = new Float32Array(FISH_COUNT);
const scales = new Float32Array(FISH_COUNT);
const dummy = new THREE.Object3D();

for (let i = 0; i < FISH_COUNT; i++) {
    boids.push(new Boid(boundSize.w, boundSize.h, boundSize.d, i));
}

const fishGeometry = new THREE.ConeGeometry(0.3, 1.2, 8);
fishGeometry.rotateX(Math.PI / 2);

const fishMaterial = new THREE.ShaderMaterial({
    vertexShader: fishVertexShader,
    fragmentShader: fishFragmentShader,
    uniforms: { uTime: { value: 0.0 } },
    side: THREE.DoubleSide
});

const fishMesh = new THREE.InstancedMesh(fishGeometry, fishMaterial, FISH_COUNT);
scene.add(fishMesh);

// 魚の初期位置
for (let i = 0; i < FISH_COUNT; i++) {
    // 魚のクネクネの設定
    speeds[i] = 0.5 + Math.random() * 0.5;
    offsets[i] = Math.random() * Math.PI * 2;
    scales[i] = 1.0 + Math.random() * 1.2;

    dummy.position.copy(boids[i].position);
    dummy.scale.setScalar(scales[i]);
    dummy.updateMatrix();
    fishMesh.setMatrixAt(i, dummy.matrix);
}

fishGeometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
fishGeometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 1));

const raycaster = new THREE.Raycaster();

// --- アニメーション ---
function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    fishMaterial.uniforms.uTime.value = elapsedTime;
    scene.traverse((child) => {
        if (child.isMesh && child.material.uniforms && child.material.uniforms.uTime) {
            child.material.uniforms.uTime.value = elapsedTime;
        }
    });

    const hasObstacles = obstacles.length > 0;

    for (let i = 0; i < FISH_COUNT; i++) {
        const boid = boids[i];

        // 群れの動きを計算し更新
        boid.flock(boids);
        if (hasObstacles) {
            boid.avoidObstacles(raycaster, obstacles);
        }
        boid.update();

        // Shaderに魚の位置を渡す
        dummy.position.copy(boid.position);
        const velocity = boid.velocity;
        if (velocity.lengthSq() > 0.0001) {
            dummy.lookAt(dummy.position.clone().add(velocity));
        }

        dummy.scale.setScalar(scales[i]);
        dummy.updateMatrix();
        fishMesh.setMatrixAt(i, dummy.matrix);
    }

    fishMesh.instanceMatrix.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});