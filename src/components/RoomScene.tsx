"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { FrontSide } from "three";
import { rectRoomSurfaces, type Surface, type SurfaceKind } from "@/lib/calc/geometry";
import { useCalcStore, type RoomDimensions } from "@/lib/store";

/** Posun prsta v px, nad ktorým sa gesto berie ako otáčanie kamery, nie ťuknutie. */
const TAP_TOLERANCE_PX = 6;

type Transform = { position: [number, number, number]; rotation: [number, number, number] };

/**
 * Umiestni plochu tak, aby jej predná strana smerovala dovnútra miestnosti. Vďaka `FrontSide`
 * sa steny bližšie ku kamere automaticky skryjú a vznikne pohľad ako do domčeka pre bábiky.
 */
function surfaceTransform(id: string, { length: l, width: w, height: h }: RoomDimensions): Transform {
  switch (id) {
    case "wall-0": return { position: [0, h / 2, -w / 2], rotation: [0, 0, 0] };
    case "wall-1": return { position: [l / 2, h / 2, 0], rotation: [0, -Math.PI / 2, 0] };
    case "wall-2": return { position: [0, h / 2, w / 2], rotation: [0, Math.PI, 0] };
    case "wall-3": return { position: [-l / 2, h / 2, 0], rotation: [0, Math.PI / 2, 0] };
    case "floor": return { position: [0, 0, 0], rotation: [-Math.PI / 2, 0, 0] };
    case "ceiling": return { position: [0, h, 0], rotation: [Math.PI / 2, 0, 0] };
    default: throw new Error(`Neznáma plocha: ${id}`);
  }
}

interface SurfaceMeshProps {
  surface: Surface;
  transform: Transform;
  selected: boolean;
  selectable: boolean;
  onToggle: (id: string) => void;
}

function SurfaceMesh({ surface, transform, selected, selectable, onToggle }: SurfaceMeshProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > TAP_TOLERANCE_PX) return;
    onToggle(surface.id);
  };

  const color = selected ? "#22c55e" : hovered && selectable ? "#bbf7d0" : "#e7e5e4";

  return (
    <mesh
      {...transform}
      onClick={selectable ? handleClick : undefined}
      onPointerOver={selectable ? (e) => (e.stopPropagation(), setHovered(true)) : undefined}
      onPointerOut={selectable ? () => setHovered(false) : undefined}
    >
      <planeGeometry args={[surface.width, surface.height]} />
      <meshStandardMaterial
        color={color}
        emissive={selected ? "#16a34a" : "#000000"}
        emissiveIntensity={selected ? 0.35 : 0}
        side={FrontSide}
      />
      <Edges color={selected ? "#15803d" : "#78716c"} />
    </mesh>
  );
}

interface RoomSceneProps {
  /** Typy plôch, na ktoré sa dá v danom remesle ťuknúť. */
  selectableKinds: readonly SurfaceKind[];
}

/** Interaktívny 3D model miestnosti – ťuknutím sa plocha označí na výpočet. */
export function RoomScene({ selectableKinds }: RoomSceneProps) {
  const room = useCalcStore((s) => s.room);
  const selected = useCalcStore((s) => s.selected);
  const toggleSurface = useCalcStore((s) => s.toggleSurface);

  const maxDim = Math.max(room.length, room.width, room.height);

  return (
    <Canvas camera={{ position: [maxDim * 1.1, maxDim * 1.2, maxDim * 1.4], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 7]} intensity={1.2} />
      {rectRoomSurfaces(room).map((surface) => (
        <SurfaceMesh
          key={surface.id}
          surface={surface}
          transform={surfaceTransform(surface.id, room)}
          selected={selected.includes(surface.id)}
          selectable={selectableKinds.includes(surface.kind)}
          onToggle={toggleSurface}
        />
      ))}
      <OrbitControls
        target={[0, room.height / 2, 0]}
        enablePan={false}
        minDistance={maxDim * 0.8}
        maxDistance={maxDim * 4}
        maxPolarAngle={Math.PI * 0.85}
      />
    </Canvas>
  );
}
