import { getAllCatalogSubjects } from '../services/catalogResolver';

const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const demoPrefix = /^(?:\s*\[demo(?:\s+\d+)?\]\s*)+/i;

export function subjectDisplayName(name: string): string {
  return name.replace(demoPrefix, '').replace(/\s+/g, ' ').trim();
}

export interface AssessmentSubjectChoice {
  id: string;
  name: string;
  label: string;
  verified: boolean;
  /** Original identities stay available for preselection; no database records are merged. */
  aliases: string[];
}

export function assessmentSubjectChoices(registered: { id: string; name: string }[], verifiedNames: string[] = []): AssessmentSubjectChoice[] {
  const verified = new Set(verifiedNames.map(normalize));
  const groups = new Map<string, { choice: AssessmentSubjectChoice; rank: number }>();

  function add(id: string, rawName: string, registeredSubject: boolean) {
    const name = subjectDisplayName(rawName);
    if (!name) return;
    const key = normalize(name);
    const isDemo = demoPrefix.test(rawName);
    const isVerified = verified.has(normalize(rawName));
    // Only the selected identity's own accreditation applies: hiding a demo
    // prefix must not transfer a demo accreditation to a real subject.
    const rank = isDemo ? 0 : registeredSubject ? (isVerified ? 3 : 2) : 1;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { choice: { id, name, label: name, verified: isVerified, aliases: [id] }, rank });
      return;
    }
    if (!existing.choice.aliases.includes(id)) existing.choice.aliases.push(id);
    if (rank > existing.rank) {
      existing.choice.id = id;
      existing.choice.verified = isVerified;
      existing.rank = rank;
    } else if (id === existing.choice.id) {
      existing.choice.verified = isVerified;
    }
  }

  for (const subject of getAllCatalogSubjects()) add('catalog:' + subject.id, subject.name, false);
  for (const subject of registered) if (uuid.test(subject.id)) add(subject.id, subject.name, true);
  return [...groups.values()].map(({ choice }) => choice).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}
