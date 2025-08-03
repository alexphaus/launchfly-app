import { Inngest } from "inngest";

// Create a single client for your app with production-ready configuration
export const inngest = new Inngest({ 
  id: "launchfly",
  name: "Launchfly AI",
  // Enable event key for better deduplication and idempotency
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Optional: Set custom signing key for security
  signingKey: process.env.INNGEST_SIGNING_KEY,
  // Enable development mode based on environment
  isDev: process.env.NODE_ENV === "development",
  // Add retry configuration
  retryFunction: {
    attempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
  }
});