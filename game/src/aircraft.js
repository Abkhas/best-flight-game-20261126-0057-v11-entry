// aircraft.js — EMBERLINE 11: the twin-prop seaplane tanker, built from primitives.
// Fresh code, written for v11. The right engine carries the damage: scorched
// cowling + a smoke trail once the engine is hit. Props spin in the render loop.
import * as THREE from 'three';

export function createAircraft() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.55, metalness: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc22e1a, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.6 });
  const scorch = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.95, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.35, metalness: 0.7 });

  // fuselage: a long cylinder + nose + tail cone
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.6, 16, 12), white);
  fus.rotation.x = Math.PI / 2;
  fus.position.set(0, 0, 0);
  group.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), white);
  nose.scale.set(1, 1, 1.4);
  nose.position.set(0, 0, 8.6);
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 12), white);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0.4, -11);
  group.add(tail);
  // red cheatline stripe along the fuselage
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.7, 15.5), red);
  stripe.position.set(0, -0.4, 0.2);
  group.add(stripe);
  // cockpit windows
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 3.2), glass);
  canopy.position.set(0, 1.9, 5.6);
  group.add(canopy);
  // main wing (high wing) + red tips
  const wing = new THREE.Mesh(new THREE.BoxGeometry(30, 0.7, 5.2), white);
  wing.position.set(0, 1.6, 0.5);
  group.add(wing);
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 5.2), red);
    tip.position.set(sx * 14.2, 1.6, 0.5);
    group.add(tip);
    // drooped flap on the left wing (damage character)
    if (sx === -1) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 2.2), red);
      flap.position.set(-10.5, 1.1, 2.6);
      flap.rotation.x = 0.5;
      group.add(flap);
    }
  }
  // tailplane + fin
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 3.2), white);
  hstab.position.set(0, 1.2, -12.5);
  group.add(hstab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.5, 4.5), red);
  fin.position.set(0, 3.2, -12.8);
  group.add(fin);
  // floats (seaplane): two pontoons
  for (const sx of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 11, 8), white);
    float.rotation.x = Math.PI / 2;
    float.position.set(sx * 3.4, -2.6, 1);
    group.add(float);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.8), steel);
    strut.position.set(sx * 3.4, -1.4, 1);
    group.add(strut);
  }
  // engines: nacelles under the wings + propellers
  const props = [];
  const engines = {};
  for (const sx of [-1, 1]) {
    const side = sx < 0 ? 'left' : 'right';
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.3, 5.5, 10), sx < 0 ? white : white);
    nac.rotation.x = Math.PI / 2;
    nac.position.set(sx * 6.5, 0.6, 1.2);
    group.add(nac);
    // cowling ring (red on the left, scorched on the right once damaged)
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.7, 10), red);
    cowl.rotation.x = Math.PI / 2;
    cowl.position.set(sx * 6.5, 0.6, 3.8);
    group.add(cowl);
    engines[side] = { cowl, scorchMat: scorch };
    // propeller: hub + 3 blades
    const prop = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8), dark);
    hub.rotation.x = Math.PI / 2;
    prop.add(hub);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.6, 0.18), dark);
      blade.position.y = 2.6;
      const holder = new THREE.Group();
      holder.rotation.z = (b * Math.PI * 2) / 3;
      holder.add(blade);
      prop.add(holder);
    }
    prop.position.set(sx * 6.5, 0.6, 4.4);
    group.add(prop);
    props.push(prop);
  }
  // damage smoke: a small grey cone behind the right engine, hidden until hit
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x55504a, transparent: true, opacity: 0.6, roughness: 1 });
  const dmgSmoke = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 8), smokeMat);
  dmgSmoke.rotation.x = -Math.PI / 2 - 0.5;
  dmgSmoke.position.set(6.5, 0.4, -3.5);
  dmgSmoke.visible = false;
  group.add(dmgSmoke);

  return {
    group, props, engines, dmgSmoke,
    setDamaged(damaged) {
      engines.right.cowl.material = damaged ? scorch : red;
      dmgSmoke.visible = damaged;
    },
  };
}

// Apply a flight state to the aircraft group (heading deg, bank deg, pitch deg).
export function poseAircraft(ac, st) {
  const g = ac.group;
  g.position.set(st.x, st.alt, st.z);
  // THREE: rotation order YXZ so heading (yaw) applies first, then pitch, then bank.
  g.rotation.order = 'YXZ';
  g.rotation.y = THREE.MathUtils.degToRad(-st.hdg);
  g.rotation.x = THREE.MathUtils.degToRad(-st.pitch);
  g.rotation.z = THREE.MathUtils.degToRad(st.bank);
}
