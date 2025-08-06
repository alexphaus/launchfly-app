/**
 * @fileoverview Tests for error recovery hook
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useErrorRecovery } from '../../hooks/useErrorRecovery'

describe('useErrorRecovery', () => {
  let mockAnalytics

  beforeEach(() => {
    jest.clearAllMocks()
    mockAnalytics = {
      track: jest.fn()
    }
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useErrorRecovery({
      component: 'test-component',
      analytics: mockAnalytics
    }))

    expect(result.current.error).toBeNull()
    expect(result.current.isRecovering).toBe(false)
    expect(result.current.retryCount).toBe(0)
    expect(result.current.fallbackActive).toBe(false)
    expect(result.current.hasError).toBe(false)
    expect(result.current.canRetry).toBe(true)
  })

  it('should handle errors correctly', async () => {
    const onError = jest.fn()
    const { result } = renderHook(() => useErrorRecovery({
      component: 'test-component',
      analytics: mockAnalytics,
      onError
    }))

    const testError = new Error('Test error')
    const context = { operation: 'test' }

    await act(async () => {
      await result.current.handleError(testError, context)
    })

    expect(result.current.error).toBe(testError)
    expect(result.current.hasError).toBe(true)
    expect(onError).toHaveBeenCalledWith(testError, expect.objectContaining({
      component: 'test-component',
      operation: 'test'
    }))
  })

  it('should execute operations with recovery', async () => {
    const { result } = renderHook(() => useErrorRecovery({
      component: 'test-component',
      enableRetry: true,
      maxRetries: 2
    }))

    // Test successful operation
    const successOperation = jest.fn().mockResolvedValue('success')
    
    await act(async () => {
      const response = await result.current.executeWithRecovery(successOperation)
      expect(response.success).toBe(true)
      expect(response.data).toBe('success')
    })

    expect(successOperation).toHaveBeenCalledTimes(1)
  })

  it('should retry failed operations', async () => {
    const { result } = renderHook(() => useErrorRecovery({
      component: 'test-component',
      enableRetry: true,
      maxRetries: 2
    }))

    let callCount = 0
    const failingOperation = jest.fn().mockImplementation(() => {
      callCount++
      if (callCount <= 2) {
        throw new Error('Network error')
      }
      return 'success'
    })

    await act(async () => {
      const response = await result.current.executeWithRecovery(failingOperation, {
        retryOnFailure: true
      })
      
      // Should eventually succeed after retries
      expect(response.success).toBe(true)
      expect(response.data).toBe('success')
    })

    expect(failingOperation).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('should use fallback when retries exhausted', async () => {
    const { result } = renderHook(() => useErrorRecovery({
      component: 'test-component',
      enableRetry: true,
      maxRetries: 2
    }))

    const failingOperation = jest.fn().mockRejectedValue(new Error('Persistent error'))

    await act(async () => {
      const response = await result.current.executeWithRecovery(failingOperation, {
        fallbackValue: 'fallback-result',
        retryOnFailure: true
      })
      
      expect(response.success).toBe(false)
      expect(response.error).toBe('Persistent error')
    })

    expect(failingOperation).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('should clear errors correctly', async () => {
    const { result } = renderHook(() => useErrorRecovery())

    // Set an error
    await act(async () => {
      await result.current.handleError(new Error('Test error'))
    })

    expect(result.current.hasError).toBe(true)

    // Clear the error
    act(() => {
      result.current.clearError()
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.retryCount).toBe(0)
    expect(result.current.fallbackActive).toBe(false)
  })

  it('should force recovery strategies', async () => {
    const { result } = renderHook(() => useErrorRecovery())

    // Set an error first
    await act(async () => {
      await result.current.handleError(new Error('Test error'))
    })

    expect(result.current.hasError).toBe(true)

    // Force clear recovery
    act(() => {
      result.current.forceRecovery('clear')
    })

    expect(result.current.hasError).toBe(false)

    // Force fallback recovery
    act(() => {
      result.current.forceRecovery('fallback')
    })

    expect(result.current.fallbackActive).toBe(true)
  })

  it('should provide recovery statistics', async () => {
    const { result } = renderHook(() => useErrorRecovery({
      maxRetries: 3
    }))

    // Initial stats
    let stats = result.current.getRecoveryStats()
    expect(stats.hasError).toBe(false)
    expect(stats.retryCount).toBe(0)
    expect(stats.canRetry).toBe(true)

    // After error
    await act(async () => {
      await result.current.handleError(new Error('Test error'))
    })

    stats = result.current.getRecoveryStats()
    expect(stats.hasError).toBe(true)
    expect(stats.currentError).toBe('Test error')
    expect(stats.canRetry).toBe(true)
  })

  it('should set auto-recovery timeout', async () => {
    jest.useFakeTimers()
    
    const { result } = renderHook(() => useErrorRecovery())

    // Set an error
    await act(async () => {
      await result.current.handleError(new Error('Test error'))
    })

    expect(result.current.hasError).toBe(true)

    // Set auto-recovery with short timeout
    act(() => {
      result.current.setAutoRecovery(1000)
    })

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(1100)
    })

    // Auto-recovery should have cleared the error
    expect(result.current.hasError).toBe(false)

    jest.useRealTimers()
  }, 10000)

  it('should track analytics for errors', async () => {
    const { result } = renderHook(() => useErrorRecovery({
      component: 'test-component',
      analytics: mockAnalytics
    }))

    await act(async () => {
      await result.current.handleError(new Error('Analytics test error'))
    })

    // Should track error in analytics
    expect(mockAnalytics.track).toHaveBeenCalled()
  })

  it('should classify different error types correctly', async () => {
    const { result } = renderHook(() => useErrorRecovery())

    // Network error
    await act(async () => {
      const networkError = new Error('fetch failed')
      await result.current.handleError(networkError)
    })

    // Payment error
    await act(async () => {
      const paymentError = new Error('card declined')
      await result.current.handleError(paymentError)
    })

    // Rate limit error
    await act(async () => {
      const rateLimitError = new Error('rate limit exceeded')
      rateLimitError.status = 429
      await result.current.handleError(rateLimitError)
    })

    // Each should be handled appropriately
    expect(result.current.getRecoveryStats().failureStats).toBeDefined()
  })
})