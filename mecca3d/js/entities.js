// Car, walking character and camera rig.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

const TAU = Math.PI * 2;
function angLerp(a, b, t) { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; }
const fwdOf = (h) => [Math.sin(h), -Math.cos(h)];
const rightOf = (h) => [Math.cos(h), Math.sin(h)];

export class Car {
  constructor(world) {
    this.world = world; this.D = world.D;
    this.x = 0; this.z = 70; this.h = Math.PI; this.v = 0; this.steer = 0; this.y = 0; this.pitch = 0; this.roll = 0;
    this.offRoad = false; this.wheelRot = 0;
    const g = this.group = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: 0xf1efe8 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1b2633 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x151515 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 4.5), white); body.position.set(0, 0.7, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.3), glass); cab.position.set(0, 1.35, 0.35);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.1), white); roof.position.set(0, 1.69, 0.35);
    g.add(body, cab, roof);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff1c9 }), tail = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    for (const sx of [-0.7, 0.7]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), lamp); l.position.set(sx, 0.78, -2.27);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), tail); t.position.set(sx, 0.82, 2.27);
      g.add(l, t);
    }
    this.wheels = [];
    const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14); wg.rotateZ(Math.PI / 2);
    for (const [sx, sz] of [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]]) {
      const w = new THREE.Mesh(wg, dark); w.position.set(sx, 0.36, sz); g.add(w); this.wheels.push(w);
    }
    this.spot = new THREE.SpotLight(0xfff2cc, 0, 110, 0.55, 0.6, 1.2);
    this.spot.position.set(0, 1, -2); this.spot.target.position.set(0, 0, -30);
    g.add(this.spot, this.spot.target);
    world.scene.add(g);
    this.place(this.x, this.z, this.h);
  }
  place(x, z, h) {
    this.x = x; this.z = z; this.h = h; this.v = 0; this.steer = 0;
    this._ground(true); this._apply();
  }
  _ground(snap) {
    const D = this.D, [fx, fz] = fwdOf(this.h), [rx, rz] = rightOf(this.h);
    const f = D.groundAt(this.x + fx * 1.4, this.z + fz * 1.4), b = D.groundAt(this.x - fx * 1.4, this.z - fz * 1.4);
    const l = D.groundAt(this.x - rx * 0.9, this.z - rz * 0.9), r = D.groundAt(this.x + rx * 0.9, this.z + rz * 0.9);
    const y = (f + b + l + r) / 4, pitch = Math.atan2(f - b, 2.8), roll = Math.atan2(l - r, 1.8);
    if (snap) { this.y = y; this.pitch = pitch; this.roll = roll; }
    else { this.y = lerp(this.y, y, 0.35); this.pitch = lerp(this.pitch, pitch, 0.25); this.roll = lerp(this.roll, roll, 0.25); }
  }
  _apply() {
    const g = this.group;
    g.position.set(this.x, this.y, this.z);
    g.rotation.set(0, 0, 0);
    g.rotation.order = 'YXZ';
    g.rotation.y = -this.h; g.rotation.x = this.pitch; g.rotation.z = this.roll;
    for (let i = 0; i < 4; i++) {
      this.wheels[i].rotation.x = this.wheelRot;
      if (i < 2) this.wheels[i].rotation.y = -this.steer * 0.5;
    }
    this.spot.intensity = this.world.night > 0.35 ? 500 * this.world.night : 0;
  }
  _blocked(x, z) {
    const [fx, fz] = fwdOf(this.h), [rx, rz] = rightOf(this.h), W = this.world;
    for (const [s, q] of [[0, 0], [2.2, 0.95], [2.2, -0.95], [-2.2, 0.95], [-2.2, -0.95], [2.3, 0], [-2.3, 0]]) {
      if (W.hitBuilding(x + fx * s + rx * q, z + fz * s + rz * q)) return true;
    }
    return false;
  }
  update(dt, inp, active) {
    let thr = active ? inp.throttle : 0, st = active ? inp.steer : 0, brake = active ? inp.brake : false;
    const near = this.D.idx.nearest(this.x, this.z, 14, { drv: true });
    this.offRoad = !(near && near.d <= near.road.width * 0.5 + 1.8);
    const vmax = this.offRoad ? 13 : 36;
    if (thr > 0) this.v += (this.v < 0 ? 14 : 9.5) * thr * dt;
    else if (thr < 0) this.v += (this.v > 0 ? -15 : -6) * -thr * dt;
    if (brake) { const b = 22 * dt; this.v = Math.abs(this.v) <= b ? 0 : this.v - Math.sign(this.v) * b; }
    this.v -= this.v * (this.offRoad ? 0.9 : 0.12) * dt;
    if (Math.abs(thr) < 0.05 && !brake) { const rr = 1.6 * dt; this.v = Math.abs(this.v) <= rr ? 0 : this.v - Math.sign(this.v) * rr; }
    this.v = clamp(this.v, -9, vmax);
    this.steer = lerp(this.steer, st, 1 - Math.exp(-6 * dt));
    const maxSt = 0.62 / (1 + Math.abs(this.v) / 7);
    this.h += (this.v / 2.8) * Math.tan(this.steer * maxSt) * dt;
    const [fx, fz] = fwdOf(this.h);
    const nx = this.x + fx * this.v * dt, nz = this.z + fz * this.v * dt;
    if (!this._blocked(nx, nz)) { this.x = nx; this.z = nz; }
    else if (!this._blocked(nx, this.z)) { this.x = nx; this.v *= 0.7; }
    else if (!this._blocked(this.x, nz)) { this.z = nz; this.v *= 0.7; }
    else this.v *= -0.2;
    this.wheelRot += (this.v * dt) / 0.36;
    this._ground(false); this._apply();
  }
}

