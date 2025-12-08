
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
    const phoneMatch = html.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch) extracted.phone = phoneMatch[1];
    
    // Extract email
    const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) extracted.email = emailMatch[1];
    
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
