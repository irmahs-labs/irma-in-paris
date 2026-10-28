/**
 * The towns the Île-de-France map reads the weather and the air at: Paris,
 * each department's prefecture, and towns spread over the rest of the
 * region so no corner is left blank. Positions are the town centres.
 */
export interface Town {
  name: string;
  lat: number;
  lon: number;
}

export const TOWNS: readonly Town[] = [
  { lat: 48.8566, lon: 2.3522, name: "Paris" },
  { lat: 48.9362, lon: 2.3574, name: "Saint-Denis" },
  { lat: 48.9077, lon: 2.4398, name: "Bobigny" },
  { lat: 48.7904, lon: 2.4556, name: "Créteil" },
  { lat: 48.8924, lon: 2.2069, name: "Nanterre" },
  { lat: 48.8049, lon: 2.1204, name: "Versailles" },
  { lat: 48.9472, lon: 2.2467, name: "Argenteuil" },
  { lat: 48.8989, lon: 2.0938, name: "Saint-Germain-en-Laye" },
  { lat: 49.0364, lon: 2.0761, name: "Cergy" },
  { lat: 49.1553, lon: 1.7864, name: "Magny-en-Vexin" },
  { lat: 49.11, lon: 2.2233, name: "L'Isle-Adam" },
  { lat: 48.9908, lon: 1.7172, name: "Mantes-la-Jolie" },
  { lat: 48.7895, lon: 1.6003, name: "Houdan" },
  { lat: 48.6436, lon: 1.8296, name: "Rambouillet" },
  { lat: 48.529, lon: 2.011, name: "Dourdan" },
  { lat: 48.4344, lon: 2.1615, name: "Étampes" },
  { lat: 48.7309, lon: 2.2713, name: "Massy" },
  { lat: 48.629, lon: 2.441, name: "Évry" },
  { lat: 48.6917, lon: 2.6105, name: "Brie-Comte-Robert" },
  { lat: 48.542, lon: 2.6554, name: "Melun" },
  { lat: 48.4047, lon: 2.7016, name: "Fontainebleau" },
  { lat: 48.2672, lon: 2.6966, name: "Nemours" },
  { lat: 48.3853, lon: 2.9512, name: "Montereau" },
  { lat: 48.5602, lon: 3.2992, name: "Provins" },
  { lat: 48.8139, lon: 3.0835, name: "Coulommiers" },
  { lat: 48.9601, lon: 2.8788, name: "Meaux" },
  { lat: 48.8722, lon: 2.7836, name: "Marne-la-Vallée" },
  { lat: 49.0097, lon: 2.5479, name: "Roissy" },
  { lat: 49.054, lon: 2.6774, name: "Dammartin-en-Goële" },
];
