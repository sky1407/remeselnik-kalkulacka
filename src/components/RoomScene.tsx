"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, DoubleSide, Mesh, RepeatWrapping, SRGBColorSpace, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { num } from "@/lib/format";
import type { BuildingElement } from "@/lib/house/element";
import { drywallFraming, drywallProfile } from "@/lib/interior/drywall";
import { WALL_NAMES, type RoomSpec } from "@/lib/interior/room";
import { selectedSurfaces, useRoomStore, type InteriorTrade, type InteriorView } from "@/lib/interior/roomStore";
import { tileBand } from "@/lib/interior/tiler";
import { INTERIOR_TRADES } from "@/lib/interior/trades";
import { useTradeSettings } from "@/lib/interior/tradeSettings";
import { COLORS, frameMatrix, Members, TAP_TOLERANCE_PX, TextLabel, toShape } from "./scene3d";

const SURFACE_COLORS = { wall: COLORS.plaster, ceiling: "#fafaf9", floor: "#d6c3a5" } as const;
/** Výška očí pri pohľade zvnútra (m). */
const EYE_HEIGHT = 1.6;
const SGK_THICKNESS = 0.0125;
const noRaycast = () => null;

const center = (el: BuildingElement): Vector3 => {
  const w = Math.max(...el.outline.map((p) => p[0]));
  const h = Math.max(...el.outline.map((p) => p[1]));
  const [o, u, v] = [el.frame.origin, el.frame.u, el.frame.v];
  return new Vector3(o[0] + (u[0] * w + v[0] * h) / 2, o[1] + (u[1] * w + v[1] * h) / 2, o[2] + (u[2] * w + v[2] * h) / 2);
};
const normal = (el: BuildingElement) => new Vector3(...el.frame.u).cross(new Vector3(...el.frame.v));

/**
 * Plochy, ktoré stoja medzi kamerou a izbou (kamera je za ich lícom). Tie sa vykreslia
 * priesvitne a ťuknutie nimi prejde – pri otáčaní sa to mení samo, žiadna stena nezmizne natrvalo.
 */
function useGhosted(elements: readonly BuildingElement[]): ReadonlySet<string> {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const [ghosted, setGhosted] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!controls) return;
    const geometry = elements.map((el) => ({ id: el.id, c: center(el), n: normal(el) }));
    let last = "";
    const update = () => {
      const ids = geometry.filter(({ c, n }) => n.dot(camera.position.clone().sub(c)) < 0).map((g) => g.id);
      const key = ids.join(",");
      if (key !== last) {
        last = key;
        setGhosted(new Set(ids));
      }
    };
    update();
    controls.addEventListener("change", update);
    return () => controls.removeEventListener("change", update);
  }, [controls, camera, elements]);

  return ghosted;
}

/** Textúra jednej obkladačky so škárou – opakuje sa podľa skutočného rozmeru obkladačky. */
function useTileTexture(aMm: number, bMm: number): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = COLORS.tile;
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(62, 0, 2, 64);
      ctx.fillRect(0, 62, 64, 2);
    }
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(1000 / aMm, 1000 / bMm);
    return t;
  }, [aMm, bMm]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

interface SurfaceProps {
  el: BuildingElement;
  room: RoomSpec;
  trade: InteriorTrade;
  selected: boolean;
  selectable: boolean;
  ghost: boolean;
  showLabel: boolean;
  onToggle: (id: string) => void;
}

