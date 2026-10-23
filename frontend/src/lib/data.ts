export interface DrinkPreset {
  id: string;
  label: string;
  detail: string;
  volumeMl: number;
  abv: number;
  kind: "beer" | "wine" | "cocktail" | "spirit";
  carbonated?: boolean;
}

export const DRINK_PRESETS: DrinkPreset[] = [
  { id: "lager", label: "Lager", detail: "330 ml · 5%", volumeMl: 330, abv: 5, kind: "beer", carbonated: true },
  { id: "pint", label: "Pint", detail: "568 ml · 4.5%", volumeMl: 568, abv: 4.5, kind: "beer", carbonated: true },
  { id: "wine", label: "Wine", detail: "150 ml · 13%", volumeMl: 150, abv: 13, kind: "wine" },
  { id: "wine-large", label: "Large wine", detail: "250 ml · 13%", volumeMl: 250, abv: 13, kind: "wine" },
  { id: "cocktail", label: "Cocktail", detail: "100 ml · 14%", volumeMl: 100, abv: 14, kind: "cocktail" },
  { id: "shot", label: "Spirit", detail: "30 ml · 40%", volumeMl: 30, abv: 40, kind: "spirit" },
];

export const QUICK_WATER = [250, 500, 750];

export const DRINK_KIND_LABEL: Record<DrinkPreset["kind"], string> = {
  beer: "Beer",
  wine: "Wine",
  cocktail: "Mixed",
  spirit: "Spirit",
};
