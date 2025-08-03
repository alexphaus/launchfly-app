import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { generateBusinessFunction } from "@/lib/inngest/generate-business";
import { 
  errorHandlerFunction, 
  validateBusinessFunction, 
  enhanceBusinessFunction 
} from "@/lib/inngest/error-handling";

// Create the Inngest route handler for Next.js App Router
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Core business generation
    generateBusinessFunction,
    
    // Support functions
    errorHandlerFunction,
    validateBusinessFunction,
    enhanceBusinessFunction,
    
    // Add more functions here as you create them
  ],
  // Enable streaming for real-time updates
  streaming: true,
  
  // Configure logging
  logLevel: process.env.NODE_ENV === "development" ? "debug" : "info",
});
