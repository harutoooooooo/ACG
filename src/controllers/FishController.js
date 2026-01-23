import * as THREE from 'three';
import { Boid } from '../entities/Boid.js';

import fishVertexShader from '../shaders/underwater/fish.vert';
import fishFragmentShader from '../shaders/underwater/fish.frag';

export class FishController {
    constructor(scene, config, lightingUniforms = {}) {
        this.scene = scene;
        this.config = config;
        this.lightingUniforms = lightingUniforms;
        this.raycaster = new THREE.Raycaster();
        this.count = config.fish?.count ?? 500;
        this.boids = [];
        this.mesh = null;
        this.dummy = new THREE.Object3D();
        this.scales = new Float32Array(this.count);
        this.obstacles = [];

        this.init();
    }

    setObstacles(obstacles) {
        this.obstacles = obstacles;
    }

    createFishGeometry(length = 1.0, radius = 0.3) {
        // コンフィグ値またはデフォルト値を使用
        const geometry = new THREE.BufferGeometry();

        const noseZ = length * 0.5;
        const tailBaseZ = -length * 0.3;
        const tailTipZ = -length * 0.8;
        const bodyW = radius * 0.6;
        const bodyH = radius;
        const tailH = radius * 1.5;

        const vertices = [
            // 鼻先
            0, 0, noseZ,
            // 背中
            0, bodyH, 0,
            // お腹
            0, -bodyH, 0,
            // 左側面
            bodyW, 0, 0,
            // 右側面
            -bodyW, 0, 0,
            // 尻尾の付け根
            0, 0, tailBaseZ,
            // 尻尾の上端
            0, tailH, tailTipZ,
            // 尻尾の下端
            0, -tailH, tailTipZ
        ];

        const indices = [
            // 頭部〜胴体
            0, 3, 1,  0, 1, 4,
            0, 2, 3,  0, 4, 2,

            // 胴体後ろ
            1, 3, 5,  4, 1, 5,
            3, 2, 5,  2, 4, 5,

            // 尻尾
            5, 6, 7
        ];

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    init() {
        const { bounds, fish, boid } = this.config;
        const boundSize = {
            w: bounds?.width,
            h: bounds?.height,
            d: bounds?.depth
        };
        const speeds = new Float32Array(this.count);
        const offsets = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            this.boids.push(new Boid(boundSize.w, boundSize.h, boundSize.d, i, boid));
        }

        const meshRadius = fish?.meshRadius ?? 0.3;
        const meshLength = fish?.meshLength ?? 1.2;
        const fishGeometry = this.createFishGeometry(meshLength, meshRadius);

        // 共通ライティングuniformsを使用
        const fishMaterial = new THREE.ShaderMaterial({
            vertexShader: fishVertexShader,
            fragmentShader: fishFragmentShader,
            uniforms: {
                ...THREE.UniformsLib.fog,
                ...this.lightingUniforms,
                uTime: { value: 0.0 }
            },
            side: THREE.DoubleSide,
            fog: true
        });

        // 魚の初期位置
        for (let i = 0; i < this.count; i++) {
            // アニメーション用
            speeds[i] = 0.5 + Math.random() * 0.5;
            offsets[i] = Math.random() * Math.PI * 2;

            // 全体のスケール（年齢/大きさ）のみランダム
            this.scales[i] = (fish.baseScale || 1.0) * (0.8 + Math.random() * 0.4);

            this.dummy.position.copy(this.boids[i].position);
            this.dummy.scale.setScalar(this.scales[i]);
            this.dummy.updateMatrix();
        }

        fishGeometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
        fishGeometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 1));

        this.mesh = new THREE.InstancedMesh(fishGeometry, fishMaterial, this.count);

        for (let i = 0; i < this.count; i++) {
             this.dummy.position.copy(this.boids[i].position);
             this.dummy.scale.setScalar(this.scales[i]);
             this.dummy.updateMatrix();
             this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.scene.add(this.mesh);
    }

    update(time) {
        if(!this.mesh) {
            return;
        }

        this.mesh.material.uniforms.uTime.value = time;

        for (let i = 0; i < this.count; i++) {
            const boid = this.boids[i];

            // 群れの動きを計算し更新
            boid.flock(this.boids);
            boid.avoidObstacles(this.raycaster, this.obstacles);
            boid.update();

            // Shaderに魚の位置を渡す
            this.dummy.position.copy(boid.position);
            const velocity = boid.velocity;
            if (velocity.lengthSq() > 0.0001) {
                this.dummy.lookAt(this.dummy.position.clone().add(velocity));
            }

            this.dummy.scale.setScalar(this.scales[i]);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.boids = [];
        this.obstacles = [];
    }
}