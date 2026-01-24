uniform float uTime;
uniform vec3 uNebulaColor1;
uniform vec3 uNebulaColor2;
uniform samplerCube uStarTexture;
uniform samplerCube uNebulaTexture;

varying vec2 vUv;
varying vec3 vWorldPos;

// --- Hash ---
float hash31(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
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
    // Sample pre-computed nebula pattern
    vec3 nebulaSample = textureCube(uNebulaTexture, dir).rgb;
    
    // n1 in R, n2 in G, mask in B
    float n2 = nebulaSample.g;
    float nebulaMask = nebulaSample.b;
    
    // Color mixing based on n2
    vec3 color = mix(uNebulaColor1, uNebulaColor2, n2);

    float intensity = 0.4;
    
    return color * nebulaMask * intensity;
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
