import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseOsrm, parsePhoton } from "./maps";

describe("parsePhoton", () => {
  it("poskladá adresu a vyradí duplicitu aj bod mimo strednej Európy", () => {
    const feature = (lon: number, lat: number, properties: Record<string, string>) => ({
      geometry: { coordinates: [lon, lat] },
      properties,
    });
    const places = parsePhoton({
      features: [
        feature(19.1454, 48.7352, { name: "Námestie SNP", city: "Banská Bystrica", postcode: "974 01", countrycode: "SK" }),
        feature(19.1454, 48.7352, { name: "Námestie SNP", city: "Banská Bystrica", postcode: "974 01", countrycode: "SK" }),
        feature(17.1, 48.14, { street: "Štefánikova", housenumber: "12", name: "Štefánikova", city: "Bratislava" }),
        feature(-74, 40.7, { name: "New York" }),
      ],
    });
    expect(places).toEqual([
      { label: "Námestie SNP, 974 01 Banská Bystrica", lat: 48.7352, lon: 19.1454 },
      { label: "Štefánikova 12, Bratislava", lat: 48.14, lon: 17.1 },
    ]);
  });

  it("odmietne nečakaný formát", () => {
    expect(() => parsePhoton({ foo: 1 })).toThrow(ZodError);
  });
});

describe("parseOsrm", () => {
  it("prevedie metre a sekundy na km a minúty", () => {
    expect(parseOsrm({ code: "Ok", routes: [{ distance: 212189.8, duration: 7941.2 }] })).toEqual({
      km: 212.2,
      minutes: 132,
    });
  });

  it("vyhodí chybu, keď trasa neexistuje", () => {
    expect(() => parseOsrm({ code: "NoRoute", routes: [] })).toThrow(/NoRoute/);
  });
});
