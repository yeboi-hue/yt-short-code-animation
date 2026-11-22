// "The Pyramid Built on Wet Sand": vertical short. One three.js world (soft shadows, ink hulls, fog, dust),
// flat bean-head cartoon cards, 11 shots cut to the narration, hard cut + glides, white flash after the hook.
// Shot i runs from starts[i] to starts[i+1] (frames). Defaults below are used when public/timing.json is missing.
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";

export type Props = { starts: number[]; audio: string | null };
export const DEFAULTS: Props = { starts: [0, 130, 280, 420, 630, 780, 850, 1050, 1230, 1440, 1590, 1740], audio: null };
const INK = "#241726";
type V3 = [number, number, number];

// ------------------------------------------------------------------ camera
type Shot = { pos: V3; posEnd: V3; look: V3; lookEnd: V3; fov: number; roll?: number; golden?: boolean };
const SHOTS: Shot[] = [
  { pos: [-4, 5, 30], posEnd: [-3, 2.6, 17], look: [-6, 2, 0], lookEnd: [-6, 1.8, 0], fov: 40 },                               // 0 hook
  { pos: [-30, 4.2, 20], posEnd: [-30, 4.5, 16], look: [-30, 4.9, 10], lookEnd: [-30, 5, 10], fov: 38 },                       // 1 Khufu
  { pos: [22, 3, 16], posEnd: [17, 2.6, 11], look: [12, 1.6, 2], lookEnd: [12, 1.8, 2], fov: 40, roll: 0.04 },                 // 2 quarry
  { pos: [-1, 2.2, 13], posEnd: [-2, 1.9, 10], look: [-5, 1.2, 0], lookEnd: [-4.5, 1.1, 0], fov: 38 },                         // 3 sled bogs
  { pos: [-1.5, 1.8, 7.5], posEnd: [-1.2, 1.7, 6], look: [-0.8, 1.4, 0], lookEnd: [-0.8, 1.3, 0], fov: 34 },                   // 4 pour close-up
  { pos: [0, 2.3, 4.5], posEnd: [0, 2.2, 3.7], look: [-0.5, 2.1, 0], lookEnd: [-0.5, 2.1, 0], fov: 32, roll: -0.05 },          // 5 "Water?"
  { pos: [-3, 1.5, 11], posEnd: [12, 1.5, 11], look: [-3, 1, 0], lookEnd: [12, 1, 0], fov: 38 },                               // 6 glide
  { pos: [30, 1.7, 7], posEnd: [30, 1.5, 5.5], look: [30, 1.3, 0], lookEnd: [30, 1.2, 0], fov: 36 },                           // 7 sandcastle
  { pos: [0, 5, 34], posEnd: [0, 8, 26], look: [0, 10, -60], lookEnd: [0, 12, -60], fov: 42, golden: true },                   // 8 town + pyramid
  { pos: [60, 3, 9], posEnd: [60, 3, 6.5], look: [60, 3.2, 0], lookEnd: [60, 3.2, 0], fov: 36, golden: true },                 // 9 graffiti
  { pos: [-6, 4, 32], posEnd: [10, 16, 52], look: [0, 2.5, 8], lookEnd: [0, 8, -20], fov: 40 },                                // 10 tourists, crane out
];
const sm = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * x * (x * (6 * x - 15) + 10); };
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ramp = (f: number, k: number[], v: number[]) => {
  if (f <= k[0]) return v[0];
  for (let i = 1; i < k.length; i++) if (f <= k[i]) { const d = k[i] - k[i - 1]; return d <= 0 ? v[i] : v[i - 1] + ((v[i] - v[i - 1]) * (f - k[i - 1])) / d; }
  return v[v.length - 1];
};
const shotIdx = (f: number, S: number[]) => { let i = 0; while (i < SHOTS.length - 1 && f >= S[i + 1]) i++; return i; };
const camAt = (f: number, S: number[]) => {
  const i = shotIdx(f, S), s = SHOTS[i], u = sm((f - S[i]) / Math.max(1, S[i + 1] - S[i]));
  return { i, pos: mix3(s.pos, s.posEnd, u), look: mix3(s.look, s.lookEnd, u), fov: s.fov, roll: s.roll ?? 0, golden: !!s.golden };
};

