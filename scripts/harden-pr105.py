from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"missing pattern in {path}: {old[:120]!r}")
    p.write_text(s.replace(old, new, 1))


p = Path('packages/client/src/standalone.tsx')
s = p.read_text()
s = s.replace("import { FLEXDOC_MARK_URL } from './branding';\n", '')
s = s.replace(
    """function ensureFavicon(options: StandaloneFlexDocOptions): void {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector<HTMLLinkElement>('link[rel~=\"icon\"]');
  if (existing && !options.favicon) return;
  const link = existing || document.createElement('link');
  link.rel = 'icon';
  link.href = options.favicon || FLEXDOC_MARK_URL;
  if (!existing) document.head.appendChild(link);
}
""",
    """function ensureFavicon(options: StandaloneFlexDocOptions): void {
  if (typeof document === 'undefined' || !options.favicon) return;
  const existing = document.querySelector<HTMLLinkElement>('link[rel~=\"icon\"]');
  const link = existing || document.createElement('link');
  link.rel = 'icon';
  link.href = options.favicon;
  if (!existing) document.head.appendChild(link);
}
""",
)
s = s.replace(
    "  const rendererOptions = options.logo ? options : { ...options, logo: FLEXDOC_MARK_URL };\n  ensureFavicon(options);\n",
    "  ensureFavicon(options);\n",
)
s = s.replace(
    "root.render(<FlexDoc spec={spec} theme={resolveTheme(options)} options={rendererOptions} />);",
    "root.render(<FlexDoc spec={spec} theme={resolveTheme(options)} options={options} />);",
)
p.write_text(s)

Path('packages/client/src/components/FlexDocMark.tsx').write_text("""export function FlexDocMark({ className = 'h-8 w-8' }: { className?: string }) {
  return <svg aria-hidden='true' viewBox='0 0 512 512' className={className}>
    <rect width='512' height='512' rx='115' fill='white' />
    <path d='M397 130.546C397 136.784 392.409 141.84 386.745 141.84H196.951C191.287 141.84 186.696 146.896 186.696 153.134L186.692 239.516C186.692 245.754 191.283 250.811 196.947 250.811H315.049C320.712 250.811 325.303 255.867 325.303 262.105V317.357C325.303 323.594 320.712 328.651 315.049 328.651H196.951C191.288 328.651 186.696 333.707 186.696 339.944L186.692 436.706C186.692 442.944 182.101 448 176.438 448H125.255C119.591 448 115 442.943 115 436.706V329.566C115 323.329 119.591 318.272 125.255 318.272H171.66C177.324 318.272 181.915 313.216 181.915 306.978V272.483C181.915 266.246 177.324 261.189 171.66 261.189H125.255C119.591 261.189 115 256.133 115 249.895V142.756C115 136.518 119.591 131.461 125.255 131.461H171.66C177.324 131.461 181.915 126.405 181.915 120.167V75.2941C181.915 69.0565 186.506 64 192.169 64H386.745C392.409 64 397 69.0565 397 75.2941V130.546Z' fill='#3461E1' />
  </svg>;
}
""")

replace(
    'packages/client/src/components/FlexDoc.tsx',
    "import { RuntimeIntelligencePanel } from './RuntimeIntelligencePanel';\n",
    "import { RuntimeIntelligencePanel } from './RuntimeIntelligencePanel';\nimport { FlexDocMark } from './FlexDocMark';\n",
)
replace(
    'packages/client/src/components/FlexDoc.tsx',
    "{options.logo && <Logo logo={options.logo} onHome={handleHome} />}",
    "{options.logo ? <Logo logo={options.logo} onHome={handleHome} /> : <button type='button' aria-label='Documentation home' onClick={handleHome}><FlexDocMark /></button>}",
)

Path('packages/client/src/components/Footer.tsx').write_text("""import { FLEXDOC_BUILD_INFO } from '../build-info';
import { FlexDocRendererOptions } from '../types/options';

interface FooterProps {
  footerClasses: string;
  footer?: FlexDocRendererOptions['footer'];
}

export const Footer = ({ footerClasses, footer }: FooterProps) => {
  const copyright = footer?.copyright;
  const links = footer?.link || [];
  const build = FLEXDOC_BUILD_INFO;
  const showBuild = footer?.showBuildInfo !== false && build.commit !== 'unknown';
  const sourceDate = build.sourceDate === 'unknown' ? '' : build.sourceDate.slice(0, 10);

  return (
    <footer className={`${footerClasses} w-full border-t`}>
      <div className='mx-auto flex min-h-12 w-full max-w-[1600px] flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-sm'>
        <p>
          {copyright || <>Powered by <a href='https://flexdoc.prauga.com' target='_blank' rel='noopener noreferrer' className='font-semibold hover:opacity-80 transition-opacity'>FlexDoc</a></>}
          {showBuild && <span aria-label='FlexDoc build'> · v{build.version} · contract 1 · {build.commit.slice(0, 7)}{sourceDate && ` · ${sourceDate}`}</span>}
        </p>
        {links.length > 0 && <nav aria-label='Footer links' className='flex flex-wrap gap-x-4 gap-y-2'>
          {links.map((link) => <a key={`${link.text}:${link.url}`} href={link.url} target='_blank' rel='noopener noreferrer' className='hover:opacity-80'>{link.text}</a>)}
        </nav>}
      </div>
    </footer>
  );
};
""")

for path in ['packages/client/src/types/options.ts', 'packages/backend/src/interfaces.ts']:
    replace(
        path,
        "  /** Copyright/legal text shown in the footer. */\n  copyright?: string;\n",
        "  /** Copyright/legal text shown in the footer. */\n  copyright?: string;\n  /** Show renderer build identity when a concrete source revision is available. */\n  showBuildInfo?: boolean;\n",
    )

Path('packages/client/src/components/Footer.observability.test.tsx').write_text("""import React from 'react';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

test('does not show an unknown development build stamp', () => {
  render(<Footer footerClasses='test-footer' footer={{ copyright: 'Acme API' }} />);
  expect(screen.getByText('Acme API')).toBeInTheDocument();
  expect(screen.queryByLabelText('FlexDoc build')).not.toBeInTheDocument();
});

test('allows integrators to disable build identity', () => {
  render(<Footer footerClasses='test-footer' footer={{ copyright: 'Acme API', showBuildInfo: false }} />);
  expect(screen.queryByLabelText('FlexDoc build')).not.toBeInTheDocument();
});
""")

Path('packages/client/src/branding.ts').unlink(missing_ok=True)
