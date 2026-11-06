import * as THREE from 'three';

// A thin gold outline around a jet, so a black airframe still reads against a
// dark sky and dark ground. Inverted hull: the back faces are pushed out along
// their normals by a fixed number of pixels, whatever the distance. Works on a
// plain Mesh and on an InstancedMesh.
//
// const mat = outlineMaterial({ color, px: 1.5 });  then  new THREE.Mesh(geo, mat)
// mat.setViewport(width, height)   // drawing-buffer pixels, each frame or on resize
export function outlineMaterial({ color, px = 1.5 } = {}) {
  const uRes = { value: new THREE.Vector2(1, 1) };
  const uWidth = { value: px };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uRes, uWidth },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform vec2 uRes;
      uniform float uWidth;
      void main() {
        mat4 mw = modelMatrix;
        #ifdef USE_INSTANCING
          mw = modelMatrix * instanceMatrix;
        #endif
        vec4 clip = projectionMatrix * viewMatrix * mw * vec4(position, 1.0);
        vec3 n = normalize(mat3(mw) * normal);
        vec2 dir = (projectionMatrix * viewMatrix * vec4(n, 0.0)).xy;
        float len = length(dir);
        if (len > 1e-6) clip.xy += dir / len * uWidth * 2.0 / uRes * clip.w;
        gl_Position = clip;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor;
      void main() {
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(uColor, 1.0);
      }`,
    side: THREE.BackSide,
  });
  mat.setViewport = (w, h) => uRes.value.set(w, h);
  mat.px = uWidth;
  return mat;
}
