// Import CSS
import './styles.css';

// Export main components
export { FlexDoc } from './components/FlexDoc';
export { App as ApiDocsDemo } from './App';

// Export types for consumers
export type { AppProps } from './App';
export type { OpenAPISpec } from './types/openapi';
export type { FlexDocProps } from './components/FlexDoc';

// Export utilities
export { OpenAPIParser } from './utils/openapi-parser';

// Export sample data
export { sampleSpec } from './data/sample-spec';
