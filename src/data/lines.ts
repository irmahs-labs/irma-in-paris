/**
 * The lines the transport screen offers, with their stops in order from the
 * first terminus to the other, and the lines whose status the live feed
 * shows. The ids are Île-de-France Mobilités' own (`line:IDFM:C01371`), as
 * PRIM knows them; the colours are each line's, with the ink that reads on it.
 */
export interface MetroLine {
  id: string;
  prim: string;
  colour: string;
  ink: string;
  stops: readonly string[];
}

/** Never empty: the screen opens on the first. */
export const METRO_LINES: readonly [MetroLine, ...MetroLine[]] = [
  {
    colour: "#ffcd00",
    id: "1",
    ink: "#2f3b34",
    prim: "line:IDFM:C01371",
    stops: [
      "La Défense",
      "Esplanade de la Défense",
      "Pont de Neuilly",
      "Les Sablons",
      "Porte Maillot",
      "Argentine",
      "Charles de Gaulle – Étoile",
      "George V",
      "Franklin D. Roosevelt",
      "Champs-Élysées – Clemenceau",
      "Concorde",
      "Tuileries",
      "Palais Royal – Musée du Louvre",
      "Louvre – Rivoli",
      "Châtelet",
      "Hôtel de Ville",
      "Saint-Paul",
      "Bastille",
      "Gare de Lyon",
      "Reuilly – Diderot",
      "Nation",
      "Porte de Vincennes",
      "Saint-Mandé",
      "Bérault",
      "Château de Vincennes",
    ],
  },
  {
    colour: "#c04191",
    id: "4",
    ink: "#ffffff",
    prim: "line:IDFM:C01374",
    stops: [
      "Porte de Clignancourt",
      "Simplon",
      "Marcadet – Poissonniers",
      "Château Rouge",
      "Barbès – Rochechouart",
      "Gare du Nord",
      "Gare de l'Est",
      "Château d'Eau",
      "Strasbourg – Saint-Denis",
      "Réaumur – Sébastopol",
      "Étienne Marcel",
      "Les Halles",
      "Châtelet",
      "Cité",
      "Saint-Michel",
      "Odéon",
      "Saint-Germain-des-Prés",
      "Saint-Sulpice",
      "Saint-Placide",
      "Montparnasse – Bienvenüe",
      "Vavin",
      "Raspail",
      "Denfert-Rochereau",
      "Mouton-Duvernet",
      "Alésia",
      "Porte d'Orléans",
      "Mairie de Montrouge",
      "Barbara",
      "Bagneux – Lucie Aubrac",
    ],
  },
  {
    colour: "#6eca97",
    id: "6",
    ink: "#2f3b34",
    prim: "line:IDFM:C01376",
    stops: [
      "Charles de Gaulle – Étoile",
      "Kléber",
      "Boissière",
      "Trocadéro",
      "Passy",
      "Bir-Hakeim",
      "Dupleix",
      "La Motte-Picquet – Grenelle",
      "Cambronne",
      "Sèvres – Lecourbe",
      "Pasteur",
      "Montparnasse – Bienvenüe",
      "Edgar Quinet",
      "Raspail",
      "Denfert-Rochereau",
      "Saint-Jacques",
      "Glacière",
      "Corvisart",
      "Place d'Italie",
      "Nationale",
      "Chevaleret",
      "Quai de la Gare",
      "Bercy",
      "Dugommier",
      "Daumesnil",
      "Bel-Air",
      "Picpus",
      "Nation",
    ],
  },
  {
    colour: "#d5c900",
    id: "9",
    ink: "#2f3b34",
    prim: "line:IDFM:C01379",
    stops: [
      "Pont de Sèvres",
      "Billancourt",
      "Marcel Sembat",
      "Porte de Saint-Cloud",
      "Exelmans",
      "Michel-Ange – Molitor",
      "Michel-Ange – Auteuil",
      "Jasmin",
      "Ranelagh",
      "La Muette",
      "Rue de la Pompe",
      "Trocadéro",
      "Iéna",
      "Alma – Marceau",
      "Franklin D. Roosevelt",
      "Saint-Philippe du Roule",
      "Miromesnil",
      "Saint-Augustin",
      "Havre – Caumartin",
      "Chaussée d'Antin – La Fayette",
      "Richelieu – Drouot",
      "Grands Boulevards",
      "Bonne Nouvelle",
      "Strasbourg – Saint-Denis",
      "République",
      "Oberkampf",
      "Saint-Ambroise",
      "Voltaire",
      "Charonne",
      "Rue des Boulets",
      "Nation",
      "Buzenval",
      "Maraîchers",
      "Porte de Montreuil",
      "Robespierre",
      "Croix de Chavaux",
      "Mairie de Montreuil",
    ],
  },
  {
    colour: "#62259d",
    id: "14",
    ink: "#ffffff",
    prim: "line:IDFM:C01384",
    stops: [
      "Saint-Denis – Pleyel",
      "Mairie de Saint-Ouen",
      "Saint-Ouen",
      "Porte de Clichy",
      "Pont Cardinet",
      "Saint-Lazare",
      "Madeleine",
      "Pyramides",
      "Châtelet",
      "Gare de Lyon",
      "Bercy",
      "Cour Saint-Émilion",
      "Bibliothèque François Mitterrand",
      "Olympiades",
      "Maison Blanche",
      "Hôpital Bicêtre",
      "Villejuif – Gustave Roussy",
      "L'Haÿ-les-Roses",
      "Chevilly-Larue",
      "Thiais – Orly",
      "Aéroport d'Orly",
    ],
  },
];

export type Mode = "metro" | "rer" | "tram";

export interface FeedLine {
  id: string;
  prim: string;
  mode: Mode;
  title: string;
  colour: string;
  ink: string;
}

const metro = (line: MetroLine): FeedLine => ({
  colour: line.colour,
  id: line.id,
  ink: line.ink,
  mode: "metro",
  prim: line.prim,
  title: `Metro ${line.id}`,
});

/** The lines the live feed shows the status of, in this order. */
export const FEED_LINES: readonly FeedLine[] = [
  ...METRO_LINES.map(metro),
  {
    colour: "#e3051c",
    id: "A",
    ink: "#ffffff",
    mode: "rer",
    prim: "line:IDFM:C01742",
    title: "RER A",
  },
  {
    colour: "#5291ce",
    id: "B",
    ink: "#ffffff",
    mode: "rer",
    prim: "line:IDFM:C01743",
    title: "RER B",
  },
  {
    colour: "#cf009e",
    id: "T2",
    ink: "#ffffff",
    mode: "tram",
    prim: "line:IDFM:C01390",
    title: "Tram T2",
  },
];

/** Direction 0 runs towards the last stop in the list, 1 towards the first. */
export type Direction = 0 | 1;

export const terminusOf = (line: MetroLine, direction: Direction): string =>
  (direction === 0 ? line.stops.at(-1) : line.stops[0]) ?? "";

/** The stops a train can be boarded at going that way: all but its terminus. */
export const boardableStops = (
  line: MetroLine,
  direction: Direction
): readonly string[] => {
  const ordered = direction === 0 ? line.stops : [...line.stops].toReversed();

  return ordered.slice(0, -1);
};
