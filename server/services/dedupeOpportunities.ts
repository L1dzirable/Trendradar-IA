import { EnrichedOpportunity } from '../../shared/signals';

const SIMILARITY_THRESHOLD = 0.55;

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','into',
  'your','have','been','are','was','were','will','would',
  'could','should','about','there','their','them','they',
  'you','our','out','how','what','when','where','why',
  'can','more','than','just','over','under','using',
  'need','build','make','get','use',
  'ai','saas','tool','tools'
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g,'')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t))
  );
}

function jaccardSimilarity(a:Set<string>, b:Set<string>):number{
  if(a.size===0 && b.size===0) return 0;
  const intersection = Array.from(a).filter(x => b.has(x)).length;
  const union = new Set([...Array.from(a), ...Array.from(b)]).size;
  return union===0?0:intersection/union;
}

export function dedupeOpportunities(
  opportunities: EnrichedOpportunity[]
):EnrichedOpportunity[]{

  const sorted=[...opportunities].sort(
    (a,b)=>b.opportunityScore-a.opportunityScore
  );

  const kept:EnrichedOpportunity[]=[];

  for(const candidate of sorted){

    const candidateTokens=tokenize(
      `${candidate.trendName} ${candidate.businessIdea}`
    );

    const isDuplicate=kept.some(existing=>{
      const existingTokens=tokenize(
        `${existing.trendName} ${existing.businessIdea}`
      );
      return jaccardSimilarity(candidateTokens,existingTokens)>=SIMILARITY_THRESHOLD;
    });

    if(!isDuplicate){
      kept.push(candidate);
    }
  }

  return kept;
}