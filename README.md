# Remeselník – 3D quote calculator for tradespeople

[![CI](https://github.com/sky1407/remeselnik-kalkulacka/actions/workflows/ci.yml/badge.svg)](https://github.com/sky1407/remeselnik-kalkulacka/actions/workflows/ci.yml)

A mobile-first web app for Slovak tradespeople who don't use (or can't afford) professional estimating software.
Instead of filling in tables, you **tap the walls, roof or ceiling on a 3D model** and the app instantly calculates
material, labour, travel costs and VAT.

| Trade | What you tap | What gets calculated |
|---|---|---|
| **Blown cellulose insulation** | roof planes, attic floor, timber-frame walls on a 3D house | net cavity volume from the *actual* rafters/studs (no "≈10 % timber" guess), kg by density, bags |
| **Painter** | interior walls & ceilings, or facade walls of the house | paint by coats, primer, interior vs. facade paint |
| **Tiler** | walls (tiled up to a chosen height) and floor | tiles by box incl. waste per pattern, adhesive, grout (manufacturer formula), primer, waterproofing |
| **Drywall** | ceiling (suspended ceiling) or walls (wall lining) | CD/UD or CW/UW profiles from the generated frame, hangers, boards, screws, joint compound |

Every price and consumption rate is editable – each tradesperson has their own prices – and is stored on the device.

## Highlights

- **Parametric 3D house** (React Three Fiber): flat, gable and A-frame roofs as pluggable modules, timber frame or masonry,
  windows and doors. Switch between *exterior* and *structure* view to see rafters, studs, headers and the spacing between them.
- **One geometry source for 3D and maths** – `buildHouse()` / `buildRoom()` return the same element list that the scene
  renders and the calculators consume. Changing rafter spacing changes both the picture and the number of bags.
- **Interior rooms**: list of rooms with dimensions, openings, a dollhouse view with walls that automatically turn
  see-through when they block the view, and an inside view.
- **Travel costs without Google Maps billing**: address autocomplete (Photon) and driving distance (OSRM) proxied through
  rate-limited, cached route handlers; statutory per-km allowance plus fuel.
- **Current fuel prices** from the official open data of the Statistical Office of the Slovak Republic (DATAcube, JSON-stat),
  cached daily with a fallback because the source is often unavailable.
- **Money in integer cents**, per-line rounding, materials merged across rooms into shared packages.
- **Mobile UX for the job site**: fixed 3D viewport with a draggable bottom sheet, big touch targets, light high-contrast theme.

## Architecture

```
src/lib/
  calc/quote.ts          quote engine: materials → packages, labour, travel, VAT (Zod-validated, integer cents)
  house/                 2D geometry, frame generator (studs, rafters, headers, sills), roof modules, buildHouse()
  interior/              rooms, painter / tiler / drywall modules, persisted trade settings
  trades/cellulose.ts    cavity volume from real timber fraction, ISOCELL densities
  travel/                Photon + OSRM + DATAcube clients (server), fuel price hook (client)
src/app/api/             /geocode, /route, /fuel – validation, rate limit, caching
src/components/          3D scenes (HouseScene, RoomScene), panels, bottom sheet
```

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · React Three Fiber + drei · Zustand (persisted, schema-validated) ·
Zod 4 · Tailwind CSS 4 · Vitest · GitHub Actions

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (geometry, framing, trades, quote, parsers)
npm run lint && npm run typecheck && npm run build
```

No API keys are needed – all external services used are free and keyless.

## Notes

- Default prices are **sample values**; replace them with your own in the app.
- Free services (Photon, OSRM demo server) are fair-use; for production traffic switch to a self-hosted instance or
  OpenRouteService with an API key.
