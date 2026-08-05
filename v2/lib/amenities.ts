/* =============================================================================
   Amenity normalisation
   =============================================================================
   `scripts/sync-airtable.mjs` builds `amenities` by splitting the Airtable
   "Amenidades" cell on newlines and commas. That cell is developer copy typed
   by hand, so what lands in data/airtable.json is Spanish, inconsistently
   cased, sometimes bullet-prefixed, and occasionally not an amenity at all
   (a spreadsheet column header, a stray character, two amenities run together
   because the author forgot a comma).

   Fixing that in the JSON does not hold: the next sync overwrites it. So the
   cleanup lives here, at the read boundary, and survives re-syncing.

   Rules, in order: strip bullets, drop non-amenities, translate, dedupe.
   Anything not in the dictionary passes through unchanged — an unrecognised
   Spanish string is better than a dropped one, and it shows up as an obvious
   gap to fill rather than failing silently.
   ============================================================================= */

/** Not amenities. Spreadsheet furniture, or claims we will not assert. */
const DROP = new Set([
  "columna derecha:",
  "c",
  // An ATP tourism permit is a regulatory claim, not a feature. Towncenter
  // Boquete's prose treats its permit as unverified; a chip saying
  // "Tourism licence" would assert what the prose carefully does not.
  "licencia turística",
]);

/** Spanish (and shouty English) to house English. Keys are pre-normalised:
 *  lowercased, bullets and outer whitespace stripped. A value may be an array
 *  where the source ran two amenities together. */
