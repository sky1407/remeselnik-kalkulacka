"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { CanvasTexture, Matrix4, Path, Shape, SRGBColorSpace, Vector2, Vector3, type InstancedMesh } from "three";
import type { Frame3D } from "@/lib/house/element";
import type { Member } from "@/lib/house/framing";
import type { Polygon, Rect } from "@/lib/house/geometry2d";

/** Spoločné 3D stavebné bloky pre model domu aj interiér izby. */

/** Posun prsta v px, nad ktorým sa gesto berie ako otáčanie kamery, nie ťuknutie. */
export const TAP_TOLERANCE_PX = 6;

export const COLORS = {
  plaster: "#f5f0e6",
  masonry: "#d6c7b0",
  roof: "#3f3f46",
  wood: "#c8a165",
  glass: "#93c5fd",
  door: "#7c4a2d",
  selected: "#22c55e",
  selectedDark: "#15803d",
  ground: "#dfe7d5",
  tile: "#bfdbfe",
  drywall: "#e7e5e4",
  steel: "#94a3b8",
} as const;

export function frameMatrix({ origin, u, v }: Frame3D): Matrix4 {
  const vu = new Vector3(...u);
  const vv = new Vector3(...v);
  const n = vu.clone().cross(vv);
  return new Matrix4().makeBasis(vu, vv, n).setPosition(...origin);
}

const rectPoints = (r: Rect) => [
  new Vector2(r.u0, r.v0),
  new Vector2(r.u1, r.v0),
  new Vector2(r.u1, r.v1),
  new Vector2(r.u0, r.v1),
];

export function toShape(outline: Polygon, holes: readonly Rect[] = []): Shape {
  const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
  shape.holes = holes.map((h) => new Path(rectPoints(h)));
  return shape;
}

interface MembersProps {
  members: readonly Member[];
  depth: number;
  color?: string;
}

/** Nosné prvky (krokvy, stĺpiky, CD profily) ako jeden InstancedMesh – stovky kusov za jeden draw call. */
export function Members({ members, depth, color = COLORS.wood }: MembersProps) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    members.forEach((mem, i) => {
      m.makeScale(mem.u1 - mem.u0, mem.v1 - mem.v0, depth);
      m.setPosition((mem.u0 + mem.u1) / 2, (mem.v0 + mem.v1) / 2, -depth / 2);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [members, depth, invalidate]);

  return (
    <instancedMesh key={members.length} ref={ref} args={[undefined, undefined, members.length]} raycast={() => null}>
      <boxGeometry />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

interface TextLabelProps {
  text: string;
  position: readonly [number, number, number];
  /** Výška štítka vo svete (m). */
  height?: number;
  background?: string;
  color?: string;
}

/**
 * Štítok ako sprite s textom nakresleným do textúry – vždy natočený ku kamere, neblokuje ťuknutia.
 * Nahrádza `Html` z drei, ktorý pri každom skrytí odpájal vlastný React root (chyba v React 19).
 */
export function TextLabel({ text, position, height = 0.25, background = "rgba(255,255,255,0.92)", color = "#1c1917" }: TextLabelProps) {
  const { texture, aspect } = useMemo(() => {
    const px = 48;
    const font = `700 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { texture: null, aspect: 1 };
    ctx.font = font;
    const pad = px * 0.45;
    canvas.width = Math.ceil(ctx.measureText(text).width + pad * 2);
    canvas.height = Math.ceil(px * 1.5);
    // Zmena rozmeru plátna vymaže nastavenia kontextu – font treba nastaviť znova.
    ctx.font = font;
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, px * 0.3);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, pad, canvas.height / 2);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return { texture: t, aspect: canvas.width / canvas.height };
  }, [text, background, color]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;

  return (
    <sprite position={position as [number, number, number]} scale={[height * aspect, height, 1]} renderOrder={10} raycast={() => null}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}