// ------------------------------------------------------------------ cartoon cards
type Kind = "worker" | "pharaoh" | "kid" | "tourist";
type Expr = "neutral" | "shock" | "happy" | "strain";
const cache = new Map<string, THREE.CanvasTexture>();
const stroke = (g: CanvasRenderingContext2D, pts: [number, number][], w: number, col = INK) => {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.lineWidth = w; g.strokeStyle = col; g.stroke();
};
const ell = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, lw = 8) => {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
  if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); }
};
const cardTex = (kind: Kind, expr: Expr, shirt: string) => {
  const key = kind + expr + shirt;
  const hit = cache.get(key); if (hit) return hit;
  const c = document.createElement("canvas"); c.width = 300; c.height = 500;
  const g = c.getContext("2d")!;
  g.lineCap = "round"; g.lineJoin = "round";
  const skin = kind === "kid" ? "#f5c9a0" : kind === "pharaoh" ? "#c98a55" : "#d49a62";
  const cloth = kind === "worker" ? "#f1efe6" : kind === "pharaoh" ? "#f7f3e6" : kind === "kid" ? "#f08a2c" : shirt;
  stroke(g, [[116, 215], [92, 270], [82, 305]], 11, "#6b4a35"); ell(g, 82, 307, 10, 10, INK, 0);
  stroke(g, [[184, 215], [208, 270], [218, 305]], 11, "#6b4a35"); ell(g, 218, 307, 10, 10, INK, 0);
  stroke(g, [[136, 335], [130, 478]], 12, "#6b4a35"); stroke(g, [[164, 335], [170, 478]], 12, "#6b4a35");
  stroke(g, [[130, 480], [108, 484]], 13); stroke(g, [[170, 480], [192, 484]], 13);
  ell(g, 150, 265, 42, 82, kind === "worker" ? skin : cloth);
  if (kind === "worker") { g.save(); g.beginPath(); g.ellipse(150, 265, 42, 82, 0, 0, Math.PI * 2); g.clip(); g.fillStyle = cloth; g.fillRect(100, 300, 100, 60); g.restore(); g.beginPath(); g.ellipse(150, 265, 42, 82, 0, 0, Math.PI * 2); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); }
  if (kind === "pharaoh") { ell(g, 150, 205, 46, 22, "#e0b030"); ell(g, 150, 205, 30, 14, "#2b5fb8", 4); }
  if (kind === "pharaoh") {
    g.beginPath(); g.moveTo(88, 70); g.lineTo(212, 70); g.lineTo(226, 250); g.lineTo(74, 250); g.closePath();
    g.fillStyle = "#2b5fb8"; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
    for (let y = 100; y < 245; y += 24) stroke(g, [[80, y], [220, y]], 6, "#e0b030");
  }
  ell(g, 150, 108, 62, 58, skin);
  const cap = (col: string, ry: number, cy: number) => { g.beginPath(); g.ellipse(150, cy, 63, ry, 0, Math.PI, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); };
  if (kind === "worker") cap("#2a1c20", 40, 96);
  if (kind === "kid") cap("#5a3b2a", 38, 96);
  if (kind === "tourist") { ell(g, 150, 58, 92, 12, "#f4d36a"); cap("#f4d36a", 34, 58); }
  if (kind === "pharaoh") cap("#e0b030", 20, 70);
  const ey = 112;
  for (const s of [-1, 1]) {
    const x = 150 + s * 17;
    if (expr === "shock") { ell(g, x, ey, 13, 13, "#fff", 4); ell(g, x, ey + 2, 4, 4, INK, 0); }
    else if (expr === "happy") { g.beginPath(); g.arc(x, ey + 5, 10, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); }
    else if (expr === "strain") stroke(g, [[x + 7 * s, ey - 6], [x - 7 * s, ey], [x + 7 * s, ey + 6]], 5);
    else { g.beginPath(); g.ellipse(x, ey, 9, 7, 0, 0, Math.PI); g.fillStyle = INK; g.fill(); stroke(g, [[x - 11, ey], [x + 11, ey]], 4); }
    const dy = expr === "shock" ? -34 : expr === "strain" ? -22 : -26;
    stroke(g, [[x - s * 12, ey + dy + (expr === "strain" ? 6 : 0)], [x + s * 12, ey + dy - (expr === "strain" ? 0 : 2)]], 6);
  }
  if (expr === "shock") ell(g, 150, 146, 9, 13, "#5a1e28", 4);
  else if (expr === "happy") { g.beginPath(); g.arc(150, 136, 14, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); }
  else if (expr === "strain") { g.fillStyle = "#fff"; g.fillRect(133, 138, 34, 12); g.lineWidth = 4; g.strokeStyle = INK; g.strokeRect(133, 138, 34, 12); }
  else stroke(g, [[142, 142], [158, 141]], 5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  cache.set(key, t); return t;
};

