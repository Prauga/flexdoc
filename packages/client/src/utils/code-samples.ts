import type { BuiltRequest } from './request-builder';
import { generateCodeSample as coreGenerateCodeSample, languageLabel as coreLanguageLabel } from '../../../../core/dist/code-samples.js';

export type CodeSampleLanguage = 'curl' | 'javascript' | 'python' | 'go' | 'java';
export function generateCodeSample(request: BuiltRequest, language: CodeSampleLanguage): string { return coreGenerateCodeSample(request, language); }
export function languageLabel(language: CodeSampleLanguage): string { return coreLanguageLabel(language); }
