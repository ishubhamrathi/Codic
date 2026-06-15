import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://codic.shubhamrathi.in';

interface SeoProps {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
}

export function Seo({
  title = 'Codic - Free Online UML Diagram Editor',
  description = 'Codic is a free online UML diagram editor for designing class diagrams, sequence diagrams, and more with real-time collaboration and code generation.',
  url = SITE_URL,
  image = `${SITE_URL}/og-image.png`,
}: SeoProps) {
  const fullTitle = title === 'Codic - Free Online UML Diagram Editor'
    ? title
    : `${title} | Codic`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Codic" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