export class Walker {
  constructor(world) {
    this.world = world; this.D = world.D;
    this.x = 0; this.z = 75; this.h = 0; this.y = 0; this.v = 0; this.phase = 0;
    const g = this.group = new THREE.Group();
    const thobe = new THREE.MeshLambertMaterial({ color: 0xf3f1ea }), skin = new THREE.MeshLambertMaterial({ color: 0xc58c5e }), cap = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.15, 12), thobe); body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin); head.position.y = 1.72;
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, TAU, 0, Math.PI / 2), cap); hat.position.y = 1.76;
    g.add(body, head, hat);
    this.legs = [];
    for (const sx of [-0.12, 0.12]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), thobe); leg.geometry.translate(0, -0.25, 0);
      leg.position.set(sx, 0.5, 0); g.add(leg); this.legs.push(leg);
    }
    this.arms = [];
    for (const sx of [-0.4, 0.4]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.14), thobe); arm.geometry.translate(0, -0.3, 0);
      arm.position.set(sx, 1.45, 0); g.add(arm); this.arms.push(arm);
    }
    g.visible = false;
    world.scene.add(g);
  }
  place(x, z, h) { this.x = x; this.z = z; this.h = h; this.y = this.D.groundAt(x, z); this._apply(); }
  _blocked(x, z) {
    const W = this.world;
    return W.hitBuilding(x + 0.35, z) || W.hitBuilding(x - 0.35, z) || W.hitBuilding(x, z + 0.35) || W.hitBuilding(x, z - 0.35);
  }
  _apply() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = -this.h;
    const s = Math.sin(this.phase) * Math.min(1, this.v / 2.5) * 0.7;
    this.legs[0].rotation.x = s; this.legs[1].rotation.x = -s;
    this.arms[0].rotation.x = -s * 0.8; this.arms[1].rotation.x = s * 0.8;
  }
  update(dt, inp, camYaw, active) {
    const mx = active ? inp.mx : 0, mz = active ? inp.mz : 0;
    const mag = Math.min(1, Math.hypot(mx, mz));
    const target = mag * (inp.run ? 5.2 : 1.9);
    this.v = lerp(this.v, target, 1 - Math.exp(-10 * dt));
    if (mag > 0.05) {
      const [fx, fz] = fwdOf(camYaw), [rx, rz] = rightOf(camYaw);
      const dx = fx * mz + rx * mx, dz = fz * mz + rz * mx;
      const want = Math.atan2(dx, -dz);
      this.h = angLerp(this.h, want, 1 - Math.exp(-12 * dt));
      const nx = this.x + (dx / mag) * this.v * dt, nz = this.z + (dz / mag) * this.v * dt;
      if (!this._blocked(nx, nz)) { this.x = nx; this.z = nz; }
      else if (!this._blocked(nx, this.z)) this.x = nx;
      else if (!this._blocked(this.x, nz)) this.z = nz;
    }
    this.phase += this.v * dt * 3.2;
    this.y = lerp(this.y, this.D.groundAt(this.x, this.z), 1 - Math.exp(-18 * dt));
    this._apply();
  }
}

