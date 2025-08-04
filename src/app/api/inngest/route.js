import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { generateBusinessFunction } from "@/lib/inngest/generate-business";
// Temporarily commented out until error handling functions are fixed
// import { 
//   errorHandlerFunction, 
//   validateBusinessFunction, 
//   enhanceBusinessFunction 
// } from "@/lib/inngest/error-handling";

// Create the Inngest route handler for Next.js App Router
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Core business generation
    generateBusinessFunction,
    
    // Support functions - temporarily disabled
    // errorHandlerFunction,
    // validateBusinessFunction,
    // enhanceBusinessFunction,
    
    // Add more functions here as you create them
  ],
  
  // Configure logging
  logLevel: process.env.NODE_ENV === "development" ? "debug" : "info",
});
