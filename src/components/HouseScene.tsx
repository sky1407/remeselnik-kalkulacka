"use client";

import { Edges, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { DoubleSide, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BuildingElement } from "@/lib/house/element";
import { ridgeHeight } from "@/lib/house/roofs";
import { useHouseStore, type ViewLayer } from "@/lib/houseStore";
import { COLORS, frameMatrix, Members, TAP_TOLERANCE_PX, toShape } from "./scene3d";

/** Kóta rozostupu: osová vzdialenosť a svetlá šírka poľa, ktorú remeselník potrebuje vidieť. */
function SpacingLabel({ el }: { el: BuildingElement }) {
  const axes = el.framing?.axes;
  if (!el.profile || !axes || axes.length < 3) return null;
  const v = (el.outline.reduce((s, p) => s + p[1], 0) / el.outline.length) * 0.6;
  const spacingMm = Math.round(el.profile.spacing * 1000);
  const clearMm = Math.round((el.profile.spacing - el.profile.width) * 1000);
  return (
    <Html position={[(axes[1] + axes[2]) / 2, v, -el.profile.depth]} center style={{ pointerEvents: "none" }}>
      <div className="whitespace-nowrap rounded-md bg-stone-900/85 px-2 py-1 text-xs font-semibold text-white">
        os {spacingMm} mm · pole {clearMm} mm
      </div>
    </Html>
  );
}

interface ElementViewProps {
  el: BuildingElement;
  layer: ViewLayer;
  selected: boolean;
  selectable: boolean;
  onToggle: (id: string) => void;
}

function ElementView({ el, layer, selected, selectable, onToggle }: ElementViewProps) {
  const matrix = useMemo(() => frameMatrix(el.frame), [el.frame]);
  const shape = useMemo(() => toShape(el.outline, el.openings), [el.outline, el.openings]);
  const coverShape = useMemo(() => (el.cover ? toShape(el.cover.outline) : null), [el.cover]);

  const structure = layer === "structure";
  const depth = el.profile?.depth ?? el.solidThickness;
  // Strop je vo vnútri domu – v exteriéri by len zavadzal.
  if (!structure && el.kind === "ceiling") return null;

  const handleTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta <= TAP_TOLERANCE_PX) onToggle(el.id);
  };

  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      {selectable && (
        <mesh position-z={-depth / 2} onClick={handleTap}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}

      {!structure && el.kind === "wall" && el.solidThickness === 0 && (
        <mesh raycast={() => null}>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial color={selected ? COLORS.selected : COLORS.plaster} side={DoubleSide} />
          <Edges color={selected ? COLORS.selectedDark : "#a8a29e"} />
        </mesh>
      )}

      {el.solidThickness > 0 && (
        <mesh position-z={-el.solidThickness} raycast={() => null}>
          <extrudeGeometry args={[shape, { depth: el.solidThickness, bevelEnabled: false }]} />
          <meshStandardMaterial
            color={selected ? COLORS.selected : COLORS.masonry}
            transparent={structure}
            opacity={structure ? 0.35 : 1}
          />
        </mesh>
      )}

      {!structure &&
        el.openings.map((o) => (
          <mesh
            key={`${o.u0}-${o.v0}`}
            position={[(o.u0 + o.u1) / 2, (o.v0 + o.v1) / 2, -Math.max(depth, 0.1) / 2]}
            raycast={() => null}
          >
            <planeGeometry args={[o.u1 - o.u0, o.v1 - o.v0]} />
            <meshStandardMaterial
              color={o.kind === "door" ? COLORS.door : COLORS.glass}
              transparent={o.kind === "window"}
              opacity={o.kind === "window" ? 0.7 : 1}
              side={DoubleSide}
            />
            <Edges color="#e7e5e4" />
          </mesh>
        ))}

      {!structure && coverShape && el.cover && (
        <mesh position-z={el.cover.offset} raycast={() => null}>
          <extrudeGeometry args={[coverShape, { depth: 0.06, bevelEnabled: false }]} />
          <meshStandardMaterial color={selected ? COLORS.selected : COLORS.roof} />
          <Edges color={selected ? COLORS.selectedDark : "#18181b"} />
        </mesh>
      )}

      {structure && el.framing && el.profile && (
        <>
          <Members members={el.framing.members} depth={el.profile.depth} />
          <mesh position-z={-el.profile.depth / 2} raycast={() => null}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial
              color={selected ? COLORS.selected : COLORS.plaster}
              transparent
              opacity={selected ? 0.55 : 0.12}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
          {selected && <SpacingLabel el={el} />}
        </>
      )}
    </group>
  );
}

