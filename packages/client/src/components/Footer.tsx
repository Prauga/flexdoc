interface FooterProps {
  footerClasses: string;
}

export const Footer = ({ footerClasses }: FooterProps) => {
  return (
    <footer className={`${footerClasses} h-10 w-full flex items-center`}>
      <div className='w-full px-6 text-sm'>
        <p>
          Powered by{' '}
          <a
            href='https://bluejeans117.github.io/flexdoc'
            target='_blank'
            rel='noopener noreferrer'
            className='hover:opacity-80 transition-opacity'
          >
            <span className='font-semibold'>FlexDoc</span>
          </a>
        </p>
      </div>
    </footer>
  );
};
