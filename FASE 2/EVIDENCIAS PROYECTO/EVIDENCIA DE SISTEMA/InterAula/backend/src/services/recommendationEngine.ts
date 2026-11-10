export type RecommendationKind = 'note' | 'post' | 'project' | 'workshop' | 'person';
export type InterestIntent = 'interest' | 'learn' | 'teach';
export interface InterestTopic { id: string; name: string; category: string; aliases: string[] }
export interface RecommendationPreferences {
  revision: number; personalization_enabled: boolean; discoverable: boolean;
  interest: string[]; learn: string[]; teach: string[];
}
export interface RecommendationCandidate {
  id: string; kind: RecommendationKind; title: string; summary: string; href: string; createdAt: string;
  text?: string; subjectId?: string; ownerId?: string;
  interests?: { topic_id: string; intent: InterestIntent }[];
  offeredSubjects?: { id: string; name: string; verified: boolean }[];
}
export interface RecommendationItem {
  id: string; kind: RecommendationKind; title: string; summary: string; href: string;
  reason: string; topics: string[];
}
export const defaultRecommendationPreferences = (): RecommendationPreferences => ({
  revision: 0, personalization_enabled: true, discoverable: false, interest: [], learn: [], teach: [],
});
export const normalizeTopicText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu,' ').trim().replace(/\s+/g,' ');
export function detectTopics(text: string, topics: InterestTopic[]): string[] {
  const normalized = ` ${normalizeTopicText(text)} `;
  return topics.filter(topic => [topic.name,...topic.aliases].some(alias => {
    const term = normalizeTopicText(alias);
    return term.length > 1 && normalized.includes(` ${term} `);
  })).map(topic => topic.id);
}

// Pure, versioned baseline. No private contact, accessibility or diagnosis features.
export function rankRecommendations(input: {
  userId: string; preferences: RecommendationPreferences; topics: InterestTopic[];
  candidates: RecommendationCandidate[]; neededSubjects?: { id: string; name: string }[];
  dismissed?: string[]; limit?: number;
}): { mode: 'personalized' | 'starter' | 'disabled'; items: RecommendationItem[] } {
  const { userId,preferences,topics } = input;
  const needed = input.neededSubjects || [];
  const interest = new Set(preferences.interest);
  const learn = new Set([...preferences.learn,...needed.flatMap(subject => detectTopics(subject.name,topics))]);
  const teach = new Set(preferences.teach);
  const mode = !preferences.personalization_enabled ? 'disabled'
    : interest.size || learn.size || teach.size || needed.length ? 'personalized' : 'starter';
  const names = new Map(topics.map(topic => [topic.id,topic.name]));
  const hidden = new Set(input.dismissed || []);
  const seen = new Set<string>();
  const ranked: { item: RecommendationItem; score: number; date: number }[] = [];
  for (const candidate of input.candidates) {
    const key = `${candidate.kind}:${candidate.id}`;
    if (hidden.has(key) || seen.has(key) || candidate.ownerId === userId || (candidate.kind==='person' && candidate.id===userId)) continue;
    seen.add(key);
    let score = 0;
    let reason = 'Reciente en la comunidad';
    let matched: string[] = [];
    if (candidate.kind==='person') {
      if (mode!=='personalized') continue;
      const offered = candidate.offeredSubjects || [];
      const subject = offered.find(item => item.verified && needed.some(need => need.id===item.id));
      if (subject) { score=20;reason=`Tutor acreditado en ${subject.name}`; }
      const publicInterests = candidate.interests || [];
      const helps = [...publicInterests.filter(item=>item.intent==='teach').map(item=>item.topic_id),
        ...offered.flatMap(item=>detectTopics(item.name,topics))].find(topic=>learn.has(topic));
      const shares = publicInterests.map(item=>item.topic_id).find(topic=>interest.has(topic)||learn.has(topic));
      const canHelp = publicInterests.find(item=>item.intent==='learn'&&teach.has(item.topic_id));
      if (helps) { if(score<12){score=12;reason=`Comparte conocimientos de ${names.get(helps)}`;} matched.push(helps); }
      else if (shares) { score=Math.max(score,6);if(!subject)reason=`Comparten interés en ${names.get(shares)}`;matched.push(shares); }
      else if (canHelp) { score=Math.max(score,5);if(!subject)reason=`Quiere aprender ${names.get(canHelp.topic_id)}`;matched.push(canHelp.topic_id); }
    } else if (mode==='personalized') {
      const found = detectTopics(candidate.text || `${candidate.title} ${candidate.summary}`,topics);
      matched=found.filter(topic=>interest.has(topic)||learn.has(topic)||teach.has(topic));
      score=matched.reduce((sum,topic)=>sum+(learn.has(topic)?5:interest.has(topic)?3:2),0);
      if (candidate.subjectId && needed.some(subject=>subject.id===candidate.subjectId)) {
        score+=8;reason=`Relacionado con ${needed.find(subject=>subject.id===candidate.subjectId)!.name}, que quieres reforzar`;
      } else if (matched.length) reason=`${learn.has(matched[0])?'Quieres aprender':interest.has(matched[0])?'Te interesa':'Puedes aportar sobre'} ${names.get(matched[0])}`;
    }
    if (mode==='personalized' && score===0) continue;
    ranked.push({item:{id:candidate.id,kind:candidate.kind,title:candidate.title,summary:candidate.summary,
      href:candidate.href,reason,topics:matched.map(topic=>names.get(topic)!).filter(Boolean)},score,
      date:Number.isFinite(Date.parse(candidate.createdAt))?Date.parse(candidate.createdAt):0});
  }
  ranked.sort((a,b)=>b.score-a.score||b.date-a.date||`${a.item.kind}:${a.item.id}`.localeCompare(`${b.item.kind}:${b.item.id}`));
  const limit=Math.max(1,Math.min(input.limit || 9,30));
  const counts = new Map<RecommendationKind,number>();
  const items: RecommendationItem[]=[];
  // Reserve variety before filling any remaining places with the next best matches.
  for(const entry of ranked) if((counts.get(entry.item.kind)||0)<3 && items.length<limit){
    items.push(entry.item);counts.set(entry.item.kind,(counts.get(entry.item.kind)||0)+1);
  }
  for(const entry of ranked) if(items.length<limit&&!items.includes(entry.item)) items.push(entry.item);
  return {mode,items};
}
