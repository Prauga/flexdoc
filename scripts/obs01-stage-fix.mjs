import { readFileSync, writeFileSync } from 'node:fs';

const path = 'packages/client/src/components/ApiClientHistoryPage.tsx';
let source = readFileSync(path, 'utf8');
const localDeclaration = "\n  const headingClass = 'text-xs font-semibold uppercase tracking-wide';";
if (!source.includes(localDeclaration)) throw new Error('Missing staged history heading declaration');
source = source.replace(localDeclaration, '');
const marker = "function PairDetails({ title, values, mutedClass }: { title: string; values: HttpKeyValue[] | undefined; mutedClass: string }) {";
if (!source.includes(marker)) throw new Error('Missing history PairDetails marker');
source = source.replace(marker, "const HISTORY_HEADING_CLASS = 'text-xs font-semibold uppercase tracking-wide';\n\n" + marker);
if (!source.includes('className={headingClass}')) throw new Error('Missing staged history heading references');
source = source.replaceAll('className={headingClass}', 'className={HISTORY_HEADING_CLASS}');
writeFileSync(path, source);
console.log('Scoped staged history-heading dedupe at module level.');
