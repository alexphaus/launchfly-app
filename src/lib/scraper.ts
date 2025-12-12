
/**
 * Helper function to extract email from HTML
 */
function extractEmailFromHtml(html: string): string | null {
  const foundEmails = new Set<string>();
  
  // 1. Look for mailto: links (High Confidence)
  const mailtoMatches = html.matchAll(/href=["']mailto:([^"']+)["']/gi);
  for (const match of mailtoMatches) {
    const email = match[1].split('?')[0].trim();
    if (email && email.includes('@')) foundEmails.add(email);
  }

  // 2. Look for text emails
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const textEmails = [...html.matchAll(emailRegex)].map(m => m[1]);
  textEmails.forEach(e => foundEmails.add(e));

  // 3. Filter and prioritize emails
  const junkDomains = ['sentry.io', 'wix.com', 'squarespace.com', 'googleapis.com', 'example.com', 'domain.com', 'schema.org', 'w3.org'];
  
  const validEmails = Array.from(foundEmails).filter(email => {
    const domain = email.split('@')[1] || '';
    if (junkDomains.some(d => domain.includes(d))) return false;
    if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.js') || email.endsWith('.css')) return false;
    if (email.includes('webpack') || email.includes('node_modules')) return false;
    return true;
  });

  // Sort emails by quality
  const priorityPrefixes = ['info', 'contact', 'hello', 'service', 'support', 'office', 'admin', 'enquiries', 'sales'];
  
  validEmails.sort((a, b) => {
    const aPrefix = a.split('@')[0].toLowerCase();
    const bPrefix = b.split('@')[0].toLowerCase();
    const aIsPriority = priorityPrefixes.includes(aPrefix);
    const bIsPriority = priorityPrefixes.includes(bPrefix);
    
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;
    return 0;
  });

  return validEmails.length > 0 ? validEmails[0] : null;
}

/**
 * Fetch a single page's HTML
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Scrape website content for context
 * Extracts text, meta tags, and key information from a URL
 */
export async function scrapeWebsiteContent(url: string) {
  if (!url) return null;
  
  try {
    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LaunchflyBot/1.0; +https://launchfly.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      console.log(`Website fetch failed: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract useful content from HTML
    const extracted = {
      title: '',
      description: '',
      headings: [] as string[],
      bodyText: '',
      phone: '',
      email: '',
      address: '',
      services: [] as string[],
    };
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) extracted.title = titleMatch[1].trim();
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (descMatch) extracted.description = descMatch[1].trim();
    
    // Extract h1, h2, h3 headings
    const headingMatches = html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
    for (const match of headingMatches) {
      const heading = match[1].replace(/<[^>]+>/g, '').trim();
      if (heading && heading.length > 2 && heading.length < 200) {
        extracted.headings.push(heading);
      }
    }
    extracted.headings = extracted.headings.slice(0, 10); // Limit to 10
    
    // Extract phone numbers
    // 1. Look for tel: links (High Confidence)
    const telMatches = html.matchAll(/href=["']tel:([^"']+)["']/gi);
    for (const match of telMatches) {
      const phone = match[1].trim();
      if (phone.length > 6) {
        extracted.phone = phone;
        break; // Found a high-confidence phone
      }
    }

    // 2. If no tel link, look for visible phone patterns
    if (!extracted.phone) {
      // Matches: (123) 456-7890, 123-456-7890, 1300 123 456, +61 4 1234 5678
      // Avoids matching long strings of numbers like timestamps or IDs
      const phoneRegex = /(?:(?:\+|00)[\d]{1,3}[-.\s]?)?\(?[\d]{2,4}\)?[-.\s]?[\d]{3,4}[-.\s]?[\d]{3,4}/g;
      const potentialPhones = [...html.matchAll(phoneRegex)].map(m => m[0]);
      
      // Filter and score potential phones
      const validPhones = potentialPhones.filter(p => {
        const digits = p.replace(/\D/g, '');
        // Must have 8-15 digits
        if (digits.length < 8 || digits.length > 15) return false;
        // Avoid common false positives (timestamps, repetitive numbers)
        if (digits.startsWith('19') && digits.length === 4) return false; // Year
        if (/^(\d)\1+$/.test(digits)) return false; // All same digits
        return true;
      });

      if (validPhones.length > 0) {
        extracted.phone = validPhones[0];
      }
    }
    
    // Extract email from main page first
    extracted.email = extractEmailFromHtml(html) || '';
    
    // If no email found on homepage, try common contact pages
    if (!extracted.email) {
      const baseUrl = new URL(normalizedUrl);
      const contactPaths = ['/contact', '/contact-us', '/about', '/about-us', '/get-in-touch'];
      
      for (const path of contactPaths) {
        const contactUrl = `${baseUrl.origin}${path}`;
        console.log(`No email on homepage, trying: ${contactUrl}`);
        
        const contactHtml = await fetchPage(contactUrl);
        if (contactHtml) {
          const contactEmail = extractEmailFromHtml(contactHtml);
          if (contactEmail) {
            extracted.email = contactEmail;
            console.log(`Found email on ${path}: ${contactEmail}`);
            break;
          }
        }
      }
    }
    
    // Strip HTML tags and get body text (limited)
    let bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit body text to ~2000 chars for context
    extracted.bodyText = bodyText.slice(0, 2000);
    
    return extracted;
    
  } catch (error) {
    console.error('Website scrape error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
