// components/ThemedLayout.js - Wrapper to inject theme variables
export default function ThemedLayout({ theme, children }) {
  const style = {
    '--primary-color': theme?.primaryColor || '#007BFF',
    '--secondary-color': theme?.secondaryColor || '#00B8D9',
    '--font-primary': theme?.fontPrimary || 'Inter, sans-serif',
    '--font-secondary': theme?.fontSecondary || 'Inter, sans-serif',
    '--border-radius': theme?.borderRadius || '8px',
    '--spacing': theme?.spacing || '1rem',
    '--text-dark': theme?.textDark || '#1A2B48',
    '--text-gray': theme?.textGray || '#5A6982',
    '--bg-light': theme?.bgLight || '#F9FAFB',
    '--white': theme?.white || '#ffffff'
  };

  return (
    <main style={style} className="themed-layout">
      {children}
    </main>
  );
}
