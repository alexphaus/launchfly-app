# Real-Time Content Streaming for Business Generation

## Current vs. Streaming Approach

### Current Approach:
- Wait for complete OpenAI response (3+ minutes)
- Only show status updates while waiting
- Display final website after everything is generated

### Streaming Approach:
- Show content as it's being generated in real-time
- Stream each piece of text as OpenAI produces it
- Update UI with partial content that grows into the full response
- More engaging and transparent experience

## Implementation Plan

### 1. Modify OpenAI API Calls

Convert the API calls in `launch.js` and `analyze.js` to use streaming:

```javascript
// Before (non-streaming)
const response = await openai.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [{ role: "system", content: prompt }],
  temperature: 0.7
});
const content = response.choices[0].message.content;

// After (streaming)
const stream = await openai.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [{ role: "system", content: prompt }],
  temperature: 0.7,
  stream: true  // Enable streaming
});

let content = '';
for await (const chunk of stream) {
  // Get the text fragment from the chunk
  const fragmentText = chunk.choices[0]?.delta?.content || '';
  content += fragmentText;
  
  // Update the business data in real-time with each fragment
  await updateBusinessWithPartialContent(businessId, content, fieldBeingGenerated);
}
```

### 2. Create Real-Time Update Function

Add a function to update business data in real-time:

```javascript
async function updateBusinessWithPartialContent(businessId, partialContent, field) {
  // Create a structured partial update based on which field is being generated
  const partialUpdate = {};
  
  if (field === 'websiteContent') {
    // Parse HTML content as it comes in
    partialUpdate.websiteHtml = partialContent;
  } else if (field === 'products') {
    // Try to parse products as they're generated
    try {
      // If it's valid JSON at this point, parse it
      const products = JSON.parse(partialContent);
      partialUpdate.products = products;
    } catch (e) {
      // Not valid JSON yet, store as raw text
      partialUpdate.partialProductText = partialContent;
    }
  }
  
  // Update the business record with the partial content
  await supabase
    .from('businesses')
    .update({
      business_data: {
        ...existingData,
        ...partialUpdate,
        lastUpdated: new Date().toISOString()
      }
    })
    .eq('id', businessId);
}
```

### 3. Display Real-Time Updates in UI

Modify the LiveWebsiteCard component to show partial content:

```javascript
const LiveWebsiteCard = ({ subdomain, visitors = 0, isGenerating = false, generationStage = null, partialContent = null }) => {
  // ...existing code...
  
  const renderPartialContent = () => {
    if (!partialContent) return null;
    
    return (
      <div className="partial-content-preview">
        <div className="typing-effect">
          {partialContent.slice(0, 500)}... <span className="cursor">|</span>
        </div>
      </div>
    );
  };
  
  return (
    <div>
      {/* Header section */}
      
      {/* Website Preview - Show partial content during generation */}
      <div>
        {isGenerating && generationStage === 'building' ? (
          renderPartialContent()
        ) : (
          <iframe src={websiteUrl} />
        )}
      </div>
    </div>
  );
};
```

## Benefits of Streaming Approach

1. **Engagement**: Users see content appearing letter by letter, like watching someone type
2. **Transparency**: Shows AI working in real-time, not just a loading bar
3. **Reduced Perceived Wait Time**: Users stay engaged watching text appear
4. **Incremental Feedback**: Users can see the direction content is going while it's being created
5. **Modern Experience**: Feels more like an advanced AI system

## Implementation Considerations

### 1. Backend Changes:
- Modify OpenAI calls to use streaming
- Add real-time database updates
- Create endpoint for partial content updates

### 2. Frontend Changes:
- Poll for partial content updates
- Add animations for text appearing
- Style the typing effect

### 3. Data Structure:
- Store partial content in the database
- Track which fields are currently being generated
- Keep version history if needed

## Technical Requirements

1. OpenAI streaming API support
2. Real-time database updates
3. Frontend polling or WebSocket connection
4. Parsing logic for incomplete JSON or HTML
5. UI components for showing partial content
