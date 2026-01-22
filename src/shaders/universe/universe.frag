uniform vec3 uLightDirection;
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uEmissiveColor;
uniform float uMetallic;

varying vec3 vNormal;
varying vec3 vFragPos;

// --- Noise Functions ---
float hash(vec3 p) { 
    p = fract(p * 0.3183099 + .1); 
    p *= 17.0; 
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); 
}

float noise(vec3 x) { 
    vec3 i = floor(x); 
    vec3 f = fract(x); 
    f = f * f * (3.0 - 2.0 * f); 
    return mix(
        mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x), 
            mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y), 
        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), 
            mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), 
        f.z); 
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 pos = vFragPos;

    // metallic panel pattern
    float panel = noise(pos * 0.5);
    float edge = abs(fract(pos.x * 0.1) - 0.5) * abs(fract(pos.y * 0.1) - 0.5);
    edge = smoothstep(0.0, 0.02, edge);

    // lighting
    float diff = max(0.0, dot(normal, uLightDirection));
    diff = diff * 0.6 + 0.4; // add ambient

    // specular
    vec3 viewDir = normalize(-vFragPos);
    vec3 reflectDir = reflect(-uLightDirection, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 4.0);
    spec *= uMetallic;

    // emissive
    float emissive = smoothstep(0.6, 0.8, panel);
    emissive *= sin(uTime * 2.0 + pos.x * 0.5 + pos.y * 0.3) * 0.3 + 0.7;

    vec3 baseColor = uBaseColor * diff + vec3(0.8) * spec;
    vec3 result = mix(baseColor, uEmissiveColor, emissive * 0.5) * edge;
    result += uEmissiveColor * emissive * 0.3;

    gl_FragColor = vec4(result, 1.0);
}
