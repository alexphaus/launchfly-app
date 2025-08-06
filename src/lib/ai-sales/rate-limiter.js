/**
 * @fileoverview Rate limiting for AI chat API
 * Prevents abuse and ensures fair usage
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';

/**
 * Create rate limiter instance
 * 10 messages per minute per IP
 */
const rateLimiter = new RateLimiterMemory({
  points: 10, // Number of points
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 1 minute if exceeded
});

/**
 * Rate limit middleware for Next.js API routes
 * @param {Request} request - Next.js request object
 * @returns {Object|null} Error response or null if allowed
 */
export async function checkRateLimit(request) {
  try {
    // Get client IP from headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';
    
    // Try to consume 1 point
    await rateLimiter.consume(ip);
    
    return null; // Request allowed
  } catch (rateLimiterRes) {
    // Rate limit exceeded
    const retryAfter = Math.round(rateLimiterRes.msBeforeNext / 1000) || 60;
    
    return {
      error: 'Too many requests',
      message: 'Please slow down. You can send up to 10 messages per minute.',
      retryAfter,
      limit: 10,
      remaining: rateLimiterRes.remainingPoints || 0,
      reset: new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString()
    };
  }
}

/**
 * Get current rate limit status for an IP
 * @param {string} ip - Client IP address
 * @returns {Object} Rate limit status
 */
export async function getRateLimitStatus(ip) {
  try {
    const res = await rateLimiter.get(ip);
    return {
      limit: 10,
      remaining: res ? 10 - res.consumedPoints : 10,
      reset: res ? new Date(Date.now() + res.msBeforeNext).toISOString() : null
    };
  } catch (error) {
    return {
      limit: 10,
      remaining: 10,
      reset: null
    };
  }
}

/**
 * Reset rate limit for an IP (admin use)
 * @param {string} ip - Client IP address
 */
export async function resetRateLimit(ip) {
  await rateLimiter.delete(ip);
}