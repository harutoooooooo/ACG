import * as THREE from 'three';
import { BaseEnvironment } from './BaseEnvironment.js';

import vertexShader from '../shaders/universe/universe.vert';
import windowFragmentShader from '../shaders/universe/window.frag';
import wallFragmentShader from '../shaders/universe/wall.frag';
import roofFragmentShader from '../shaders/universe/roof.frag';
import backgroundVertexShader from '../shaders/universe/background.vert';
import backgroundFragmentShader from '../shaders/universe/background.frag';

export class UniverseEnvironment extends BaseEnvironment {

    constructor(scene, renderer, camera, config) {
        super(scene, renderer, camera);
        this.config = config;
        this.backgroundMesh = null;
        this.wallMaterial = null;
        this.windowMaterial = null;
        this.roofMaterial = null;
        this.backgroundMaterial = null;
        this.starTexture = null;
    }

    // Generate a CubeMap texture with pre-computed star positions
    generateStarCubeMap(size, density) {
        const images = [];

        // Simple seeded random for reproducibility
        const seededRandom = (seed) => {
            const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        };

        // Generate star data for each face
        for (let face = 0; face < 6; face++) {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // black background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, size, size);

            // Grid-based star placement in 2D texture space
            const gridSize = 8; // pixels per cell
            const cellsPerSide = Math.floor(size / gridSize);

            for (let cellY = 0; cellY < cellsPerSide; cellY++) {
                for (let cellX = 0; cellX < cellsPerSide; cellX++) {
                    // Unique seed for this cell on this face
                    const cellSeed = face * 100000 + cellY * 1000 + cellX;
                    const r = seededRandom(cellSeed);

                    // Determine if this cell has a star based on density
                    if (r > density) continue;

                    // Star position within cell (random offset)
                    const starX = cellX * gridSize + seededRandom(cellSeed + 1) * gridSize;
                    const starY = cellY * gridSize + seededRandom(cellSeed + 2) * gridSize;

                    // Star brightness
                    const brightness = 3.0 * seededRandom(cellSeed);

                    // Star size
                    const starSize = seededRandom(cellSeed);

                    // Draw the star as a gradient circle
                    const gradient = ctx.createRadialGradient(starX, starY, 0, starX, starY, starSize);
                    const alpha = Math.floor(brightness * 255);
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${brightness})`);
                    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${brightness * 0.5})`);
                    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            images.push(canvas);
        }

        const cubeTexture = new THREE.CubeTexture(images);
        cubeTexture.needsUpdate = true;

        return cubeTexture;
    }

    init(sharedAssets) {
        const { shader, modelScale, backgroundRadius } = this.config;

        this.scene.background = new THREE.Color(0x000510);
        this.scene.fog = null;

        this.windowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uLightDirection: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
                uTime: { value: 0.0 }
            },
            vertexShader: vertexShader,
            fragmentShader: windowFragmentShader
        });

        this.wallMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uLightDirection: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
                uTime: { value: 0.0 },
                uCameraPosition: { value: new THREE.Vector3() } // Optional but good for specular if relying on view dir
            },
            vertexShader: vertexShader,
            fragmentShader: wallFragmentShader
        });

        this.roofMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uLightDirection: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
                uTime: { value: 0.0 }
            },
            vertexShader: vertexShader,
            fragmentShader: roofFragmentShader
        });

        this.starTexture = this.generateStarCubeMap(512, shader.starDensity);

        // planetarium-like shader material
        this.backgroundMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uStarTexture: { value: this.starTexture },
                uNebulaColor1: { value: new THREE.Color().fromArray(shader.nebulaColor1) },
                uNebulaColor2: { value: new THREE.Color().fromArray(shader.nebulaColor2) }
            },
            vertexShader: backgroundVertexShader,
            fragmentShader: backgroundFragmentShader,
            side: THREE.BackSide
        });

        // create background sphere
        const backgroundGeometry = new THREE.SphereGeometry(backgroundRadius, 64, 64);
        this.backgroundMesh = new THREE.Mesh(backgroundGeometry, this.backgroundMaterial);
        this.scene.add(this.backgroundMesh);

        // apply material to building model
        if (sharedAssets.buildingRoot) {
            sharedAssets.buildingRoot.scale.setScalar(modelScale);

            sharedAssets.buildingRoot.traverse((child) => {
                if (child.isMesh) {
                    const name = child.userData.originalMatName || '';
                    if (name.includes('roof')) {
                        child.material = this.roofMaterial;
                    } else if (name.includes('window')) {
                        child.material = this.windowMaterial;
                    } else {
                        child.material = this.wallMaterial;
                    }
                }
            });
            this.scene.add(sharedAssets.buildingRoot);
        }

        // space light (sun-like)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(100, 100, 50);
        sunLight.name = 'universeLight';
        this.scene.add(sunLight);

        const ambientLight = new THREE.AmbientLight(0x303050, 0.5);
        ambientLight.name = 'universeAmbient';
        this.scene.add(ambientLight);
    }

    update(elapsedTime) {
        if (this.windowMaterial) {
            this.windowMaterial.uniforms.uTime.value = elapsedTime;
        }
        // Wall material has no uniforms to update
        if (this.roofMaterial) {
            this.roofMaterial.uniforms.uTime.value = elapsedTime;
        }
        if (this.backgroundMaterial) {
            this.backgroundMaterial.uniforms.uTime.value = elapsedTime;
        }
    }

    dispose() {
        // remove background sphere
        if (this.backgroundMesh) {
            this.scene.remove(this.backgroundMesh);
            this.backgroundMesh.geometry.dispose();
            this.backgroundMesh = null;
        }

        // dispose materials
        if (this.wallMaterial) {
            this.wallMaterial.dispose();
            this.wallMaterial = null;
        }
        if (this.windowMaterial) {
            this.windowMaterial.dispose();
            this.windowMaterial = null;
        }
        if (this.roofMaterial) {
            this.roofMaterial.dispose();
            this.roofMaterial = null;
        }
        if (this.backgroundMaterial) {
            this.backgroundMaterial.dispose();
            this.backgroundMaterial = null;
        }
        if (this.starTexture) {
            this.starTexture.dispose();
            this.starTexture = null;
        }

        // remove lights
        const light = this.scene.getObjectByName('universeLight');
        if (light) this.scene.remove(light);

        const ambient = this.scene.getObjectByName('universeAmbient');
        if (ambient) this.scene.remove(ambient);
    }
}
