import React, { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import { CHARACTERS, type CharacterInfo } from "@/game/characters";

const CITY_BOUND = 108;
const MEETUP_POINT = [40, -10];
const nearRoad = (x: number, z: number) => Math.abs(Math.abs(x) % 60) < 12 || Math.abs(Math.abs(z) % 60) < 12;

const FRIEND_MISSIONS = [
  { type: "meetup", name: "اللمة", desc: "روح لميدان اللقاء، أصدقاؤك مستنيينك هناك.", point: MEETUP_POINT, reward: 100 },
  { type: "robbery", name: "صندوق المحل", desc: "اسرق صندوق المحل واهرب من البوليس 20 ثانية.", point: [-40, 60], reward: 600, escapeSeconds: 20 },
  { type: "chase", name: "الهروب الكبير", desc: "اوصل لنقطة الأمان قبل ما البوليس يمسكك.", point: [70, -70], reward: 500, timeLimit: 40 },
  { type: "elimination", name: "تصفية الحساب", desc: "اطرد 3 من رجال العصابة المنافسة.", point: [-20, -70], reward: 800, targets: 3 },
  { type: "robbery", name: "ضربة المستودع", desc: "اسرق شحنة من المستودع واهرب 25 ثانية.", point: [86, 86], reward: 1000, escapeSeconds: 25 },
  { type: "chase", name: "النهاية الكبرى", desc: "اهرب لمخرج المدينة قبل انتهاء الوقت.", point: [-100, 100], reward: 1500, timeLimit: 45 },
];

interface CityCrimeBabylonProps {
  selectedCharacter: CharacterInfo;
}

export default function CityCrimeBabylon({ selectedCharacter }: CityCrimeBabylonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef<any>({});
  const keys = useRef<Record<string, boolean>>({});
  const [hud, setHud] = useState({
    money: 1000,
    wanted: 0,
    storyText: `${selectedCharacter.name} يبدأ يومه في مدينة الجريمة.`,
    missionText: "اضغط F لبدء أول مهمة من مهام الأصدقاء",
    prompt: "",
    dialogue: null as string | null,
  });
  const [questLogOpen, setQuestLogOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new BABYLON.Engine(canvas, true, { stencil: true });
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = BABYLON.Color4.FromHexString("#2a3140ff");
    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogColor = BABYLON.Color3.FromHexString("#2a3140");
    scene.fogStart = 50;
    scene.fogEnd = 210;

    const camera = new BABYLON.UniversalCamera("cam", new BABYLON.Vector3(0, 8, -8), scene);

    const amb = new BABYLON.HemisphericLight("amb", new BABYLON.Vector3(0, 1, 0), scene);
    amb.intensity = 0.9;
    const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, -0.3), scene);
    sun.intensity = 0.7;

    const matCache: Record<string, BABYLON.StandardMaterial> = {};
    const getMat = (hex: string, unlit = false) => {
      const key = hex + (unlit ? "u" : "");
      if (matCache[key]) return matCache[key];
      const m = new BABYLON.StandardMaterial(hex, scene);
      if (unlit) {
        m.emissiveColor = BABYLON.Color3.FromHexString(hex);
        m.disableLighting = true;
      } else {
        m.diffuseColor = BABYLON.Color3.FromHexString(hex);
      }
      matCache[key] = m;
      return m;
    };

    const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, color: string) => {
      const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      m.position.set(x, y, z);
      m.material = getMat(color);
      return m;
    };
    const cyl = (name: string, r: number, h: number, x: number, y: number, z: number, color: string, unlit = false) => {
      const m = BABYLON.MeshBuilder.CreateCylinder(name, { diameterTop: r * 2, diameterBottom: r * 2, height: h }, scene);
      m.position.set(x, y, z);
      m.material = getMat(color, unlit);
      return m;
    };
    const sphere = (name: string, r: number, x: number, y: number, z: number, color: string, unlit = false) => {
      const m = BABYLON.MeshBuilder.CreateSphere(name, { diameter: r * 2 }, scene);
      m.position.set(x, y, z);
      m.material = getMat(color, unlit);
      return m;
    };

    function makeCharacter(color: string) {
      const root = new BABYLON.TransformNode("char", scene);
      const body = cyl("body", 0.38, 1.1, 0, 0.75, 0, color);
      body.parent = root;
      const head = sphere("head", 0.28, 0, 1.5, 0, "#d9a066");
      head.parent = root;
      return root;
    }
    function makeCar(color: string) {
      const root = new BABYLON.TransformNode("car", scene);
      const chassis = box("chassis", 2.1, 0.9, 4.2, 0, 0.55, 0, color);
      chassis.parent = root;
      const cabin = box("cabin", 1.7, 0.6, 2.0, 0, 1.15, -0.2, "#101418");
      cabin.parent = root;
      return root;
    }
    function makeTarget() {
      const root = new BABYLON.TransformNode("target", scene);
      const body = cyl("tbody", 0.38, 1.1, 0, 0.75, 0, "#b52020");
      body.parent = root;
      const head = sphere("thead", 0.28, 0, 1.5, 0, "#7a1414");
      head.parent = root;
      return root;
    }
    function makeMarker(color: string) {
      return cyl("marker", 1.4, 0.15, 0, 0.2, 0, color, true);
    }
    function makePole(x: number, z: number) {
      cyl("pole", 0.08, 4.4, x, 2.2, z, "#141618");
      sphere("lamp", 0.24, x, 4.5, z, "#ffbc57", true);
    }

    box("ground", 240, 1, 240, 0, -0.5, 0, "#383e46");
    [-60, 0, 60].forEach((v) => {
      box("roadZ", 10, 0.08, 240, v, 0.02, 0, "#14171c");
      box("roadX", 240, 0.08, 10, 0, 0.02, v, "#14171c");
      box("swL", 3.2, 0.1, 240, v - 7.2, 0.05, 0, "#7a7871");
      box("swR", 3.2, 0.1, 240, v + 7.2, 0.05, 0, "#7a7871");
      box("swT", 240, 0.1, 3.2, 0, 0.05, v - 7.2, "#7a7871");
      box("swB", 240, 0.1, 3.2, 0, 0.05, v + 7.2, "#7a7871");
      for (let p = -96; p <= 96; p += 24) {
        makePole(v - 9.2, p);
        makePole(p, v + 9.2);
      }
    });
    for (let x = -90; x <= 90; x += 30) {
      for (let z = -90; z <= 90; z += 30) {
        if (nearRoad(x, z)) continue;
        const h = 5 + Math.abs((x * 13 + z * 7) % 17);
        box("bld", 16, h, 16, x, h / 2, z, "#3a4048");
      }
    }
    box("warehouse", 25, 8, 25, 86, 4, 86, "#2b2f33");
    box("power", 22, 10, 22, -86, 5, -86, "#2a3846");
    box("meetupPad", 20, 0.1, 20, MEETUP_POINT[0], 0.06, MEETUP_POINT[1], "#555b45");

    const player = makeCharacter(selectedCharacter.color);
    player.position.set(14, 0, 22);

    const car = makeCar("#1146b8");
    car.position.set(0, 0, 18);

    const friends = CHARACTERS.filter((c) => c.id !== selectedCharacter.id).map((f, i) => {
      const angle = (i / (CHARACTERS.length - 1)) * Math.PI * 2;
      const mesh = makeCharacter(f.color);
      mesh.position.set(
        MEETUP_POINT[0] + Math.cos(angle) * 5,
        0,
        MEETUP_POINT[1] + Math.sin(angle) * 5
      );
      return { ...f, mesh, recruited: false };
    });

    const trafficDefs: [number, "z" | "x", number][] = [[-60, "z", 1], [-60, "z", -1], [60, "z", 1], [60, "z", -1], [-100, "x", 1], [25, "x", -1]];
    const traffic = trafficDefs.map(([v, axis, dir], i) => {
      const c = makeCar("#7a4a26");
      if (axis === "z") c.position.set(v, 0, i < 2 ? -80 : 80);
      else c.position.set(v, 0, 0);
      return { mesh: c, axis, dir, speed: 8 };
    });

    const police = [[12, -50], [-72, 35], [40, 40]].map(([x, z]) => {
      const p = makeCar("#101318");
      p.position.set(x, 0, z);
      return p;
    });

    let eliminationTargets: { mesh: BABYLON.TransformNode; alive: boolean }[] = [];
    let gtaMarker: BABYLON.Mesh | null = null;

    const setMarker = (point: number[] | null, color: string) => {
      if (gtaMarker) { gtaMarker.dispose(); gtaMarker = null; }
      if (!point) return;
      const marker = makeMarker(color);
      marker.position.set(point[0], 0.2, point[1]);
      gtaMarker = marker;
    };

    gRef.current = {
      engine, scene, camera, player, car, traffic, police, friends,
      driving: false,
      pos: new BABYLON.Vector3(14, 0, 22), rot: 0,
      carPos: new BABYLON.Vector3(0, 0, 18), carRot: 0, carSpeed: 0,
      money: 1000, wanted: 0,
      gtaIndex: -1, gtaActive: false, gtaPhase: null as string | null, gtaTimer: 0, eliminated: 0,
      missionText: "اضغط F لبدء أول مهمة من مهام الأصدقاء",
      gtaText: "",
      prompt: "", dialogue: null as string | null, dialogueTimer: 0,
      gtaMarker,
    };

    const say = (text: string, ms = 3200) => {
      gRef.current.dialogue = text;
      gRef.current.dialogueTimer = ms;
    };

    function clearEliminationTargets() {
      eliminationTargets.forEach((t) => t.mesh.dispose());
      eliminationTargets = [];
    }

    function startNextGtaMission() {
      const s = gRef.current;
      if (s.gtaActive) return;
      s.gtaIndex++;
      if (s.gtaIndex >= FRIEND_MISSIONS.length) {
        s.gtaText = "خلصت كل مهام الأصدقاء.";
        setMarker(null, "");
        return;
      }
      const m = FRIEND_MISSIONS[s.gtaIndex];
      s.gtaActive = true;
      s.gtaPhase = "travel";
      s.gtaTimer = 0;
      s.gtaText = `${m.name}\n${m.desc}`;
      setMarker(m.point, "#ff2a4a");
      say(`مهمة جديدة: ${m.name}`);
      if (m.type === "elimination") {
        clearEliminationTargets();
        for (let i = 0; i < (m as any).targets; i++) {
          const t = makeTarget();
          const angle = (i / (m as any).targets) * Math.PI * 2;
          t.position.set(m.point[0] + Math.cos(angle) * 8, 0, m.point[1] + Math.sin(angle) * 8);
          eliminationTargets.push({ mesh: t, alive: true });
        }
        s.eliminated = 0;
      }
    }

    function completeGtaMission() {
      const s = gRef.current;
      const m = FRIEND_MISSIONS[s.gtaIndex];
      s.gtaActive = false;
      s.gtaPhase = null;
      s.money += m.reward;
      s.gtaText = `اكتملت: ${m.name}  +$${m.reward}\nاضغط F للمهمة التالية`;
      setMarker(null, "");
      say(`أنجزت: ${m.name} (+${m.reward}$)`);
      if (m.type === "meetup") s.friends.forEach((f: any) => (f.recruited = true));
    }

    function failGtaMission(reason: string) {
      const s = gRef.current;
      s.gtaActive = false;
      s.gtaPhase = null;
      setMarker(null, "");
      s.gtaText = `فشلت: ${reason}\nاضغط F عشان تجرب تاني`;
      s.gtaIndex--;
      say(reason, 2400);
    }

    function interact() {
      const s = gRef.current;
      const activeTransform: BABYLON.Vector3 = s.driving ? s.carPos : s.pos;
      if (s.driving) {
        s.driving = false;
        s.pos.copyFrom(s.carPos).addInPlace(new BABYLON.Vector3(2, 0, 0));
        return;
      }
      if (BABYLON.Vector3.Distance(activeTransform, s.carPos) < 4.5) {
        s.driving = true;
        return;
      }
    }

    gRef.current.startNextGtaMission = startNextGtaMission;
    gRef.current.interact = interact;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys.current[key] = true;
      if (key === "e") interact();
      if (key === "f") startNextGtaMission();
    };
    const onKeyUp = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    engine.runRenderLoop(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
      const s = gRef.current;
      const k = keys.current;

      if (s.driving) {
        const throttle = (k["w"] || k["arrowup"] ? 1 : 0) - (k["s"] || k["arrowdown"] ? 1 : 0);
        const steer = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0);
        const target = throttle * 24;
        s.carSpeed += (target - s.carSpeed) * Math.min(1, dt * 2.4);
        s.carRot -= steer * 1.8 * dt * Math.min(1, Math.abs(s.carSpeed) / 6) * (s.carSpeed >= 0 ? 1 : -1);
        s.carPos.x += Math.sin(s.carRot) * s.carSpeed * dt;
        s.carPos.z += Math.cos(s.carRot) * s.carSpeed * dt;
        s.carPos.x = BABYLON.Scalar.Clamp(s.carPos.x, -CITY_BOUND, CITY_BOUND);
        s.carPos.z = BABYLON.Scalar.Clamp(s.carPos.z, -CITY_BOUND, CITY_BOUND);
        car.position.copyFrom(s.carPos);
        car.rotation.y = s.carRot;
        player.setEnabled(false);
      } else {
        player.setEnabled(true);
        const fwd = (k["w"] || k["arrowup"] ? 1 : 0) - (k["s"] || k["arrowdown"] ? 1 : 0);
        const turn = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0);
        s.rot -= turn * 2.4 * dt;
        const speed = fwd >= 0 ? 6 : 3.6;
        s.pos.x += Math.sin(s.rot) * fwd * speed * dt;
        s.pos.z += Math.cos(s.rot) * fwd * speed * dt;
        s.pos.x = BABYLON.Scalar.Clamp(s.pos.x, -CITY_BOUND, CITY_BOUND);
        s.pos.z = BABYLON.Scalar.Clamp(s.pos.z, -CITY_BOUND, CITY_BOUND);
        player.position.copyFrom(s.pos);
        player.rotation.y = s.rot;
      }

      const followTarget: BABYLON.Vector3 = s.driving ? s.carPos : s.pos;
      const followRot: number = s.driving ? s.carRot : s.rot;
      const camTarget = new BABYLON.Vector3(
        followTarget.x - Math.sin(followRot) * 8,
        followTarget.y + 4.2,
        followTarget.z - Math.cos(followRot) * 8
      );
      camera.position = BABYLON.Vector3.Lerp(camera.position, camTarget, 1 - Math.pow(0.001, dt));
      camera.setTarget(new BABYLON.Vector3(followTarget.x, followTarget.y + 1.3, followTarget.z));

      traffic.forEach((c) => {
        if (c.axis === "z") {
          c.mesh.position.z += c.dir * c.speed * dt;
          if (Math.abs(c.mesh.position.z) > 95) c.dir *= -1;
          c.mesh.rotation.y = c.dir > 0 ? 0 : Math.PI;
        } else {
          c.mesh.position.x += c.dir * c.speed * dt;
          if (Math.abs(c.mesh.position.x) > 95) c.dir *= -1;
          c.mesh.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      });

      s.friends.forEach((f: any, i: number) => {
        if (!f.recruited || s.driving) return;
        const row = Math.floor(i / 3);
        const col = i % 3;
        const targetPos = new BABYLON.Vector3(
          s.pos.x - Math.sin(s.rot) * (3 + row * 1.8) + Math.cos(s.rot) * (col - 1) * 1.6,
          0,
          s.pos.z - Math.cos(s.rot) * (3 + row * 1.8) - Math.sin(s.rot) * (col - 1) * 1.6
        );
        f.mesh.position = BABYLON.Vector3.Lerp(f.mesh.position, targetPos, Math.min(1, dt * 3));
        f.mesh.lookAt(new BABYLON.Vector3(s.pos.x, 0, s.pos.z));
      });

      s.wanted = Math.max(0, s.wanted - dt * 0.05);
      police.forEach((p) => {
        if (s.wanted <= 0.1) return;
        const to = followTarget.subtract(p.position);
        to.y = 0;
        if (to.length() > 90) return;
        const dir = to.normalize();
        p.position.addInPlace(dir.scale((11 + s.wanted * 4) * dt));
        p.rotation.y = Math.atan2(dir.x, dir.z);
      });

      if (s.gtaActive) {
        const m: any = FRIEND_MISSIONS[s.gtaIndex];
        const mp = new BABYLON.Vector3(m.point[0], 0, m.point[1]);
        if (m.type === "meetup" && s.gtaPhase === "travel") {
          if (BABYLON.Vector3.Distance(followTarget, mp) < 7) completeGtaMission();
        }
        if (m.type === "robbery") {
          if (s.gtaPhase === "travel" && BABYLON.Vector3.Distance(followTarget, mp) < 7) {
            s.gtaPhase = "escaping";
            s.gtaTimer = m.escapeSeconds;
            s.wanted = 3;
            s.gtaText = `${m.name}\nاهرب من البوليس! ${Math.ceil(s.gtaTimer)} ثانية متبقية`;
            say("أخدت الفلوس! اهرب دلوقتي!");
          } else if (s.gtaPhase === "escaping") {
            s.gtaTimer -= dt;
            s.gtaText = `${m.name}\nاهرب من البوليس! ${Math.max(0, Math.ceil(s.gtaTimer))} ثانية متبقية`;
            const caught = police.some((p) => s.wanted > 0.1 && BABYLON.Vector3.Distance(p.position, followTarget) < 4);
            if (caught) failGtaMission("البوليس مسكك!");
            else if (s.gtaTimer <= 0) completeGtaMission();
          }
        }
        if (m.type === "chase") {
          if (s.gtaPhase === "travel" && s.gtaTimer === 0) {
            s.gtaTimer = m.timeLimit;
            s.wanted = 3;
          }
          s.gtaTimer -= dt;
          s.gtaText = `${m.name}\nالوقت المتبقي: ${Math.max(0, Math.ceil(s.gtaTimer))} ثانية`;
          if (BABYLON.Vector3.Distance(followTarget, mp) < 7) completeGtaMission();
          else if (s.gtaTimer <= 0) failGtaMission("خلص الوقت!");
        }
        if (m.type === "elimination") {
          eliminationTargets.forEach((t) => {
            if (!t.alive) return;
            if (BABYLON.Vector3.Distance(followTarget, t.mesh.position) < 2.4) {
              t.alive = false;
              t.mesh.dispose();
              s.eliminated++;
              s.gtaText = `${m.name}\nطردت ${s.eliminated} من ${m.targets}`;
              say(`تم طرد واحد (${s.eliminated}/${m.targets})`, 1600);
            }
          });
          if (s.eliminated >= m.targets) completeGtaMission();
        }
      }

      const nearCar = !s.driving && BABYLON.Vector3.Distance(s.pos, s.carPos) < 4.5;
      s.prompt = nearCar ? "اضغط E لدخول السيارة" : "";

      if (s.dialogueTimer > 0) {
        s.dialogueTimer -= dt * 1000;
        if (s.dialogueTimer <= 0) s.dialogue = null;
      }

      scene.render();
    });

    const hudInterval = setInterval(() => {
      const s = gRef.current;
      setHud({
        money: Math.round(s.money),
        wanted: s.wanted,
        storyText: `${selectedCharacter.name} يبدأ يومه في مدينة الجريمة.`,
        missionText: s.missionText,
        prompt: s.prompt,
        dialogue: s.dialogue,
      });
    }, 150);

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      clearInterval(hudInterval);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      engine.dispose();
    };
  }, [selectedCharacter]);

  const press = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    keys.current[key] = true;
  };
  const release = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    keys.current[key] = false;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", touchAction: "none", display: "block" }} />

      <div dir="rtl" style={{ position: "absolute", top: 12, right: 12, left: 12, maxWidth: 420, background: "rgba(10,12,16,0.72)", color: "#fff", padding: "12px 16px", borderRadius: 10, fontFamily: "system-ui, sans-serif", pointerEvents: "none" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{selectedCharacter.name} — مدينة الجريمة</div>
        <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: "pre-line" }}>{hud.storyText}</div>
        <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-line" }}>{hud.missionText}</div>
      </div>

      <div dir="rtl" style={{ position: "absolute", top: 12, left: 12, color: "#fff", background: "rgba(10,12,16,0.72)", padding: "10px 14px", borderRadius: 10, fontFamily: "system-ui, sans-serif", fontSize: 14, pointerEvents: "none" }}>
        <div>💰 {hud.money}$</div>
        <div style={{ marginTop: 4 }}>{"⭐".repeat(Math.ceil(hud.wanted)) || "—"}</div>
      </div>

      {hud.dialogue && (
        <div dir="rtl" style={{ position: "absolute", bottom: 150, left: "10%", right: "10%", background: "rgba(10,12,16,0.85)", color: "#fff", padding: "12px 18px", borderRadius: 10, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          {hud.dialogue}
        </div>
      )}

      {hud.prompt && (
        <div dir="rtl" style={{ position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)", background: "rgba(255,140,20,0.9)", color: "#111", padding: "6px 14px", borderRadius: 20, fontFamily: "system-ui, sans-serif", fontWeight: 600, fontSize: 13 }}>
          {hud.prompt}
        </div>
      )}

      <button onClick={() => setQuestLogOpen((v) => !v)} style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(10,12,16,0.72)", color: "#fff", border: "1px solid #444", borderRadius: 8, padding: "6px 14px", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
        سجل المهام
      </button>
      {questLogOpen && (
        <div dir="rtl" style={{ position: "absolute", top: 50, left: "50%", transform: "translateX(-50%)", background: "rgba(10,12,16,0.92)", color: "#fff", padding: 14, borderRadius: 10, width: 260, fontFamily: "system-ui, sans-serif", fontSize: 12, maxHeight: "60vh", overflowY: "auto" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>مهام الأصدقاء</div>
          {FRIEND_MISSIONS.map((m, i) => (
            <div key={m.name} style={{ opacity: i <= gRef.current.gtaIndex ? 1 : 0.4, marginBottom: 3 }}>
              {i < gRef.current.gtaIndex ? "✅" : i === gRef.current.gtaIndex && gRef.current.gtaActive ? "🟡" : "⬜"} {m.name}
            </div>
          ))}
        </div>
      )}

      <div style={{ position: "absolute", bottom: 20, left: 20, display: "grid", gridTemplateColumns: "56px 56px 56px", gridTemplateRows: "56px 56px", gap: 6 }}>
        <div />
        <button onPointerDown={press("w")} onPointerUp={release("w")} onPointerLeave={release("w")} style={btnStyle}>▲</button>
        <div />
        <button onPointerDown={press("a")} onPointerUp={release("a")} onPointerLeave={release("a")} style={btnStyle}>◀</button>
        <button onPointerDown={press("s")} onPointerUp={release("s")} onPointerLeave={release("s")} style={btnStyle}>▼</button>
        <button onPointerDown={press("d")} onPointerUp={release("d")} onPointerLeave={release("d")} style={btnStyle}>▶</button>
      </div>
      <div style={{ position: "absolute", bottom: 20, right: 20, display: "flex", gap: 10 }}>
        <button onClick={() => gRef.current.startNextGtaMission?.()} style={{ ...btnStyle, width: 64, height: 64, background: "rgba(255,60,80,0.35)" }}>F</button>
        <button onClick={() => gRef.current.interact?.()} style={{ ...btnStyle, width: 64, height: 64 }}>E</button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 12,
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.3)",
  fontSize: 20,
  fontWeight: 700,
  touchAction: "none",
  userSelect: "none",
};