const Card: React.FC<{ kind: Kind; expr?: Expr; x: number; y?: number; z: number; h?: number; cam: V3; flip?: boolean; shirt?: string }> = ({ kind, expr = "neutral", x, y = 0, z, h = 3.5, cam, flip, shirt = "#e85a4f" }) => (
  <>
    <mesh position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[h * 0.3, 20]} /><meshBasicMaterial color="#1a0f1f" transparent opacity={0.28} depthWrite={false} /></mesh>
    <mesh position={[x, y + h / 2, z]} rotation={[0, Math.atan2(cam[0] - x, cam[2] - z), 0]} scale={[flip ? -1 : 1, 1, 1]}>
      <planeGeometry args={[h * 0.6, h]} />
      <meshBasicMaterial map={cardTex(kind, expr, shirt)} transparent alphaTest={0.4} side={THREE.DoubleSide} />
    </mesh>
  </>
);

const Inked: React.FC<{ pos: V3; size: V3; color: string; rot?: V3 }> = ({ pos, size, color, rot = [0, 0, 0] }) => (
  <group position={pos} rotation={rot}>
    <mesh scale={size} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshLambertMaterial color={color} flatShading /></mesh>
    <mesh scale={[size[0] * 1.04 + 0.07, size[1] * 1.04 + 0.07, size[2] * 1.04 + 0.07]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={INK} side={THREE.BackSide} /></mesh>
  </group>
);

let _wall: THREE.CanvasTexture | null = null;
const wallTex = () => {
  if (_wall) return _wall;
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d")!;
  g.fillStyle = "#d9c9a3"; g.fillRect(0, 0, 1024, 512);
  for (let y = 0; y < 512; y += 64) for (let x = (y / 64) % 2 ? -100 : 0; x < 1024; x += 200) { g.strokeStyle = "rgba(90,70,50,.35)"; g.lineWidth = 4; g.strokeRect(x, y, 200, 64); }
  g.fillStyle = "#b5402a"; g.font = "bold 92px sans-serif"; g.textAlign = "center"; g.fillText("FRIENDS OF KHUFU", 512, 290);
  g.strokeStyle = "#b5402a"; g.lineWidth = 8; g.beginPath(); g.moveTo(300, 340); g.quadraticCurveTo(512, 400, 724, 340); g.stroke();
  _wall = new THREE.CanvasTexture(c); _wall.colorSpace = THREE.SRGBColorSpace; return _wall;
};

// ------------------------------------------------------------------ world
const Rig: React.FC<{ f: number; S: number[] }> = ({ f, S }) => {
  const { camera, scene } = useThree();
  const c = camAt(f, S), cam = camera as THREE.PerspectiveCamera;
  cam.position.set(...c.pos); cam.fov = c.fov; cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll); cam.updateProjectionMatrix();
  scene.background = new THREE.Color(c.golden ? "#8a6f9a" : "#5a9be0");
  scene.fog = new THREE.Fog(c.golden ? "#f7a27e" : "#bcd4ee", 40, 280);
  return null;
};

