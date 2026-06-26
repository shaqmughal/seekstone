/**
 * A themed tag vocabulary for the synthetic reference vault. Ordered roughly
 * head-to-tail so a Zipf draw makes the early entries (broad subjects) common
 * and the later ones (niche) rare — mirroring how a real vault's tag cloud has
 * a few dominant tags and a long tail.
 */
export const TAG_VOCAB: string[] = [
  'history',
  'science',
  'geography',
  'biography',
  'philosophy',
  'literature',
  'religion',
  'politics',
  'art',
  'mathematics',
  'biology',
  'chemistry',
  'physics',
  'economics',
  'law',
  'medicine',
  'architecture',
  'music',
  'language',
  'warfare',
  'antiquity',
  'mythology',
  'geology',
  'botany',
  'zoology',
  'astronomy',
  'engineering',
  'exploration',
  'theology',
  'classics',
  'europe',
  'asia',
  'africa',
  'americas',
  'ancient-rome',
  'ancient-greece',
  'medieval',
  'renaissance',
  'enlightenment',
  'reference',
  'natural-history',
  'cartography',
  'metallurgy',
  'agriculture',
  'commerce',
  'navigation',
  'rivers',
  'mountains',
  'cities',
  'empires',
  'dynasties',
  'saints',
  'philosophers',
  'painters',
  'composers',
  'inventors',
  'naturalists',
  'mineralogy',
  'palaeontology',
  'meteorology',
  'optics',
  'mechanics',
  'electricity',
  'magnetism',
  'thermodynamics',
  'logic',
  'ethics',
  'metaphysics',
  'grammar',
  'etymology',
  'poetry',
  'drama',
  'epic',
  'sculpture',
  'numismatics',
  'heraldry',
  'genealogy',
  'archaeology',
  'anthropology',
  'ethnography',
  'folklore',
  'jurisprudence',
  'diplomacy',
  'monarchy',
  'republic',
  'revolution',
  'colonization',
  'trade-routes',
  'textiles',
  'horticulture',
  'viticulture',
  'fisheries',
  'forestry',
  'mining',
  'shipbuilding',
  'fortification',
  'artillery',
  'cavalry',
  'theology-christian',
  'theology-islamic',
  'buddhism',
  'hinduism',
  'judaica',
];

/**
 * Build a wider vocabulary (~target size) by deriving sub-tags from the base.
 * Keeps the head stable (broad subjects) while padding the tail with
 * deterministic, plausible niche tags so the distinct-tag count is realistic.
 */
export function buildTagVocab(target = 320): string[] {
  const out = [...TAG_VOCAB];
  const facets = ['studies', 'theory', 'history', 'classification', 'survey', 'notes', 'origins'];
  let fi = 0;
  let bi = 0;
  while (out.length < target) {
    const base = TAG_VOCAB[bi % TAG_VOCAB.length] as string;
    const facet = facets[fi % facets.length] as string;
    const tag = `${base}-${facet}`;
    if (!out.includes(tag)) out.push(tag);
    bi++;
    if (bi % TAG_VOCAB.length === 0) fi++;
  }
  return out.slice(0, target);
}