function Surface({ el, room, trade, selected, selectable, ghost, showLabel, onToggle }: SurfaceProps) {
  const matrix = useMemo(() => frameMatrix(el.frame), [el.frame]);
  const shape = useMemo(() => toShape(el.outline, el.openings), [el.outline, el.openings]);
  const tiler = useTradeSettings((s) => s.tiler);
  const drywall = useTradeSettings((s) => s.drywall);
  const tile = el.kind === "floor" ? tiler.floorTile : tiler.wallTile;
  const tileTexture = useTileTexture(tile.a, tile.b);

  const band = useMemo(() => {
    if (trade !== "tiler" || !selected) return null;
    if (el.kind === "floor") return shape;
    if (el.kind !== "wall" || room.tileHeight <= 0) return null;
    const b = tileBand(el, room.tileHeight);
    return toShape(b.outline, b.holes);
  }, [trade, selected, el, room.tileHeight, shape]);

  const framing = useMemo(
    () => (trade === "drywall" && selected && el.kind !== "floor" ? drywallFraming(el, drywall) : null),
    [trade, selected, el, drywall],
  );

  const handleTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta <= TAP_TOLERANCE_PX) onToggle(el.id);
  };

  const painted = trade === "painter" && selected;
  const interactive = selectable && !ghost;
  const width = Math.max(...el.outline.map((p) => p[0]));
  const wallIndex = Number(el.id.slice(-1));

  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      {/* `raycast` musí byť vždy funkcia – `undefined` by po zmene z priesvitnej steny vypol ťukanie natrvalo. */}
      <mesh onClick={interactive ? handleTap : undefined} raycast={interactive ? Mesh.prototype.raycast : noRaycast}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color={painted ? COLORS.selected : SURFACE_COLORS[el.kind as keyof typeof SURFACE_COLORS]}
          side={DoubleSide}
          transparent={ghost}
          opacity={ghost ? 0.12 : 1}
          depthWrite={!ghost}
        />
        {!ghost && <Edges color={selected ? COLORS.selectedDark : "#a8a29e"} />}
      </mesh>

      {!ghost &&
        el.openings.map((o) => (
          <mesh key={`${o.u0}-${o.v0}`} position={[(o.u0 + o.u1) / 2, (o.v0 + o.v1) / 2, -0.04]} raycast={() => null}>
            <planeGeometry args={[o.u1 - o.u0, o.v1 - o.v0]} />
            <meshStandardMaterial
              color={o.kind === "door" ? COLORS.door : COLORS.glass}
              transparent={o.kind === "window"}
              opacity={o.kind === "window" ? 0.6 : 1}
              side={DoubleSide}
            />
          </mesh>
        ))}

      {band && !ghost && (
        <mesh position-z={0.004} raycast={() => null}>
          <shapeGeometry args={[band]} />
          <meshStandardMaterial map={tileTexture} side={DoubleSide} />
          <Edges color={COLORS.selectedDark} />
        </mesh>
      )}

      {framing && !ghost && (
        <>
          {/* Profily sú pred pôvodnou plochou (+n), doska na nich. */}
          <group position-z={drywallProfile(el, drywall).depth}>
            <Members members={framing.members} depth={drywallProfile(el, drywall).depth} color={COLORS.steel} />
          </group>
          <mesh position-z={drywallProfile(el, drywall).depth + SGK_THICKNESS} raycast={() => null}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={COLORS.drywall} transparent opacity={0.45} depthWrite={false} side={DoubleSide} />
          </mesh>
        </>
      )}

      {showLabel && el.kind === "wall" && (
        <TextLabel
          text={`${WALL_NAMES[wallIndex]} · ${num.format(width)} m`}
          position={[width / 2, 0.3, 0.05]}
          height={Math.max(0.18, Math.min(0.35, room.length / 18))}
          background={selected ? "#15803d" : ghost ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.92)"}
          color={selected ? "#ffffff" : "#1c1917"}
        />
      )}
    </group>
  );
}

const DOLLHOUSE_DIRECTION = new Vector3(0.55, 0.95, 0.75).normalize();

/**
 * Kamera izby s rovnakým ovládaním ako model domu (otáčanie, koliesko / dva prsty, posúvanie).
 * „Domček“ a „Zvnútra“ sú len východiskové polohy – do izby sa dá kedykoľvek priblížiť aj ručne.
 */
