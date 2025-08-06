/**
 * @fileoverview Tests for visitor intent detection hook
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useVisitorIntent } from '../../hooks/useVisitorIntent'

// Mock the tracker and scorer modules
jest.mock('../../lib/visitor-tracking/tracker', () => ({
  VisitorTracker: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    getSignals: jest.fn(() => ({
      mouseVelocity: 50,
      scrollDepth: 25,
      timeOnPage: 30,
      ctaHovers: 0,
      pricingViews: 0,
      exitIntent: false,
      inactivityPeriods: 0,
      viewedProducts: [],
      deviceInfo: { type: 'desktop' },
      referrer: 'direct'
    })),
    on: jest.fn(),
    reset: jest.fn(),
  }))
}))

jest.mock('../../lib/visitor-tracking/intent-scorer', () => ({
  calculateIntentScore: jest.fn(() => ({
    score: 45,
    stage: 'interest',
    confidence: 75,
    componentScores: {
      engagement: 30,
      interest: 20,
      urgency: 10,
      behavior: 15
    },
    recommendations: [
      {
        action: 'show_chat',
        priority: 'medium',
        message: 'Display chat widget'
      }
    ],
    signals: {
      mouseVelocity: 50,
      scrollDepth: 25,
      timeOnPage: 30,
      ctaHovers: 0,
      pricingViews: 0,
      exitIntent: false
    }
  })),
  compareIntentScores: jest.fn(() => ({
    scoreDifference: 5,
    isSignificantChange: false,
    stageChanged: false,
    trend: 'increasing',
    recommendations: []
  }))
}))

describe('useVisitorIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true
    }))

    expect(result.current.visitorId).toBeDefined()
    expect(result.current.sessionId).toBeDefined()
    expect(result.current.intentAnalysis).toBeNull()
    expect(result.current.isTracking).toBe(false)
    expect(result.current.intentScore).toBe(0)
    expect(result.current.intentStage).toBe('awareness')
  })

  it('should start tracking when enabled', async () => {
    const onIntentChange = jest.fn()
    
    const { result } = renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true,
      onIntentChange
    }))

    await waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    })
  })

  it('should not start tracking when disabled', () => {
    const { result } = renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: false
    }))

    expect(result.current.isTracking).toBe(false)
  })

  it('should calculate intent score correctly', async () => {
    const onIntentChange = jest.fn()
    
    const { result } = renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true,
      onIntentChange
    }))

    await act(async () => {
      // Simulate intent calculation
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    await waitFor(() => {
      expect(result.current.intentAnalysis).toBeDefined()
      expect(result.current.intentScore).toBe(45)
      expect(result.current.intentStage).toBe('interest')
    })
  })

  it('should call onIntentChange when intent changes significantly', async () => {
    const onIntentChange = jest.fn()
    
    renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true,
      onIntentChange
    }))

    await waitFor(() => {
      expect(onIntentChange).toHaveBeenCalled()
    })
  })

  it('should generate appropriate opener messages', async () => {
    const { result } = renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true
    }))

    await waitFor(() => {
      expect(result.current.intentAnalysis).toBeDefined()
    })

    const opener = result.current.getRecommendedOpener()
    expect(opener).toBeDefined()
    expect(typeof opener.message).toBe('string')
  })

  it('should handle exit intent correctly', async () => {
    // Mock exit intent scenario
    const mockTracker = require('../../lib/visitor-tracking/tracker').VisitorTracker
    mockTracker.mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      getSignals: jest.fn(() => ({
        exitIntent: true,
        mouseVelocity: 100,
        scrollDepth: 80,
        timeOnPage: 120
      })),
      on: jest.fn(),
      reset: jest.fn(),
    }))

    const mockScorer = require('../../lib/visitor-tracking/intent-scorer')
    mockScorer.calculateIntentScore.mockReturnValue({
      score: 85,
      stage: 'exit_intent',
      signals: { exitIntent: true }
    })

    const { result } = renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true
    }))

    await waitFor(() => {
      expect(result.current.isExitIntent()).toBe(true)
      expect(result.current.isHighIntent()).toBe(true)
    })
  })

  it('should send analytics updates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })

    renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true
    }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai-sales/intent',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('test-business')
        })
      )
    })
  })

  it('should reset tracking correctly', async () => {
    const { result } = renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true
    }))

    await waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    })

    act(() => {
      result.current.resetTracking()
    })

    expect(result.current.intentAnalysis).toBeNull()
  })

  it('should provide correct threshold checks', async () => {
    const { result } = renderHook(() => useVisitorIntent({
      businessId: 'test-business',
      enabled: true
    }))

    await waitFor(() => {
      expect(result.current.intentAnalysis).toBeDefined()
    })

    expect(result.current.shouldShowChat()).toBe(true) // 45 >= 45 threshold
    expect(result.current.shouldSendProactiveMessage()).toBe(false) // 45 < 60 threshold
  })
})