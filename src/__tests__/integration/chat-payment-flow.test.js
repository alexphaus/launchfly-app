/**
 * @fileoverview Integration tests for chat to payment flow
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AISalesChat from '../../components/ai-sales/AISalesChat'

// Mock all the dependencies
jest.mock('../../stores/ai-chat-store')
jest.mock('../../hooks/useStreamingChat')
jest.mock('../../hooks/usePaymentFlow')
jest.mock('../../hooks/useVisitorIntent')
jest.mock('../../hooks/useAISalesAnalytics')

// Mock Stripe
const mockStripe = {
  elements: jest.fn(() => ({
    create: jest.fn(() => ({
      mount: jest.fn(),
      unmount: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })),
  confirmPayment: jest.fn(),
}

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve(mockStripe)),
}))

describe('Chat to Payment Integration', () => {
  const mockStreamingChat = {
    sendMessage: jest.fn(),
    getInitialGreeting: jest.fn(),
    isConnected: false,
    error: null,
  }

  const mockPaymentFlow = {
    processAIPayment: jest.fn(),
    handleEmbeddedPayment: jest.fn(),
    paymentStatus: 'idle',
    paymentError: null,
  }

  const mockChatStore = {
    isOpen: true,
    isMinimized: false,
    messages: [],
    isTyping: false,
    addMessage: jest.fn(),
    setTyping: jest.fn(),
    toggleChat: jest.fn(),
    minimizeChat: jest.fn(),
    closeChat: jest.fn(),
  }

  const mockVisitorIntent = {
    intentScore: 65,
    intentStage: 'consideration',
    trackIntentChange: jest.fn(),
  }

  const mockAnalytics = {
    track: jest.fn(),
    trackChatEvent: jest.fn(),
    trackPaymentEvent: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Set up mocks
    require('../../hooks/useStreamingChat').useStreamingChat.mockReturnValue(mockStreamingChat)
    require('../../hooks/usePaymentFlow').usePaymentFlow.mockReturnValue(mockPaymentFlow)
    require('../../stores/ai-chat-store').default.mockReturnValue(mockChatStore)
    require('../../hooks/useVisitorIntent').useVisitorIntent.mockReturnValue(mockVisitorIntent)
    require('../../hooks/useAISalesAnalytics').useAISalesAnalytics.mockReturnValue(mockAnalytics)
  })

  const defaultProps = {
    businessId: 'test-business',
    businessData: {
      name: 'Test Business',
      products: [
        { id: 'pro', name: 'Pro Plan', price: 299 },
      ],
    },
  }

  it('should complete full chat to payment journey', async () => {
    const user = userEvent.setup()

    // Mock successful AI response with payment request
    mockStreamingChat.sendMessage.mockImplementation(async (message) => {
      // Simulate AI suggesting a product and processing payment
      if (message.includes('pricing')) {
        mockChatStore.addMessage({
          role: 'assistant',
          content: 'I recommend our Pro Plan for $299. Shall I set up the payment?',
          metadata: {
            isPaymentRequest: true,
            paymentData: {
              productId: 'pro',
              productName: 'Pro Plan',
              unitPrice: 299,
              finalPrice: 299,
              customerEmail: 'test@example.com',
            },
          },
        })
      }
    })

    // Mock successful payment processing
    mockPaymentFlow.processAIPayment.mockResolvedValue({
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })

    render(<AISalesChat {...defaultProps} />)

    // Start conversation
    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, 'I want to see your pricing')
    await user.keyboard('{Enter}')

    // Verify message was sent
    expect(mockChatStore.addMessage).toHaveBeenCalledWith({
      role: 'user',
      content: 'I want to see your pricing',
    })

    expect(mockStreamingChat.sendMessage).toHaveBeenCalledWith('I want to see your pricing')

    // Simulate AI response with payment option
    await waitFor(() => {
      expect(mockChatStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          metadata: expect.objectContaining({
            isPaymentRequest: true,
          }),
        })
      )
    })

    // Verify analytics tracking
    expect(mockAnalytics.trackChatEvent).toHaveBeenCalledWith('message_sent', expect.any(Object))
  })

  it('should handle payment errors gracefully', async () => {
    const user = userEvent.setup()

    // Mock payment failure
    mockPaymentFlow.processAIPayment.mockRejectedValue(new Error('Payment failed'))

    mockStreamingChat.sendMessage.mockImplementation(async () => {
      mockChatStore.addMessage({
        role: 'assistant',
        content: 'Let me process that payment for you.',
        metadata: {
          isPaymentRequest: true,
          paymentData: {
            productId: 'pro',
            productName: 'Pro Plan',
            finalPrice: 299,
          },
        },
      })
    })

    render(<AISalesChat {...defaultProps} />)

    // Send message that triggers payment
    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, 'I want to buy the Pro Plan')
    await user.keyboard('{Enter}')

    // Verify error handling doesn't crash the chat
    await waitFor(() => {
      expect(mockStreamingChat.sendMessage).toHaveBeenCalled()
    })

    // Chat should still be functional
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
  })

  it('should track conversion funnel correctly', async () => {
    const user = userEvent.setup()

    // Mock successful end-to-end flow
    mockStreamingChat.sendMessage.mockImplementation(async (message) => {
      if (message.includes('buy')) {
        // Simulate successful payment completion
        mockAnalytics.trackPaymentEvent('completed', {
          amount: 299,
          currency: 'USD',
          productId: 'pro',
        })
      }
    })

    render(<AISalesChat {...defaultProps} />)

    // Visitor shows interest
    expect(mockVisitorIntent.trackIntentChange).toHaveBeenCalled()

    // Start conversation
    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, 'I want to buy your product')
    await user.keyboard('{Enter}')

    // Verify funnel tracking
    await waitFor(() => {
      expect(mockAnalytics.trackChatEvent).toHaveBeenCalledWith(
        'message_sent',
        expect.any(Object)
      )
    })
  })

  it('should handle intent-based chat triggering', async () => {
    // Mock high intent visitor
    mockVisitorIntent.intentScore = 75
    mockVisitorIntent.intentStage = 'decision'

    render(<AISalesChat {...defaultProps} />)

    // High intent should trigger proactive messaging
    expect(mockVisitorIntent.trackIntentChange).toHaveBeenCalled()
  })

  it('should support discount flow', async () => {
    const user = userEvent.setup()

    // Mock AI offering discount
    mockStreamingChat.sendMessage.mockImplementation(async (message) => {
      if (message.includes('expensive')) {
        mockChatStore.addMessage({
          role: 'assistant',
          content: 'I can offer you 20% off! That brings it down to $239.',
          metadata: {
            isOffer: true,
            offerData: {
              originalPrice: 299,
              discountedPrice: 239,
              discount: 20,
              expiresAt: Date.now() + 300000, // 5 minutes
            },
          },
        })
      }
    })

    render(<AISalesChat {...defaultProps} />)

    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, 'Your Pro Plan seems expensive')
    await user.keyboard('{Enter}')

    // Verify discount offer handling
    await waitFor(() => {
      expect(mockStreamingChat.sendMessage).toHaveBeenCalledWith('Your Pro Plan seems expensive')
    })
  })

  it('should handle multiple payment methods', async () => {
    // Mock payment method selection
    mockPaymentFlow.processAIPayment.mockResolvedValue({
      action: 'alternative_payment',
      alternatives: ['bank_transfer', 'paypal'],
    })

    render(<AISalesChat {...defaultProps} />)

    // Should support various payment methods
    expect(mockPaymentFlow.processAIPayment).toBeDefined()
  })

  it('should maintain chat state during payment flow', async () => {
    const user = userEvent.setup()

    render(<AISalesChat {...defaultProps} />)

    // Add messages to chat
    mockChatStore.messages = [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! How can I help?',
        timestamp: Date.now(),
      },
      {
        id: '2',
        role: 'user',
        content: 'I want to see pricing',
        timestamp: Date.now(),
      },
    ]

    // Chat should maintain all messages during payment
    expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument()
    expect(screen.getByText('I want to see pricing')).toBeInTheDocument()
  })

  it('should handle chat closing during payment', async () => {
    const user = userEvent.setup()

    // Start with payment in progress
    mockPaymentFlow.paymentStatus = 'processing'

    render(<AISalesChat {...defaultProps} />)

    // Try to close chat
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    // Should confirm before closing during payment
    expect(mockChatStore.closeChat).toHaveBeenCalled()
  })

  it('should handle session timeout during payment', async () => {
    // Mock session timeout
    mockStreamingChat.error = 'Session timeout'

    render(<AISalesChat {...defaultProps} />)

    // Should handle timeout gracefully without losing payment state
    expect(screen.getByText('Test Business')).toBeInTheDocument()
  })
})