const World: React.FC<{ f: number; S: number[] }> = ({ f, S }) => {
  const c = camAt(f, S), cam = c.pos, g = c.golden, i = c.i;
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(c.look[0], 0, c.look[2]);
  const sunDir: V3 = g ? [-0.55, 0.28, -0.8] : [0.6, 0.75, 0.45];
  const lpos: V3 = [c.look[0] + sunDir[0] * 70, sunDir[1] * 70, c.look[2] + sunDir[2] * 70];

  const sx = ramp(f, [0, S[1], S[3], S[4], S[5], S[6], S[7], S[11]], [-24, -8, -6, -4.6, -4.4, -4.2, 14, 14]);
  const moving = i === 0 || i === 6;
  const dry = f >= S[3] && f < S[5];
  const shake = i === 3 ? Math.sin(f * 1.7) * 0.06 : 0;
  const bobAt = (k: number) => (moving ? Math.abs(Math.sin(f * 0.32 + k * 1.3)) * 0.16 : i === 3 ? Math.abs(Math.sin(f * 0.5 + k)) * 0.05 : 0);
  const pourX = sx + 6, pouring = f >= S[4] + 10 && f < S[5];
  const wetOn = f >= S[4] + 10, wetStart = -5;
  const wetEnd = ramp(f, [S[4] + 10, S[4] + 70, S[6], S[7]], [pourX, pourX + 2, sx + 6, sx + 6]);
  const pile = ramp(f, [S[3], S[4] - 5, S[4] + 60, S[4] + 110], [0.2, 1.4, 1.4, 0]);
  const expr: Expr = i === 0 || i === 3 ? "strain" : i === 5 ? "shock" : i === 6 ? "happy" : "neutral";
  const sand = g ? "#d2905c" : "#e4c37c", dune = g ? "#b9764f" : "#d9b66c";
  const wet = g ? "#8a5236" : "#a98250";
  const T = f - S[10];

  return (
    <>
      <ambientLight intensity={g ? 0.95 : 1.1} color={g ? "#b9a4e0" : "#dcecff"} />
      <primitive object={target} />
      <directionalLight
        position={lpos} target={target} intensity={g ? 2.8 : 2.4} color={g ? "#ffab5e" : "#fff3e0"}
        castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={1} shadow-camera-far={160}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]} receiveShadow><planeGeometry args={[700, 700]} /><meshLambertMaterial color={sand} /></mesh>
      {[[-90, -40, 22], [80, -55, 30], [-50, -90, 28], [120, -20, 20], [30, -120, 40]].map(([x, z, r], k) => (
        <mesh key={k} position={[x, -r * 0.55, z]} scale={[1.8, 0.55, 1]}><sphereGeometry args={[r, 20, 12]} /><meshLambertMaterial color={dune} /></mesh>
      ))}
      {/* pyramids */}
      {([[0, 19, -70, 42.4, 38], [-85, 14, -105, 34, 29], [78, 9, -92, 21, 18]] as number[][]).map(([x, y, z, r, h], k) => (
        <group key={k} position={[x, y, z]} rotation={[0, Math.PI / 4, 0]}>
          <mesh castShadow><coneGeometry args={[r, h, 4]} /><meshLambertMaterial color={g ? "#f2c9a0" : "#efe3c2"} flatShading /></mesh>
          <mesh scale={1.012}><coneGeometry args={[r, h, 4]} /><meshBasicMaterial color={INK} side={THREE.BackSide} /></mesh>
        </group>
      ))}
      {g && <mesh position={[-40, 14, -190]}><sphereGeometry args={[9, 24, 16]} /><meshBasicMaterial color="#ffcf9e" fog={false} /></mesh>}
      {/* floating dust */}
      {Array.from({ length: 46 }, (_, k) => (
        <mesh key={"d" + k} position={[c.look[0] + Math.sin(k * 12.9) * 22 + ((f * 0.012 * (1 + (k % 3))) % 6), 0.6 + (k % 9) * 0.55 + Math.sin(f * 0.03 + k) * 0.15, c.look[2] + Math.cos(k * 7.1) * 14]}>
          <sphereGeometry args={[0.045, 6, 6]} /><meshBasicMaterial color={g ? "#ffe0b8" : "#fff4dc"} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* wet patch */}
      {wetOn && <mesh position={[(wetStart + wetEnd) / 2, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[Math.max(0.01, wetEnd - wetStart), 5]} /><meshBasicMaterial color={wet} /></mesh>}
      {/* sled + block */}
      <group position={[sx + shake, 0, 0]}>
        <Inked pos={[0, 0.18, -0.9]} size={[4.4, 0.25, 0.3]} color="#7a4b2a" />
        <Inked pos={[0, 0.18, 0.9]} size={[4.4, 0.25, 0.3]} color="#7a4b2a" />
        <Inked pos={[0, 0.5, 0]} size={[4.2, 0.2, 2.4]} color="#8d5a32" />
        <Inked pos={[0, 1.55, 0]} size={[3.4, 1.9, 2.0]} color="#e8dcc0" />
        <Inked pos={[2.9, 0.6, 0]} size={[1.6, 0.12, 0.12]} color="#c9b27a" />
      </group>
      {dry && pile > 0.01 && (
        <group position={[sx + 2.9, 0, 0]} scale={[pile, pile, pile * 1.6]}>
          <mesh position={[0, 0.5, 0]} castShadow><coneGeometry args={[1.2, 1.1, 8]} /><meshLambertMaterial color={dune} flatShading /></mesh>
        </group>
      )}
      {[0, 1, 2, 3].map((k) => (
        <Card key={k} kind="worker" expr={expr} x={sx + 4.2 + (k % 2) * 0.9} z={-1.1 + k * 0.75} cam={cam} h={3.3 + (k % 2) * 0.2} y={bobAt(k)} flip />
      ))}
      <Card kind="worker" expr={pouring ? "neutral" : expr} x={pourX} z={0.1} cam={cam} h={3.5} y={bobAt(5)} flip />
      <Inked pos={[pourX - 0.9, pouring ? 2.2 : 1.6, 0.35]} size={[0.5, 0.6, 0.5]} color="#b5603a" rot={[0, 0, pouring ? 0.9 : 0]} />
      {pouring && Array.from({ length: 16 }, (_, k) => {
        const t = ((f + k * 4) % 36) / 36;
        return <mesh key={"w" + k} position={[pourX - 1.2 - t * 0.7, 2.0 - 1.95 * t * t, 0.35]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="#6fc8ff" /></mesh>;
      })}
      {/* Khufu */}
      <Inked pos={[-30, 1.4, 10]} size={[8, 2.8, 4]} color="#d9c7a0" />
      <Card kind="pharaoh" expr={i === 1 && f > (S[1] + S[2]) / 2 ? "happy" : "neutral"} x={-30} y={2.8} z={10} h={3.6} cam={cam} />
      {/* quarry */}
      {[0, 1, 2, 3].map((a) => [0, 1, 2].map((b) => (b <= (3 - a) * 0.8 ? <Inked key={a + "-" + b} pos={[8 + a * 2.7, 0.8 + b * 1.6, 3 - b * 0.1]} size={[2.5, 1.5, 2.5]} color={(a + b) % 2 ? "#e8dcc0" : "#ddd0b0"} /> : null)))}
      {[0, 1, 2].map((k) => <Card key={"q" + k} kind="worker" expr="strain" x={7 + k * 3.6} z={6} h={3.3} cam={cam} y={Math.abs(Math.sin(f * 0.3 + k)) * 0.08} />)}
      {/* sandcastle kid */}
      <Card kind="kid" expr={i === 7 && f > S[7] + 40 ? "happy" : "neutral"} x={29.2} z={0.5} h={2.3} cam={cam} />
      <group position={[31, 0, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.8, 1, 1, 12]} /><meshLambertMaterial color={wet} /></mesh>
        <mesh position={[0, 1.2, 0]} castShadow><cylinderGeometry args={[0.5, 0.6, 0.9, 12]} /><meshLambertMaterial color={wet} /></mesh>
        <mesh position={[-1.8, 0.35, 0.3]} scale={[1, 0.5, 1]}><coneGeometry args={[0.9, 1, 10]} /><meshLambertMaterial color={dune} /></mesh>
      </group>
      {/* mud-brick town + crowd */}
      {[-24, -14, -4, 8, 18, 28].map((x, k) => (
        <Inked key={k} pos={[x, 2.1 + (k % 2) * 0.5, -22 - (k % 3) * 5]} size={[7, 4.2 + (k % 2), 5]} color={["#d9b98a", "#cfa87a", "#e0c394"][k % 3]} />
      ))}
      {[-8, -3, 3, 8].map((x, k) => <Card key={"t" + k} kind="worker" expr="happy" x={x} z={-12} h={3.4} cam={cam} flip={k % 2 === 0} />)}
      {/* graffiti wall */}
      <Inked pos={[60, 3, -0.6]} size={[14, 6, 1]} color="#d9c9a3" />
      <mesh position={[60, 3, -0.05]}><planeGeometry args={[12, 6]} /><meshBasicMaterial map={wallTex()} /></mesh>
      {/* tourists */}
      {i === 10 && Array.from({ length: 14 }, (_, k) => {
        const sp = 0.7 + ((k * 37) % 10) / 10, x0 = -14 + (k * 29) % 28, z0 = 4 + (k * 13) % 20;
        return <Card key={"o" + k} kind="tourist" expr="happy" x={x0 + (((T * 0.02 * sp + k) % 6) - 3)} z={z0} h={3.3} y={Math.abs(Math.sin(f * 0.2 * sp + k)) * 0.1} cam={cam} flip={k % 2 === 0}
          shirt={["#e85a4f", "#3b8ed0", "#59b36a", "#e9b93a", "#a46bd0"][k % 5]} />;
      })}
    </>
  );
};

export const PyramidShort: React.FC<Props> = ({ starts, audio }) => {
  const f = useCurrentFrame();
  const fl = f - starts[1];
  const flash = fl >= 0 && fl < 4 ? [1, 0.75, 0.45, 0.2][fl] : 0;
  return (
    <AbsoluteFill style={{ background: "#bcd4ee" }}>
      {audio && <Audio src={staticFile(audio)} />}
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: true }} camera={{ fov: 40, near: 0.2, far: 1500 }}>
        <Rig f={f} S={starts} />
        <World f={f} S={starts} />
      </ThreeCanvas>
      {flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
