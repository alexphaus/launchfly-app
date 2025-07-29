# Dynamic Website Generation Implementation

This document describes the implementation of the dynamic website generation system for Launchfly.

## Overview

The system allows Launchfly to generate and serve an unlimited number of unique websites from a single Next.js application using subdomain routing. Each generated business gets its own website with custom theme and layout.

## Architecture

```
User visits: fitness-pro.launchfly.site
       ↓
    Middleware detects subdomain
       ↓
    Routes to: /sites/[subdomain]/page.js
       ↓
    Fetches business data from Supabase
       ↓
    Renders website using LaunchflyUI components
```

## Components

### 1. LaunchflyUI Component Library
Located in: `/src/components/launchfly-ui/`

**Available Components:**
- `NavBar` - Navigation header with logo and menu
- `Hero` - Hero section with title, subtitle, and CTAs
- `FeatureGrid` - Grid of features/services
- `TestimonialSlider` - Customer testimonials carousel
- `PricingTable` - Pricing plans display
- `CallToAction` - Call-to-action section
- `Footer` - Footer with contact info and links

Each component accepts props for customization and uses CSS custom properties for theming.

### 2. Dynamic Page Renderer
File: `/src/app/sites/[subdomain]/page.js`

**Features:**
- Fetches business data by subdomain
- Applies custom theme via CSS variables
- Renders layout based on business data
- Provides fallback default layout
- Handles loading and error states

### 3. Middleware
File: `/middleware.js`

**Purpose:**
- Intercepts requests to subdomains
- Routes `[subdomain].launchfly.site` to `/sites/[subdomain]`
- Preserves normal app functionality for API routes and static assets

### 4. Enhanced Business Generator
File: `/src/lib/business-generator.js`

**New Features:**
- Generates theme data (colors, fonts, gradients)
- Creates layout configuration with component props
- Stores complete website structure in `business_data` JSONB field

## Data Structure

### Theme Object
```json
{
  "theme": {
    "colors": {
      "primary": "#3b82f6",
      "secondary": "#1e40af",
      "textDark": "#1f2937",
      "textGray": "#6b7280",
      "borderColor": "#e5e7eb"
    },
    "font": "Inter",
    "gradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  }
}
```

### Layout Object
```json
{
  "layout": [
    {
      "component": "NavBar",
      "props": {
        "businessName": "Fitness Pro",
        "logo": "💪",
        "links": ["About", "Services", "Pricing", "Contact"],
        "ctaText": "Get Started"
      }
    },
    {
      "component": "Hero",
      "props": {
        "title": "Transform Your Body, Transform Your Life",
        "subtitle": "Professional fitness coaching online",
        "ctaText": "Start Training"
      }
    }
  ]
}
```

## Database Schema

The `businesses` table includes:
- `subdomain` (text, unique) - The subdomain for the website
- `business_data` (jsonb) - Contains theme, layout, and business details
- `status` - Must be "ready" for website to be accessible

## Usage

### 1. Generate a Business
When a business is generated through the dashboard, the AI creates:
- Business details (name, tagline, products, etc.)
- Theme configuration
- Layout structure with component props

### 2. Access the Website
- Dashboard shows link: `https://[subdomain].launchfly.site`
- Click to open the generated website
- Website renders using the stored theme and layout

### 3. Customization
The system supports full customization:
- **Theme**: Colors, fonts, gradients
- **Layout**: Component order and props
- **Content**: All text, images, and data

## Development

### Local Testing
For local development, test URLs are:
```
http://localhost:3000/sites/[subdomain]
```

### Production Setup
1. Configure DNS to point `*.launchfly.site` to your app
2. Subdomains will automatically route to the correct business

### Adding New Components
1. Create component in `/src/components/launchfly-ui/`
2. Export from `/src/components/launchfly-ui/index.js`
3. Component will be available in layout configurations

## Testing

Run the test script to verify the system:
```bash
node test-dynamic-websites.js
```

This will:
- Check for ready businesses
- Validate data structure
- Provide test URLs
- Show debugging information

## Benefits

1. **Cost Effective**: One deployment serves unlimited websites
2. **Instant**: Websites are live immediately when business is generated
3. **Maintainable**: Single codebase for all websites
4. **Scalable**: Supports unlimited businesses
5. **Customizable**: Full theme and layout control per business
6. **SEO Friendly**: Each subdomain is treated as a separate site

## Future Enhancements

- Visual drag-and-drop editor for layouts
- More component library options
- Custom domain support
- Advanced theming options
- A/B testing for layouts