export class CameraRig {
  constructor(world, car, walker) {
    this.world = world; this.cam = world.camera; this.car = car; this.walker = walker;
    this.mode = 'car'; this.view = 0; // car: 0 chase 1 cockpit 2 far; walk: 0 third 1 first
    this.yawOff = 0; this.pitch = 0.18; this.yaw = 0; this.camH = car.h; this.lastLook = 0;
    this.fly = { x: 0, y: 300, z: 0, yaw: 0, pitch: -0.5 };
    this.pos = new THREE.Vector3(0, 50, 100); this.look = new THREE.Vector3();
  }
  setMode(m) {
    this.mode = m; this.view = 0; this.yawOff = 0;
    if (m === 'walk') { this.yaw = this.walker.h; this.pitch = 0.15; }
    if (m === 'fly') {
      const src = this.prevMode === 'walk' ? this.walker : this.car;
      this.fly.x = src.x; this.fly.z = src.z; this.fly.y = this.world.D.groundAt(src.x, src.z) + 160; this.fly.yaw = src.h || 0; this.fly.pitch = -0.55;
    }
    this.snap = true;
  }
  cycleView() { this.view = (this.view + 1) % (this.mode === 'car' ? 3 : 2); this.snap = true; }
  look(dx, dy) {
    this.lastLook = performance.now();
    if (this.mode === 'car') { this.yawOff = clamp(this.yawOff + dx, -Math.PI, Math.PI); this.pitch = clamp(this.pitch + dy, -0.2, 0.8); }
    else if (this.mode === 'walk') { this.yaw += dx; this.pitch = clamp(this.pitch + dy, -1.1, 1.2); }
    else { this.fly.yaw += dx; this.fly.pitch = clamp(this.fly.pitch + dy, -1.5, 1.5); }
  }
  update(dt, inp) {
    const cam = this.cam, W = this.world, k = this.snap ? 1 : 1 - Math.exp(-8 * dt);
    this.snap = false;
    let tx, ty, tz, lx, ly, lz;
    if (this.mode === 'car') {
      const c = this.car;
      if (performance.now() - this.lastLook > 2200) { this.yawOff = lerp(this.yawOff, 0, 1 - Math.exp(-2.5 * dt)); this.pitch = lerp(this.pitch, 0.18, 1 - Math.exp(-2 * dt)); }
      this.camH = angLerp(this.camH, c.h, 1 - Math.exp(-(this.view === 1 ? 30 : 5) * dt));
      const h = (this.view === 1 ? c.h : this.camH) + this.yawOff, [fx, fz] = fwdOf(h);
      if (this.view === 1) {
        tx = c.x + fx * 0.2; ty = c.y + 1.25; tz = c.z + fz * 0.2;
        lx = tx + fx * 10; ly = ty + Math.tan(c.pitch - (this.pitch - 0.18)) * 10; lz = tz + fz * 10;
      } else {
        const dist = this.view === 2 ? 20 : 9.5, hgt = (this.view === 2 ? 9 : 3.7) + this.pitch * 6;
        tx = c.x - fx * dist; ty = c.y + hgt; tz = c.z - fz * dist;
        lx = c.x + fx * 4; ly = c.y + 1.3; lz = c.z + fz * 4;
      }
    } else if (this.mode === 'walk') {
      const w = this.walker, [fx, fz] = fwdOf(this.yaw);
      if (this.view === 1) {
        tx = w.x; ty = w.y + 1.68; tz = w.z;
        const cp = Math.cos(this.pitch);
        lx = tx + fx * cp * 10; ly = ty - Math.sin(this.pitch) * 10; lz = tz + fz * cp * 10;
      } else {
        const dist = 4.4, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        tx = w.x - fx * dist * cp; ty = w.y + 1.7 + dist * sp; tz = w.z - fz * dist * cp;
        lx = w.x; ly = w.y + 1.5; lz = w.z;
      }
    } else {
      const f = this.fly, sp = (inp.run ? 220 : 60) * dt;
      const cp = Math.cos(f.pitch), dx = Math.sin(f.yaw) * cp, dz = -Math.cos(f.yaw) * cp, dy = Math.sin(f.pitch);
      f.x += (dx * inp.fwd + Math.cos(f.yaw) * inp.side) * sp; f.z += (dz * inp.fwd + Math.sin(f.yaw) * inp.side) * sp; f.y += dy * inp.fwd * sp + inp.up * sp;
      f.y = Math.max(f.y, W.D.groundAt(f.x, f.z) + 6);
      tx = f.x; ty = f.y; tz = f.z; lx = tx + dx * 10; ly = ty + dy * 10; lz = tz + dz * 10;
    }
    this.pos.x = lerp(this.pos.x, tx, this.mode === 'fly' ? 1 : (this.mode === 'car' && this.view === 1) ? 1 : k);
    this.pos.y = lerp(this.pos.y, ty, this.mode === 'fly' ? 1 : (this.mode === 'car' && this.view === 1) ? 1 : k);
    this.pos.z = lerp(this.pos.z, tz, this.mode === 'fly' ? 1 : (this.mode === 'car' && this.view === 1) ? 1 : k);
    const g = W.D.groundAt(this.pos.x, this.pos.z) + (this.mode === 'fly' ? 5 : 1.3);
    if (this.pos.y < g) this.pos.y = g;
    cam.position.copy(this.pos);
    this.look.set(lx, ly, lz);
    cam.lookAt(this.look);
  }
  heading() { // camera heading in radians (0 = north)
    const d = new THREE.Vector3(); this.cam.getWorldDirection(d);
    return Math.atan2(d.x, -d.z);
  }
}
