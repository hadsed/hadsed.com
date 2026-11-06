// Camera rig: two shots of the same jet and one continuous move between them.
//
//   orbit  the site backdrop: a long lens off the right wing, looking back along
//          the fuselage, drifting slowly around the jet. Level horizon.
//   chase  flying: behind and above, lagging the jet, horizon tilting with the bank.
//
// rig.blend eases toward rig.target (0 = orbit, 1 = chase). Both poses are
// computed every frame and the camera is interpolated between them in polar
// form around the jet, so the move swings around the wing instead of cutting
// through the fuselage, and the lens opens up as the camera closes in.
//
// const rig = createCameraRig(camera);
// rig.update(jetPos, jetQuat, dt, aspect);   // jetPos: Vector3, jetQuat: Quaternion
// rig.target = 1;                            // glide into the chase cam
// rig.orbit.yaw = 0.2;                       // offsets from site gestures, radians
import * as THREE from 'three';

// The backdrop lab's framing, measured on its proxy jet (24.5 m long) and scaled
// up to the real one (32.7 m): camera at (52, 14, -49) off a target 1 m aft.
const LAB_SCALE = 32.7 / 24.5;
const ORBIT_OFFSET = new THREE.Vector3(52, 14, -49).multiplyScalar(LAB_SCALE);
const ORBIT_TARGET = new THREE.Vector3(0, 0, 1).multiplyScalar(LAB_SCALE);

// Chase pose in the jet's frame, meters: behind, above, look-ahead. On boost
// the camera falls back and the lens opens, so the burst reads as speed.
export const CHASE = { back: 46, up: 15, look: 34, boostBack: 74, boostUp: 19, boostLens: 9 };

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createCameraRig(camera, {
  orbitLens = 23,          // vertical degrees, the backdrop's lens
  chaseLens = 55,
  portraitChaseLens = 70,
  drift = 0.0021,          // rad/s around the jet; the lab's "drift 0.02"
  glide = 2.8,             // seconds for a full orbit -> chase move
} = {}) {
  const rig = {
    blend: 1, target: 1,                    // chase by default; the backdrop sets both to 0
    boosting: false,                        // set each frame; eases the boost pull-back in and out
    focus: null,                            // a Vector3 to keep in frame too (the jet you follow), or null
    orbit: { yaw: 0, pitch: 0, spin: 0 },   // yaw/pitch: gesture offsets; spin: accumulated drift
    get moving() { return rig.blend !== rig.target; },
    // Snap the chase cam onto the jet (respawn, first frame).
    reset() { ready = false; },
    update,
  };

  // Chase state. The offsets are smoothed relative to the jet, not in world space:
  // world-space smoothing let the camera fall back by speed / rate (about 150 m
  // at Mach 2.7, more on boost), which left the jet a speck 200 m ahead.
  const camOff = new THREE.Vector3(), lookOff = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let ready = false, bk = 0, fw = 0;
  const focusPt = new THREE.Vector3();
  // The orbit follows the jet's heading slowly, so autopilot turns don't whip it around.
  let heading = null;

  const fwd = new THREE.Vector3(), up = new THREE.Vector3(), v = new THREE.Vector3();
  const oPos = new THREE.Vector3(), oLook = new THREE.Vector3();
  const a = new THREE.Spherical(), b = new THREE.Spherical(), c = new THREE.Spherical();
  const look = new THREE.Vector3(), upv = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  function update(jetPos, jetQ, dt, aspect = camera.aspect) {
    // ---- chase pose (always tracked, so arriving at it is seamless) ----
    fwd.set(0, 0, -1).applyQuaternion(jetQ);
    up.set(0, 1, 0).applyQuaternion(jetQ);
    // Boost pull-back: quick to open up, slower to settle back in.
    bk += ((rig.boosting ? 1 : 0) - bk) * (1 - Math.exp(-dt * (rig.boosting ? 2.2 : 1.2)));
    const back = CHASE.back + (CHASE.boostBack - CHASE.back) * bk, high = CHASE.up + (CHASE.boostUp - CHASE.up) * bk;
    v.copy(fwd).multiplyScalar(-back).addScaledVector(up, high);
    camOff.lerp(v, ready ? 1 - Math.exp(-dt * 6) : 1);
    lookOff.lerp(v.copy(fwd).multiplyScalar(CHASE.look), ready ? 1 - Math.exp(-dt * 10) : 1);
    camUp.lerp(up, ready ? 1 - Math.exp(-dt * 3) : 1).normalize();
    camPos.copy(jetPos).add(camOff);
    camLook.copy(jetPos).add(lookOff);
    // Following: swing the eye toward the leader so it stays on screen, framing
    // both jets, and pull back a little so both fit.
    fw += ((rig.focus ? 1 : 0) - fw) * (1 - Math.exp(-dt * 1.5));
    if (rig.focus) focusPt.copy(rig.focus);
    if (fw > 0.001) {
      camLook.lerp(focusPt, 0.5 * fw);
      camPos.addScaledVector(camOff, 0.35 * fw);
    }

    // ---- orbit pose, in the jet's (smoothed) heading frame ----
    const h = Math.atan2(-fwd.x, -fwd.z);
    heading = heading === null || !ready ? h : heading + wrap(h - heading) * (1 - Math.exp(-dt / 20));   // very slow: the backdrop pans, never swings
    ready = true;
    rig.orbit.spin += drift * dt;
    const yaw = heading + rig.orbit.spin + rig.orbit.yaw;
    oPos.copy(ORBIT_OFFSET).applyAxisAngle(yAxis, yaw);
    a.setFromVector3(oPos);
    a.phi = THREE.MathUtils.clamp(a.phi - rig.orbit.pitch, 0.05, Math.PI - 0.05);
    oLook.copy(ORBIT_TARGET).applyAxisAngle(yAxis, yaw).add(jetPos);

    // ---- blend ----
    if (rig.blend !== rig.target) {
      const step = dt / glide;
      rig.blend = rig.target > rig.blend ? Math.min(rig.target, rig.blend + step) : Math.max(rig.target, rig.blend - step);
    }
    const k = ease(rig.blend);
    if (k <= 0) {
      camera.position.setFromSpherical(a).add(jetPos);
      look.copy(oLook); upv.copy(yAxis);
    } else if (k >= 1) {
      camera.position.copy(camPos);
      look.copy(camLook); upv.copy(camUp);
    } else {
      b.setFromVector3(camOff);
      // Polar interpolation around the jet: radius, elevation and the short way round in azimuth.
      c.radius = a.radius + (b.radius - a.radius) * k;
      c.phi = a.phi + (b.phi - a.phi) * k;
      c.theta = a.theta + wrap(b.theta - a.theta) * k;
      camera.position.setFromSpherical(c).add(jetPos);
      // Keep looking at the jet until late in the move, then lift the eye ahead of it.
      look.lerpVectors(oLook, camLook, k * k);
      upv.lerpVectors(yAxis, camUp, k * k).normalize();
    }
    camera.up.copy(upv);
    camera.lookAt(look);

    // Lens: the backdrop widens in portrait so the jet fits, the chase cam too.
    const portrait = aspect < 1;
    const oFov = portrait ? orbitLens * Math.min(1.8, 1 / aspect) : orbitLens;
    const cFov = (portrait ? portraitChaseLens : chaseLens) + CHASE.boostLens * bk;
    const fov = oFov + (cFov - oFov) * k;
    if (Math.abs(camera.fov - fov) > 1e-4 || camera.aspect !== aspect) {
      camera.fov = fov; camera.aspect = aspect; camera.updateProjectionMatrix();
    }
    return k;
  }

  return rig;
}
