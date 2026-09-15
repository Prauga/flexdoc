import React from 'react';
import { FLEXDOC_MARK_URL } from '../branding';
import { FlexDoc as RendererFlexDoc } from './FlexDoc';
import type { FlexDocProps } from './FlexDoc';

/** Public FlexDoc renderer with lightweight default Prauga branding. */
export const FlexDoc: React.FC<FlexDocProps> = (props) => {
  const options = props.options?.logo
    ? props.options
    : { ...props.options, logo: { url: FLEXDOC_MARK_URL, alt: 'FlexDoc', maxHeight: 32, maxWidth: 32 } };
  return <RendererFlexDoc {...props} options={options} />;
};
