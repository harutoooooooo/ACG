import * as THREE from 'three';
import { BaseEnvironment } from './BaseEnvironment.js';

import vertexShader from '../shaders/universe/universe.vert';
import fragmentShader from '../shaders/universe/universe.frag';
import backgroundVertexShader from '../shaders/universe/background.vert';
import backgroundFragmentShader from '../shaders/universe/background.frag';

export class UniverseEnvironment extends BaseEnvironment {

    constructor(scene, renderer, camera, config) {
        super(scene, renderer, camera);
        this.config = config;
        this.backgroundMesh = null;
        this.buildingMaterial = null;
        this.backgroundMaterial = null;
    }

    init(sharedAssets) {
        const { shader, modelScale, backgroundRadius } = this.config;

        // set background to black
        this.scene.background = new THREE.Color(0x000510);
        this.scene.fog = null;

        // building shader material
        this.buildingMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uLightDirection: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
                uTime: { value: 0.0 },
                uBaseColor: { value: new THREE.Color().fromArray(shader.baseColor) },
                uEmissiveColor: { value: new THREE.Color().fromArray(shader.emissiveColor) },
                uMetallic: { value: shader.metallic }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });

        // planetarium-like shader material
        this.backgroundMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uStarDensity: { value: shader.starDensity },
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
                    child.material = this.buildingMaterial;
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
        if (this.buildingMaterial) {
            this.buildingMaterial.uniforms.uTime.value = elapsedTime;
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
        if (this.buildingMaterial) {
            this.buildingMaterial.dispose();
            this.buildingMaterial = null;
        }
        if (this.backgroundMaterial) {
            this.backgroundMaterial.dispose();
            this.backgroundMaterial = null;
        }

        // remove lights
        const light = this.scene.getObjectByName('universeLight');
        if (light) this.scene.remove(light);

        const ambient = this.scene.getObjectByName('universeAmbient');
        if (ambient) this.scene.remove(ambient);
    }
}
