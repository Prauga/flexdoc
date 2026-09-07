import type { BuiltRequest } from './request-builder';
import { generateCodeSample as coreGenerateCodeSample, languageLabel as coreLanguageLabel } from '../../../../core/dist/code-samples.js';

export type CodeSampleLanguage = 'curl' | 'javascript' | 'python' | 'go' | 'java';
/** Generate a language-specific code sample from a built request. */
export function generateCodeSample(request: BuiltRequest, language: CodeSampleLanguage): string { return coreGenerateCodeSample(request, language); }
/** Human-readable label for a code-sample language id. */
export function languageLabel(language: CodeSampleLanguage): string { return coreLanguageLabel(language); }