function RoomCamera({ room, view }: { room: RoomSpec; view: InteriorView }) {
  const get = useThree((s) => s.get);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const fitRequest = useRoomStore((s) => s.fitRequest);

  useEffect(() => {
    if (!controls) return;
    const { camera: cam, invalidate } = get();
    const camera = cam as PerspectiveCamera;
    const { length: l, width: w, height: h } = useRoomStore.getState().rooms.find((r) => r.id === room.id) ?? room;
    if (view === "inside") {
      // Z rohu medzi stenami C a D vo výške očí – vidno protiľahlé steny A, B aj kus stropu a podlahy.
      camera.fov = 65;
      controls.target.set(0, Math.min(EYE_HEIGHT, h * 0.55), 0);
      camera.position.set(-(l / 2) * 0.75, Math.min(EYE_HEIGHT, h - 0.3), (w / 2) * 0.75);
    } else {
      camera.fov = 45;
      const radius = 0.5 * Math.hypot(l, w, h);
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      controls.target.set(0, h / 3, 0);
      camera.position.copy(controls.target).addScaledVector(DOLLHOUSE_DIRECTION, (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.1);
    }
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
    // `room` sa číta cez getState – zmena rozmerov posuvníkom nemá kameru preskakovať.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest, view, room.id, controls, get]);

  // Posúvaním sa nedá odísť od izby tak ďaleko, že by sa stratila.
  useEffect(() => {
    if (!controls) return;
    const clampTarget = () => {
      const r = useRoomStore.getState().rooms.find((x) => x.id === room.id);
      if (!r) return;
      const t = controls.target;
      const clamped = t
        .clone()
        .set(
          Math.min(r.length / 2, Math.max(-r.length / 2, t.x)),
          Math.min(r.height, Math.max(0, t.y)),
          Math.min(r.width / 2, Math.max(-r.width / 2, t.z)),
        );
      if (clamped.equals(t)) return;
      const { camera } = get();
      camera.position.add(clamped.clone().sub(t));
      t.copy(clamped);
    };
    controls.addEventListener("change", clampTarget);
    return () => controls.removeEventListener("change", clampTarget);
  }, [controls, get, room.id]);

  return null;
}

interface RoomSceneProps {
  room: RoomSpec;
  elements: readonly BuildingElement[];
  trade: InteriorTrade;
}

/** 3D interiér izby – ťuknutím sa označujú plochy pre zvolené remeslo. */
export function RoomScene({ room, elements, trade }: RoomSceneProps) {
  const view = useRoomStore((s) => s.view);
  const selected = useRoomStore((s) => selectedSurfaces(s, trade, room.id));
  const toggleSurface = useRoomStore((s) => s.toggleSurface);
  const kinds = INTERIOR_TRADES[trade].selectableKinds;
  const size = Math.max(room.length, room.width, room.height);

  return (
    <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: [size, size, size], fov: 45, near: 0.01, far: 200 }}>
      <hemisphereLight args={["#ffffff", "#d6c3a5", 1]} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} />
      <SceneContent
        room={room}
        elements={elements}
        trade={trade}
        selected={selected}
        selectableKinds={kinds}
        showLabels={view === "dollhouse"}
        onToggle={(id) => toggleSurface(trade, room.id, id)}
      />
      {/* Rovnaké ovládanie ako pri dome; pod 90° sa dá pozrieť aj na strop zvnútra. */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        screenSpacePanning
        enableDamping={false}
        minDistance={0.2}
        maxDistance={size * 5}
        maxPolarAngle={Math.PI * 0.9}
      />
      <RoomCamera room={room} view={view} />
    </Canvas>
  );
}

interface SceneContentProps {
  room: RoomSpec;
  elements: readonly BuildingElement[];
  trade: InteriorTrade;
  selected: readonly string[];
  selectableKinds: readonly string[];
  showLabels: boolean;
  onToggle: (id: string) => void;
}

function SceneContent({ room, elements, trade, selected, selectableKinds, showLabels, onToggle }: SceneContentProps) {
  const ghosted = useGhosted(elements);
  return (
    <>
      {elements.map((el) => (
        <Surface
          key={el.id}
          el={el}
          room={room}
          trade={trade}
          selected={selected.includes(el.id)}
          selectable={selectableKinds.includes(el.kind)}
          ghost={ghosted.has(el.id)}
          showLabel={showLabels}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}
