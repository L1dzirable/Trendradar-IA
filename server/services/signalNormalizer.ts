const HN_PREFIXES = [
  /^ask hn:\s*/i,
  /^show hn:\s*/i,
  /^tell hn:\s*/i,
  /^launch hn:\s*/i,
];

const TRUNCATION_CHARS = /[\?\|\–\—]/;

const WEAK_TOKENS = new Set([
  'the','and','for','with','that','this','from','into',
  'your','have','been','are','was','were','will','would',
  'could','should','about','there','their','them','they',
  'you','our','out','how','what','when','where','why',
  'can','more','than','just','over','under','using',
  'need','build','make','get','use','its','not','but',
  'has','had','let','new','way','one','two','now',

  'ai','saas','tool','tools','app','platform','software',
  'solution','product','service','system','startup'
]);

export function normalizeTitle(raw: string): string | null {

  let title = raw.trim();

  // strip HN prefixes
  for (const prefix of HN_PREFIXES) {
    title = title.replace(prefix, '');
  }

  // truncate structural separators
  const cutIndex = title.search(TRUNCATION_CHARS);
  if (cutIndex > 10) {
    title = title.slice(0, cutIndex);
  }

  // clean punctuation
  title = title.replace(/[,\.\:\s]+$/, '').trim();

  // normalize whitespace
  title = title.replace(/\s+/g, ' ');

  // reject short titles
  if (title.length < 12) return null;

  const meaningfulTokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2 && !WEAK_TOKENS.has(t));

  if (meaningfulTokens.length < 2) return null;

  return title;
}