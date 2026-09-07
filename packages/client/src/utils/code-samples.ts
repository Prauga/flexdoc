import type { BuiltRequest } from './request-builder';
import { generateCodeSample as coreGenerateCodeSample, languageLabel as coreLanguageLabel } from '../../../../core/dist/code-samples.js';

/** Languages supported by FlexDoc's built-in request code-sample generator. */
export type CodeSampleLanguage = 'curl' | 'javascript' | 'python' | 'go' | 'java';

/**
 * Generate a language-specific code sample from a built request.
 * @param request Canonical request containing URL, method, headers, and optional body.
 * @param language Target language/template identifier.
 * @returns Source text representing the request in the selected language.
 */
export function generateCodeSample(request: BuiltRequest, language: CodeSampleLanguage): string { return coreGenerateCodeSample(request, language); }

/**
 * Return the display label for a code-sample language id.
 * @param language Code-sample language identifier.
 * @returns Human-readable language label used by renderer tabs.
 */
export function languageLabel(language: CodeSampleLanguage): string { return coreLanguageLabel(language); }
