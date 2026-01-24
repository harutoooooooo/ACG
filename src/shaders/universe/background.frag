uniform float uTime;
uniform vec3 uNebulaColor1;
uniform vec3 uNebulaColor2;
uniform samplerCube uStarTexture;

varying vec2 vUv;
varying vec3 vWorldPos;

// --- Hash & Noise ---
float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float hash31(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
}

float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash31(i);
    float b = hash31(i + vec3(1, 0, 0));
    float c = hash31(i + vec3(0, 1, 0));
    float d = hash31(i + vec3(1, 1, 0));
    float e = hash31(i + vec3(0, 0, 1));
    float f1 = hash31(i + vec3(1, 0, 1));
    float g = hash31(i + vec3(0, 1, 1));
    float h = hash31(i + vec3(1, 1, 1));
    
    return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
               mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// --- Stars ---
float stars(vec3 dir) {
    float starBrightness = textureCube(uStarTexture, dir).r;
    
    // twinkle effect
    float twinklePhase = hash31(floor(dir * 300.0)) * 6.28;
    float twinkleSpeed = 2.0 + hash31(floor(dir * 300.0) + 1.0) * 4.0;
    float twinkle = 0.7 + 0.3 * sin(uTime * twinkleSpeed + twinklePhase);
    
    return starBrightness * twinkle;
}

// --- Nebula ---
vec3 nebula(vec3 dir) {
    vec3 p = dir * 2.0;
    
    float n1 = fbm(p + vec3(uTime * 0.01, 0.0, 0.0));
    float n2 = fbm(p * 1.5 + vec3(0.0, uTime * 0.015, 0.0));
    
    float nebulaMask = smoothstep(0.3, 0.7, n1 * n2);
    
    vec3 color = mix(uNebulaColor1, uNebulaColor2, n2);
    
    return color * nebulaMask * 0.4;
}

void main() {
    vec3 dir = normalize(vWorldPos);
    
    // deep space color
    vec3 deepSpace = vec3(0.02, 0.01, 0.05);
    
    // stars
    float starField = stars(dir);
    
    // nebula
    vec3 nebulaColor = nebula(dir);
    
    // result
    vec3 result = deepSpace + nebulaColor + vec3(starField);
    
    gl_FragColor = vec4(result, 1.0);
}