const EN: Record<string, string | string[]> = {
  // Pools and water
  "piscina": "Pool",
  "piscina infinita": "Infinity pool",
  "piscina de niños": "Children's pool",
  "piscina infantil": "Children's pool",
  "piscina adultos": "Adults' pool",
  "múltiples piscinas infinity": "Multiple infinity pools",
  "7+ complejos de piscinas": "Seven-plus pool complexes",
  "piscina infinita en la azotea": "Rooftop infinity pool",
  "piscina infinita con vista al mar valet parking": [
    "Ocean-view infinity pool",
    "Valet parking",
  ],
  "jacuzzi": "Jacuzzi",
  "jacuzzi (piso 40)": "Jacuzzi (40th floor)",
  "lagoon pool": "Lagoon pool",
  "splash park": "Splash park",
  "solarium": "Solarium",
  "terraza / solárium": "Terrace and solarium",

  // Fitness and wellness
  "gimnasio": "Gym",
  "gym": "Gym",
  "gimnasio equipado": "Equipped gym",
  "gimnasio / centro de fitness": "Gym and fitness centre",
  "gimnasio / spinning room": "Gym and spinning room",
  "gimnasio (con área de spinning)": "Gym with spinning area",
  "gimnasio profesional con vista al mar": "Ocean-view gym",
  "centro de fitness y pilates": "Fitness and pilates centre",
  "fitness center": "Fitness centre",
  "wellness center": "Wellness centre",
  "centro de bienestar": "Wellness centre",
  "spa": "Spa",
  "spa comercial": "Commercial spa",
  "spa de lujo": "Luxury spa",
  "spa de bienestar de lujo": "Luxury wellness spa",
  "spa sensorial de westin": "Westin sensory spa",
  "pet spa": "Pet spa",
  "sauna": "Sauna",
  "baño turco": "Steam room",
  "espacio para yoga y pilates": "Yoga and pilates space",
  "yoga deck": "Yoga deck",
  "yoga al aire libre": "Outdoor yoga",
  "zen garden & yoga deck": "Zen garden and yoga deck",

  // Sport
  "cancha de pádel": "Padel court",
  "cancha de padel": "Padel court",
  "paddle court": "Padel court",
  "pádel": "Padel court",
  "cancha de tenis": "Tennis court",
  "cancha de squash": "Squash court",
  "cancha de futbolito": "Five-a-side football pitch",
  "mini fútbol": "Five-a-side football pitch",
  "canchas de pádel y fulbito": "Padel and five-a-side football courts",
  "basketball hoop": "Basketball hoop",
  "jogging track": "Jogging track",
  "skate park": "Skate park",
  "flowrider": "FlowRider surf simulator",
  "simulador de golf": "Golf simulator",
  "campo de golf de campeonato": "Championship golf course",
  "campo de golf santa maría": "Santa María golf course",
  "club de golf": "Golf club",
  "club deportivo": "Sports club",
  "club de campo": "Country club",
  "centro ecuestre": "Equestrian centre",
  "club de yates privado": "Private yacht club",
  "marina": "Marina",

  // Social and lounges
  "salón de eventos": "Events room",
  "salon de eventos": "Events room",
  "salón de evento": "Events room",
  "salón de fiestas": "Events room",
  "salón gourmet": "Gourmet room",
  "gourmet room": "Gourmet room",
  "salón para propietarios": "Owners' lounge",
  "sky lounge": "Sky lounge",
  "sky lounge & sky terrace": "Sky lounge and terrace",
  "sky deck": "Sky deck",
  "sky bar": "Sky bar",
  "garden lounge": "Garden lounge",
  "outdoor lounge": "Outdoor lounge",
  "lounge de juego": "Games lounge",
  "game lounge": "Games lounge",
  "cuarto de juegos": "Games room",
  "centro de juegos": "Games centre",
  "poker room": "Poker room",
  "lounge frente a la piscina": "Poolside lounge",
  "lounge para residentes": "Residents' lounge",
  "lounge para residentes en la azotea": "Rooftop residents' lounge",
  "meet & greet lounge": "Meet-and-greet lounge",
  "teen's lounge": "Teens' lounge",
  "teens lounge": "Teens' lounge",
  "teenage lounge": "Teens' lounge",
  "kids club": "Kids club",
  "kids playroom": "Kids playroom",
  "salón infantil": "Children's room",
  "parque infantil": "Children's playground",
  "parque para niños": "Children's playground",
  "juegos infantiles": "Children's playground",
  "interactive park": "Interactive park",
  "y áreas recreativas para niños/adolescentes":
    "Children's and teens' recreation areas",
  "wine bar": "Wine bar",
  "juice bar": "Juice bar",
  "beach bar": "Beach bar",
  "terraza con bar": "Covered bar terrace",
  "restaurante & bar rooftop": "Rooftop restaurant and bar",
  "bar y restaurante frente al mar": "Beachfront bar and restaurant",
  "restaurante": "Restaurant",
  "restaurantes": "Restaurants",
  "restaurantes gourmet": "Gourmet restaurants",
  "restaurantes de marca": "Branded restaurants",
  "restaurant & beach club": "Restaurant and beach club",
  "beach club": "Beach club",
  "chef kitchen": "Chef's kitchen",
  "bbq cabanas": "BBQ cabanas",
  "espacios para bbq": "BBQ areas",
  "cine": "Cinema",
  "sala de cine": "Cinema",
  "the snug – sala de cine": "The Snug cinema",
  "teatro": "Theatre",
  "teatro al aire libre": "Open-air theatre",

  // Work and services
  "coworking": "Coworking space",
  "co-working": "Coworking space",
  "espacio de co-working": "Coworking space",
  "espacios de coworking": "Coworking space",
  "coworking lounge": "Coworking lounge",
  "concierge": "Concierge",
  "concierge bilingüe 24/7": "24/7 bilingual concierge",
  "servicio de conserje 24/7": "24/7 concierge service",
  "servicio de valet parking": "Valet parking",
  "lavandería común": "Shared laundry",
  "seguridad 24/7": "24/7 security",
  "garita de seguridad": "Security gatehouse",
  "planta eléctrica total": "Full backup generator",
  "vestíbulo / lobby": "Lobby",
  "club house": "Club house",
  "casa club comunitaria": "Community club house",
  "commercial area": "Commercial area",
  "dog park": "Dog park",
  "reading area": "Reading area",
  "smart home technology": "Smart home technology",

  // Outdoor and setting
  "areas verdes": "Green areas",
  "parque central": "Central park",
  "parque sensorial": "Sensory garden",
  "parques lineales": "Linear parks",
  "senderos": "Trails",
  "senderos privados junto al río": "Private riverside trails",
  "sendero con vista al lago": "Lake-view trail",
  "lagos": "Lakes",
  "bosque nuboso": "Cloud forest",
  "1600 hectáreas": "1,600 hectares",
  "roofed terrace": "Covered terrace",
  "terraza abierta": "Open terrace",
  "rooftop": "Rooftop",
  "roof top": "Rooftop",
  "rooftop pool": "Rooftop pool",
  "pool deck": "Pool deck",
  "sun deck": "Sun deck",
  "lap pool": "Lap pool",
  "kiddie pool": "Children's pool",
  "private pool": "Private pool",
  "infinity pool": "Infinity pool",
  "playa privada / retirada": "Private, secluded beach",
  "playa privada caribeña": "Private Caribbean beach",
  "frente al mar privado": "Private beachfront",
  "acceso al arrecife": "Reef access",
  "vista al mar": "Ocean view",
  "vista a las montañas": "Mountain view",
  "vista panorámica al canal": "Panoramic Canal view",

  // Positioning copy the developer filed as an amenity. Translated rather
  // than dropped; it is their claim, and the page labels the whole list as
  // developer-supplied.
  "amenidades de resort": "Resort amenities",
  "amenidades premium": "Premium amenities",
  "baja densidad": "Low density",
  "ultra lujo": "Ultra luxury",
  "uso mixto": "Mixed use",
  "corazón urbano": "Urban core",
  "ubicación única": "Unique location",
  "diseño italiano": "Italian design",
  "diseño b&b italia": "B&B Italia design",
  "diseño orgánico": "Organic design",
  "residencias de medio piso": "Half-floor residences",
  "3 ecosistemas temáticos": "Three themed ecosystems",
  "centro de boquete": "Boquete town centre",
  "fins up! beach club": "Fins Up! Beach Club",
  "nautilus beach club": "Nautilus Beach Club",
  "nautilus adventure center": "Nautilus Adventure Center",
};

/** Bullets, dashes and stray whitespace the Airtable cell carries in. */
const stripBullet = (s: string) => s.replace(/^[\s•*–—-]+/, "").trim();

/** The cell mixes straight and curly apostrophes, so "Teen's" and "Teen’s"
 *  would otherwise miss each other and render inconsistently on one page. */
const lookupKey = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'");

export function normalizeAmenities(raw: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw ?? []) {
    const cleaned = stripBullet(String(entry));
    if (!cleaned) continue;

    const key = lookupKey(cleaned);
    if (DROP.has(key)) continue;

    const mapped = EN[key] ?? cleaned;
    for (const value of Array.isArray(mapped) ? mapped : [mapped]) {
      const dedupe = lookupKey(value);
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push(value);
    }
  }

  return out;
}
