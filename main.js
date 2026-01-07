import * as THREE from 'three';

// Scene setup
// -----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x808080);

// Camera setup
// ------------
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 2;

// Renderer setup
// --------------
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Geometry (VBO) setup
// --------------------
const geometry = new THREE.BoxGeometry(1, 1, 1);

// Material (Shader) setup
// -----------------------
const material = new THREE.ShaderMaterial({
    uniforms: {
        uLightDirection: { value: new THREE.Vector3(1.0, 1.0, 1.0).normalize() },
        uColor: { value: new THREE.Color(0x00aaff) },
        uSpecularColor: { value: new THREE.Color(0xffffff) },
        uShininess: { value: 32.0 }
    },

    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;

        void main() {
            vNormal = normalize(normalMatrix * normal);

            vec4 FragPos = modelViewMatrix * vec4(position, 1.0);
            vViewPos = -FragPos.xyz;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform vec3 uLightDirection;
        uniform vec3 uColor;
        uniform vec3 uSpecularColor;
        uniform float uShininess;

        varying vec3 vNormal;
        varying vec3 vViewPos;

        void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPos);

            // ambient
            vec3 ambient = vec3(0.1) * uColor;

            // diffuse
            float diff = max(0.0, dot(normal, uLightDirection));
            vec3 diffuse = diff * uColor;

            // specular
            vec3 reflectDir = reflect(-uLightDirection, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
            vec3 specular = spec * uSpecularColor;

            // result
            vec3 result = ambient + diffuse + specular;

            gl_FragColor = vec4(result, 1.0);
        }
    `
});

// Mesh (VBO + Shader) setup
// -------------------------
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Rendering loop
// --------------
function animate(){
    requestAnimationFrame(animate);

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    renderer.render(scene, camera);
}

animate();

// Handle window resize
// --------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});