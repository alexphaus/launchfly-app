# Progressive Website Preview Generation

## Overview

This system provides real-time updates to the website preview area during AI business generation, showing chunks of data as they become available rather than waiting for the entire process to complete.

## How It Works

### 1. Progressive Data Generation
The `launchBusiness()` function in `src/core/launch.js` has been enhanced to update the database incrementally:

1. **Initial Data** (immediate): Business name, tagline, domain
2. **Logo Generation** (fast): Business logo/emoji  
3. **Theme/Colors** (slow): Website theme and brand colors
4. **Products** (slow): Product offerings and pricing
5. **Marketing** (slow): Marketing strategies and materials
6. **Final Data**: Target customers and growth projections

### 2. Real-time UI Updates
The `LiveWebsiteCard` component tracks available data and progressively reveals content:

- **Skeleton Loading**: Shows while waiting for initial data
- **Business Name**: Appears first with basic styling
- **Logo**: Animates in when generated
- **Brand Colors**: Smoothly transitions the design
- **Hero Content**: Shows tagline when available
- **Products**: Displays product cards as they're created
- **Completion**: Shows sparkle animation and live visitor count

### 3. Enhanced Activity Feed
The `AIActivityFeed` component provides granular updates:

- **Stage Updates**: Shows major generation phases
- **Data-Specific Updates**: Reports when each piece of data is ready
- **Visual Indicators**: Different icons and colors for different types of updates
- **Progressive Disclosure**: Most recent updates are highlighted

## Technical Implementation

### API Endpoint
`/api/business/update-progress` - Updates business data incrementally during generation

### Database Updates
Instead of one large update at the end, multiple smaller updates occur:
```javascript
// Update just the logo
await updateBusinessProgress(businessId, { logo });

// Update theme/colors
await updateBusinessProgress(businessId, { 
  theme: websiteData.theme, 
  layout: websiteData.layout 
});

// Update products
await updateBusinessProgress(businessId, { products });
```

### Polling Strategy
Dashboard polling is optimized for the generation phase:
- **Building Stage**: 1-second polling for rapid updates
- **Other Stages**: 2-second polling to reduce server load

## User Experience Benefits

1. **Immediate Feedback**: Users see their business name and basic info instantly
2. **Progressive Disclosure**: Each piece of data feels like a meaningful step forward
3. **Visual Interest**: Smooth animations and transitions keep users engaged
4. **Reduced Perceived Wait Time**: Chunked updates make long processes feel faster
5. **Clear Status**: Users always know what the AI is working on

## Animation System

New animations support the progressive loading:
- `fadeInUp`: For content appearing from bottom
- `fadeInScale`: For elements that grow into view
- `slideInLeft`: For activity feed updates
- `shimmer`: For loading placeholders
- `sparkleExplosion`: For completion celebration

## Monitoring and Debugging

The system includes comprehensive logging:
- Each generation step is logged with timing
- Progressive updates are tracked
- Fallback handling ensures the UI never gets stuck
- Error states are clearly communicated

This creates a much more engaging and responsive user experience during the business generation process.
