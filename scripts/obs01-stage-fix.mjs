import { readFileSync, writeFileSync } from 'node:fs';

const path = 'packages/client/src/components/ApiClientHistoryPage.tsx';
let source = readFileSync(path, 'utf8');
const declaration = "\n  const headingClass = 'text-xs font-semibold uppercase tracking-wide';";
if (!source.includes(declaration)) throw new Error('Missing staged history heading declaration');
source = source.replace(declaration, '');
if (!source.includes('className={headingClass}')) throw new Error('Missing staged history heading references');
source = source.replaceAll('className={headingClass}', "className='text-xs font-semibold uppercase tracking-wide'");
writeFileSync(path, source);
console.log('Removed staged history-heading dedupe.');
