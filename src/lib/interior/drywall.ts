import type { MaterialSpec, WorkItem } from "@/lib/calc/quote";
import type { BuildingElement } from "@/lib/house/element";
import { generateFraming, type Framing, type MemberProfile } from "@/lib/house/framing";
import type { TradeInput } from "./painter";
import type { DrywallSettings } from "./tradeSettings";

/** Prierez profilov v rovine plochy (šírka × hĺbka v m) – CD 60/27 v podhľade, CW 50 v stene. */
const CD_PROFILE = { width: 0.06, depth: 0.027 } as const;
const CW_PROFILE = { width: 0.05, depth: 0.05 } as const;

export const drywallProfile = (el: BuildingElement, s: DrywallSettings): MemberProfile =>
  el.kind === "ceiling"
    ? { ...CD_PROFILE, spacing: s.ceilingSpacing }
    : { ...CW_PROFILE, spacing: s.wallSpacing };

/**
 * Nosná konštrukcia sadrokartónu: v podhľade CD profily v rozostupe, v predsadenej stene CW stĺpiky
 * s UW profilom hore a dole, obídené okolo okien a dverí. Rovnaký generátor ako krov domu.
 */
export function drywallFraming(el: BuildingElement, s: DrywallSettings): Framing {
  const profile = drywallProfile(el, s);
  const top = Math.max(...el.outline.map((p) => p[1]));
  return generateFraming(el.outline, {
    profile,
    openings: el.openings,
    plateLevels: el.kind === "wall" ? [0, top] : [],
  });
}

const length = (f: Framing, roles: readonly string[]) =>
  f.members.filter((m) => roles.includes(m.role)).reduce((s, m) => s + Math.max(m.u1 - m.u0, m.v1 - m.v0), 0);

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Podhľad a predsadené steny: dosky, profily z reálnej konštrukcie, závesy, skrutky a tmel. */
export function drywallItems({ elements, selected }: TradeInput, s: DrywallSettings): WorkItem[] {
  const chosen = elements.filter((e) => selected.includes(e.id) && (e.kind === "ceiling" || e.kind === "wall"));
  const items: WorkItem[] = [];

  const profileMat = (id: string, name: string, perM2: number): MaterialSpec => ({
    id, name: `Profil ${name} ${s.profileLength} m`, unit: "bm", consumptionPerM2: perM2, packageSize: s.profileLength, packagePrice: s.profilePrice, waste: 0.05,
  });
  const materialOnly = (label: string, area: number, material: MaterialSpec): WorkItem => ({
    label, area, layers: 1, material, laborRatePerM2: 0, productivityM2PerHour: 1000,
  });

  for (const kind of ["ceiling", "wall"] as const) {
    const els = chosen.filter((e) => e.kind === kind);
    const area = r2(els.reduce((sum, e) => sum + e.netArea, 0));
    if (area === 0) continue;
    const framings = els.map((e) => drywallFraming(e, s));
    const studs = framings.reduce((sum, f) => sum + length(f, ["stud", "header", "sill"]), 0);
    const label = kind === "ceiling" ? "Podhľad" : "Predsadená stena";

    items.push({
      label: `${label} – montáž`,
      area,
      layers: 1,
      material: {
        id: "board",
        name: `Sadrokartónová doska ${s.boardM2} m²`,
        unit: "ks",
        consumptionPerM2: 1 / s.boardM2,
        packageSize: 1,
        packagePrice: s.boardPrice,
        waste: s.waste,
      },
      laborRatePerM2: kind === "ceiling" ? s.laborCeiling : s.laborWall,
      productivityM2PerHour: s.m2PerHour,
    });

    if (kind === "ceiling") {
      // UD po obvode podhľadu, CD z konštrukcie, závesy podľa dĺžky každého CD.
      const perimeter = els.reduce((sum, e) => {
        const [w, h] = [Math.max(...e.outline.map((p) => p[0])), Math.max(...e.outline.map((p) => p[1]))];
        return sum + 2 * (w + h);
      }, 0);
      const hangers = framings.reduce(
        (sum, f) => sum + f.members.filter((m) => m.role === "stud").reduce((n, m) => n + Math.ceil((m.v1 - m.v0) / s.hangerSpacing), 0),
        0,
      );
      items.push(materialOnly("CD profily", area, profileMat("cd", "CD 60/27", studs / area)));
      items.push(materialOnly("UD profily", area, profileMat("ud", "UD 28/27", perimeter / area)));
      items.push(
        materialOnly("Závesy", area, {
          id: "hanger", name: "Rýchlozáves", unit: "ks", consumptionPerM2: hangers / area, packageSize: 1, packagePrice: s.hangerPrice, waste: 0,
        }),
      );
    } else {
      items.push(materialOnly("CW profily", area, profileMat("cw", "CW 50", studs / area)));
      items.push(materialOnly("UW profily", area, profileMat("uw", "UW 50", framings.reduce((sum, f) => sum + length(f, ["plate"]), 0) / area)));
    }

    items.push(
      materialOnly("Skrutky", area, {
        id: "screws", name: `Skrutky TN (bal. ${s.screws.size} ks)`, unit: "ks", consumptionPerM2: s.screwsPerM2, packageSize: s.screws.size, packagePrice: s.screws.price, waste: 0,
      }),
    );
    items.push(
      materialOnly("Tmel", area, {
        id: "compound", name: `Tmel ${s.compound.size} kg`, unit: "kg", consumptionPerM2: s.compoundKgPerM2, packageSize: s.compound.size, packagePrice: s.compound.price, waste: 0,
      }),
    );
  }
  return items;
}
