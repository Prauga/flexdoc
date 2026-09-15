import { FLEXDOC_BUILD_INFO } from '../build-info';
import { FlexDocRendererOptions } from '../types/options';

interface FooterProps {
  footerClasses: string;
  footer?: FlexDocRendererOptions['footer'];
}

export const Footer = ({ footerClasses, footer }: FooterProps) => {
  const copyright = footer?.copyright;
  const links = footer?.link || [];
  const build = FLEXDOC_BUILD_INFO;
  const revision = build.commit === 'unknown' ? 'dev' : build.commit.slice(0, 7);
  const sourceDate = build.sourceDate === 'unknown' ? '' : build.sourceDate.slice(0, 10);

  return (
    <footer className={`${footerClasses} w-full border-t`} data-flexdoc-version={build.version} data-flexdoc-commit={build.commit}>
      <div className='mx-auto flex min-h-12 w-full max-w-[1600px] flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-sm'>
        <p>
          {copyright || <>Powered by <a href='https://flexdoc.prauga.com' target='_blank' rel='noopener noreferrer' className='font-semibold hover:opacity-80 transition-opacity'>FlexDoc</a></>}
          <span className='opacity-70' aria-label='FlexDoc build information'> · v{build.version} · contract 1 · {revision}{sourceDate && ` · ${sourceDate}`}</span>
        </p>
        {links.length > 0 && <nav aria-label='Footer links' className='flex flex-wrap gap-x-4 gap-y-2'>
          {links.map((link) => <a key={`${link.text}:${link.url}`} href={link.url} target='_blank' rel='noopener noreferrer' className='hover:opacity-80'>{link.text}</a>)}
        </nav>}
      </div>
    </footer>
  );
};