/** Smer pohľadu pri vycentrovaní – spredu zboku a mierne zhora, aby bolo vidno strechu aj fasádu. */
const FIT_DIRECTION = new Vector3(0.6, 0.5, 0.85).normalize();

/**
 * Riadi kameru: napasuje dom do stredu pohľadu (pri štarte, zmene strechy a tlačidle „Vycentrovať“)
 * a pri posúvaní nedovolí odísť od domu tak ďaleko, že by sa stratil.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  const fitRequest = useHouseStore((s) => s.fitRequest);

  useEffect(() => {
    if (!controls) return;
    const { params } = useHouseStore.getState();
    const ridge = ridgeHeight(params);
    const radius = 0.5 * Math.hypot(params.length, params.width, ridge);
    const vFov = (camera.fov * Math.PI) / 180;
    // Na úzkom mobile je limitujúca šírka, nie výška obrazovky.
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.05;

    controls.target.set(0, ridge / 2, 0);
    camera.position.copy(controls.target).addScaledVector(FIT_DIRECTION, distance);
    controls.update();
    invalidate();
  }, [fitRequest, controls, camera, invalidate]);

  useEffect(() => {
    if (!controls) return;
    const clampTarget = () => {
      const { params } = useHouseStore.getState();
      const t = controls.target;
      const limit = new Vector3(params.length, ridgeHeight(params), params.width);
      const clamped = t.clone().set(
        Math.min(limit.x, Math.max(-limit.x, t.x)),
        Math.min(limit.y, Math.max(0, t.y)),
        Math.min(limit.z, Math.max(-limit.z, t.z)),
      );
      if (clamped.equals(t)) return;
      // Posunie aj kameru, aby sa pohľad pri náraze na hranicu nestočil.
      camera.position.add(clamped.clone().sub(t));
      t.copy(clamped);
    };
    controls.addEventListener("change", clampTarget);
    return () => controls.removeEventListener("change", clampTarget);
  }, [controls, camera]);

  return null;
}

interface HouseSceneProps {
  elements: readonly BuildingElement[];
  /** Ktoré prvky sa dajú v aktuálnom remesle vybrať ťuknutím. */
  isSelectable: (el: BuildingElement) => boolean;
}

/** 3D model domu generovaný z parametrov – exteriér alebo odkrytá konštrukcia. */
export function HouseScene({ elements, isSelectable }: HouseSceneProps) {
  const params = useHouseStore((s) => s.params);
  const layer = useHouseStore((s) => s.layer);
  const selected = useHouseStore((s) => s.selected);
  const toggleElement = useHouseStore((s) => s.toggleElement);

  const ridge = ridgeHeight(params);
  const size = Math.max(params.length, params.width, ridge);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [size * 1.1, size * 0.9, size * 1.5], fov: 45, near: 0.1, far: 500 }}
    >
      <hemisphereLight args={["#ffffff", "#b5c4a8", 0.9]} />
      <directionalLight position={[8, 15, 10]} intensity={1.4} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} raycast={() => null}>
        <circleGeometry args={[size * 2, 48]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>
      {elements.map((el) => (
        <ElementView
          key={el.id}
          el={el}
          layer={layer}
          selected={selected.includes(el.id)}
          selectable={isSelectable(el)}
          onToggle={toggleElement}
        />
      ))}
      {/* Jeden prst otáča, dva prsty posúvajú a približujú; na PC pravé tlačidlo posúva. */}
      <OrbitControls
        makeDefault
        enablePan
        screenSpacePanning
        enableDamping={false}
        minDistance={size * 0.4}
        maxDistance={size * 5}
        maxPolarAngle={Math.PI * 0.49}
      />
      <CameraRig />
    </Canvas>
  );
}
