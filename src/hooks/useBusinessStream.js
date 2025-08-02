// hooks/useBusinessStream.js
import { useState, useEffect, useRef } from 'react';

export function useBusinessStream(sessionId, businessId, formData, shouldStart) {
  const [businessData, setBusinessData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [currentActivity, setCurrentActivity] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!shouldStart || !sessionId || !businessId || hasStarted.current) return;

    hasStarted.current = true;
    startStreaming();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [shouldStart, sessionId, businessId]);

  const startStreaming = async () => {
    try {
      setIsStreaming(true);
      setError(null);

      // Start the streaming generation
      const response = await fetch('/api/generate-business-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, businessId, formData })
      });

      if (!response.ok) {
        throw new Error('Failed to start business generation');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamUpdate(data);
            } catch (e) {
              console.error('Error parsing stream data:', e);
            }
          }
        }
      }

      setIsStreaming(false);
    } catch (error) {
      console.error('Streaming error:', error);
      setError(error.message);
      setIsStreaming(false);
    }
  };

  const handleStreamUpdate = (update) => {
    console.log('Stream update received:', update);

    // Add to activities log
    if (update.activity) {
      setActivities(prev => [...prev, {
        id: Date.now(),
        text: update.activity,
        timestamp: update.timestamp,
        type: update.type
      }]);
      setCurrentActivity(update.activity);
    }

    // Update business data based on update type
    switch (update.type) {
      case 'skeleton_ready':
        setBusinessData(update.data);
        break;
        
      case 'basic_info_ready':
        setBusinessData(prev => ({
          ...prev,
          ...update.data
        }));
        break;
        
      case 'theme_ready':
        setBusinessData(prev => ({
          ...prev,
          theme: update.data.theme
        }));
        break;
        
      case 'hero_ready':
        setBusinessData(prev => ({
          ...prev,
          hero: update.data.hero
        }));
        break;
        
      case 'product_ready':
        setBusinessData(prev => {
          const products = [...(prev.products || [])];
          products[update.data.index] = update.data.product;
          return {
            ...prev,
            products: products
          };
        });
        break;
        
      case 'business_complete':
        setBusinessData(prev => ({
          ...prev,
          status: 'ready'
        }));
        break;
        
      case 'first_visitor':
        setBusinessData(prev => ({
          ...prev,
          views: update.data.views
        }));
        break;
        
      case 'error':
        setError(update.message);
        break;
    }
  };

  return {
    businessData,
    activities,
    currentActivity,
    isStreaming,
    error
  };
}
