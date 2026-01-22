varying vec3 vNormal;
varying vec3 vFragPos;
// varying vec3 vColor;

#include <fog_pars_vertex>

void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vFragPos = (modelMatrix * vec4(position, 1.0)).xyz;
    // vColor = color.rgb;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
}