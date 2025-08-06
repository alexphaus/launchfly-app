/**
 * @fileoverview Tests for intent scoring algorithm
 */

import { 
  calculateIntentScore, 
  compareIntentScores 
} from '../../lib/visitor-tracking/intent-scorer'

describe('Intent Scorer', () => {
  const baseMockSignals = {
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
  }

  describe('calculateIntentScore', () => {
    it('should calculate basic intent score correctly', () => {
      const result = calculateIntentScore(baseMockSignals)
      
      expect(result).toHaveProperty('score')
      expect(result).toHaveProperty('stage')
      expect(result).toHaveProperty('componentScores')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('confidence')
      
      expect(typeof result.score).toBe('number')
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('should increase score with high engagement signals', () => {
      const highEngagementSignals = {
        ...baseMockSignals,
        mouseVelocity: 200,
        scrollDepth: 80,
        timeOnPage: 180,
        ctaHovers: 3,
        pricingViews: 2
      }
      
      const baseResult = calculateIntentScore(baseMockSignals)
      const highEngagementResult = calculateIntentScore(highEngagementSignals)
      
      expect(highEngagementResult.score).toBeGreaterThan(baseResult.score)
    })

    it('should handle exit intent correctly', () => {
      const exitIntentSignals = {
        ...baseMockSignals,
        exitIntent: true
      }
      
      const result = calculateIntentScore(exitIntentSignals)
      
      expect(result.stage).toBe('exit_intent')
      expect(result.score).toBeGreaterThan(80)
    })

    it('should provide appropriate stage classifications', () => {
      const awarenessSignals = {
        ...baseMockSignals,
        timeOnPage: 10,
        scrollDepth: 10
      }
      
      const considerationSignals = {
        ...baseMockSignals,
        timeOnPage: 120,
        scrollDepth: 60,
        pricingViews: 2,
        ctaHovers: 1
      }
      
      const awarenessResult = calculateIntentScore(awarenessSignals)
      const considerationResult = calculateIntentScore(considerationSignals)
      
      expect(awarenessResult.stage).toBe('awareness')
      expect(considerationResult.stage).toBe('consideration')
    })

    it('should adjust scores for different device types', () => {
      const mobileSignals = {
        ...baseMockSignals,
        deviceInfo: { type: 'mobile' }
      }
      
      const desktopSignals = {
        ...baseMockSignals,
        deviceInfo: { type: 'desktop' }
      }
      
      const mobileResult = calculateIntentScore(mobileSignals)
      const desktopResult = calculateIntentScore(desktopSignals)
      
      // Mobile typically has slightly lower conversion rates
      expect(mobileResult.score).toBeLessThanOrEqual(desktopResult.score)
    })

    it('should generate relevant recommendations', () => {
      const highIntentSignals = {
        ...baseMockSignals,
        pricingViews: 3,
        ctaHovers: 2,
        timeOnPage: 150
      }
      
      const result = calculateIntentScore(highIntentSignals)
      
      expect(result.recommendations).toBeInstanceOf(Array)
      expect(result.recommendations.length).toBeGreaterThan(0)
      
      const hasUrgentRec = result.recommendations.some(rec => rec.priority === 'high')
      expect(hasUrgentRec).toBe(true)
    })

    it('should calculate confidence correctly', () => {
      const limitedDataSignals = {
        ...baseMockSignals,
        timeOnPage: 5
      }
      
      const richDataSignals = {
        ...baseMockSignals,
        timeOnPage: 180,
        scrollDepth: 80,
        pricingViews: 2,
        ctaHovers: 1,
        viewedProducts: ['product1', 'product2']
      }
      
      const limitedResult = calculateIntentScore(limitedDataSignals)
      const richResult = calculateIntentScore(richDataSignals)
      
      expect(richResult.confidence).toBeGreaterThan(limitedResult.confidence)
    })

    it('should handle edge cases gracefully', () => {
      const emptySignals = {}
      const negativeSignals = {
        ...baseMockSignals,
        mouseVelocity: -10,
        scrollDepth: -5
      }
      
      expect(() => calculateIntentScore(emptySignals)).not.toThrow()
      expect(() => calculateIntentScore(negativeSignals)).not.toThrow()
      
      const emptyResult = calculateIntentScore(emptySignals)
      expect(emptyResult.score).toBeGreaterThanOrEqual(0)
    })

    it('should penalize inactivity appropriately', () => {
      const activeSignals = {
        ...baseMockSignals,
        inactivityPeriods: 0
      }
      
      const inactiveSignals = {
        ...baseMockSignals,
        inactivityPeriods: 5
      }
      
      const activeResult = calculateIntentScore(activeSignals)
      const inactiveResult = calculateIntentScore(inactiveSignals)
      
      expect(inactiveResult.score).toBeLessThan(activeResult.score)
    })
  })

  describe('compareIntentScores', () => {
    it('should detect significant changes', () => {
      const previousAnalysis = calculateIntentScore(baseMockSignals)
      const currentSignals = {
        ...baseMockSignals,
        pricingViews: 3,
        ctaHovers: 2
      }
      const currentAnalysis = calculateIntentScore(currentSignals)
      
      const comparison = compareIntentScores(previousAnalysis, currentAnalysis)
      
      expect(comparison).toHaveProperty('scoreDifference')
      expect(comparison).toHaveProperty('isSignificantChange')
      expect(comparison).toHaveProperty('stageChanged')
      expect(comparison).toHaveProperty('trend')
      
      expect(comparison.scoreDifference).toBeGreaterThan(0)
      expect(comparison.trend).toBe('increasing')
    })

    it('should identify stage changes', () => {
      const awarenessSignals = {
        ...baseMockSignals,
        timeOnPage: 10
      }
      
      const decisionSignals = {
        ...baseMockSignals,
        timeOnPage: 200,
        pricingViews: 4,
        ctaHovers: 3
      }
      
      const awarenessAnalysis = calculateIntentScore(awarenessSignals)
      const decisionAnalysis = calculateIntentScore(decisionSignals)
      
      const comparison = compareIntentScores(awarenessAnalysis, decisionAnalysis)
      
      expect(comparison.stageChanged).toBe(true)
    })

    it('should provide new recommendations only', () => {
      const lowIntentSignals = {
        ...baseMockSignals,
        timeOnPage: 20
      }
      
      const highIntentSignals = {
        ...baseMockSignals,
        timeOnPage: 200,
        pricingViews: 3
      }
      
      const lowAnalysis = calculateIntentScore(lowIntentSignals)
      const highAnalysis = calculateIntentScore(highIntentSignals)
      
      const comparison = compareIntentScores(lowAnalysis, highAnalysis)
      
      // Should only include new recommendations
      const newRecActions = comparison.recommendations.map(rec => rec.action)
      const previousRecActions = lowAnalysis.recommendations.map(rec => rec.action)
      
      newRecActions.forEach(action => {
        expect(previousRecActions).not.toContain(action)
      })
    })

    it('should calculate trends correctly', () => {
      const higherScore = calculateIntentScore({
        ...baseMockSignals,
        pricingViews: 2
      })
      
      const lowerScore = calculateIntentScore(baseMockSignals)
      
      const increasingComparison = compareIntentScores(lowerScore, higherScore)
      const decreasingComparison = compareIntentScores(higherScore, lowerScore)
      const stableComparison = compareIntentScores(lowerScore, lowerScore)
      
      expect(increasingComparison.trend).toBe('increasing')
      expect(decreasingComparison.trend).toBe('decreasing')
      expect(stableComparison.trend).toBe('stable')
    })
  })

  describe('Component Scores', () => {
    it('should calculate engagement component correctly', () => {
      const engagedSignals = {
        ...baseMockSignals,
        mouseVelocity: 150,
        scrollDepth: 90,
        timeOnPage: 240
      }
      
      const result = calculateIntentScore(engagedSignals)
      
      expect(result.componentScores.engagement).toBeGreaterThan(50)
    })

    it('should calculate interest component correctly', () => {
      const interestedSignals = {
        ...baseMockSignals,
        ctaHovers: 4,
        pricingViews: 3,
        viewedProducts: ['p1', 'p2', 'p3']
      }
      
      const result = calculateIntentScore(interestedSignals)
      
      expect(result.componentScores.interest).toBeGreaterThan(30)
    })

    it('should calculate urgency component correctly', () => {
      const urgentSignals = {
        ...baseMockSignals,
        exitIntent: true,
        pricingViews: 3,
        ctaHovers: 4
      }
      
      const result = calculateIntentScore(urgentSignals)
      
      expect(result.componentScores.urgency).toBeGreaterThan(40)
    })
  })
})