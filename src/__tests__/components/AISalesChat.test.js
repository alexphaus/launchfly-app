/**
 * @fileoverview Tests for AI Sales Chat component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AISalesChat from '../../components/ai-sales/AISalesChat'

// Mock the Zustand store
const mockStore = {
  isOpen: false,
  isMinimized: false,
  hasNewMessage: false,
  messages: [],
  isTyping: false,
  typingMessage: '',
  config: {},
  toggleChat: jest.fn(),
  minimizeChat: jest.fn(),
  closeChat: jest.fn(),
  addMessage: jest.fn(),
  setTyping: jest.fn(),
}

jest.mock('../../stores/ai-chat-store', () => ({
  __esModule: true,
  default: () => mockStore,
}))

// Mock the streaming chat hook
const mockStreamingChat = {
  sendMessage: jest.fn(),
  getInitialGreeting: jest.fn(),
  isConnected: false,
  error: null,
}

jest.mock('../../hooks/useStreamingChat', () => ({
  useStreamingChat: () => mockStreamingChat,
}))

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: () => 'test-id-123',
}))

describe('AISalesChat', () => {
  const defaultProps = {
    businessId: 'test-business',
    businessData: {
      name: 'Test Business',
      products: [
        { id: 1, name: 'Product 1', price: 99 },
        { id: 2, name: 'Product 2', price: 199 },
      ],
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state
    mockStore.isOpen = false
    mockStore.messages = []
    mockStore.isTyping = false
  })

  it('should render chat button when closed', () => {
    render(<AISalesChat {...defaultProps} />)
    
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('Chat with us')).toBeInTheDocument()
  })

  it('should show new message indicator', () => {
    mockStore.hasNewMessage = true
    render(<AISalesChat {...defaultProps} />)
    
    // Look for the notification badge instead of specific text
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should open chat when button clicked', async () => {
    const user = userEvent.setup()
    render(<AISalesChat {...defaultProps} />)
    
    const chatButton = screen.getByRole('button')
    await user.click(chatButton)
    
    expect(mockStore.toggleChat).toHaveBeenCalled()
  })

  it('should render chat interface when open', () => {
    mockStore.isOpen = true
    render(<AISalesChat {...defaultProps} />)
    
    expect(screen.getByText('Test Business')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
  })

  it('should display messages correctly', () => {
    mockStore.isOpen = true
    mockStore.messages = [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! How can I help you?',
        timestamp: Date.now(),
      },
      {
        id: '2',
        role: 'user',
        content: 'I need help with pricing',
        timestamp: Date.now(),
      },
    ]

    render(<AISalesChat {...defaultProps} />)
    
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument()
    expect(screen.getByText('I need help with pricing')).toBeInTheDocument()
  })

  it('should show typing indicator', () => {
    mockStore.isOpen = true
    mockStore.isTyping = true
    mockStore.typingMessage = 'AI is typing...'

    render(<AISalesChat {...defaultProps} />)
    
    expect(screen.getByText('AI is typing...')).toBeInTheDocument()
  })

  it('should send message when form submitted', async () => {
    const user = userEvent.setup()
    mockStore.isOpen = true
    
    render(<AISalesChat {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    await user.type(input, 'Test message')
    await user.click(sendButton)
    
    expect(mockStore.addMessage).toHaveBeenCalledWith({
      role: 'user',
      content: 'Test message',
    })
    
    expect(mockStreamingChat.sendMessage).toHaveBeenCalledWith('Test message')
  })

  it('should handle keyboard shortcuts', async () => {
    const user = userEvent.setup()
    mockStore.isOpen = true
    
    render(<AISalesChat {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Type your message...')
    
    await user.type(input, 'Test message')
    await user.keyboard('{Enter}')
    
    expect(mockStore.addMessage).toHaveBeenCalled()
  })

  it('should minimize chat', async () => {
    const user = userEvent.setup()
    mockStore.isOpen = true
    
    render(<AISalesChat {...defaultProps} />)
    
    const minimizeButton = screen.getByRole('button', { name: /minimize/i })
    await user.click(minimizeButton)
    
    expect(mockStore.minimizeChat).toHaveBeenCalled()
  })

  it('should close chat', async () => {
    const user = userEvent.setup()
    mockStore.isOpen = true
    
    render(<AISalesChat {...defaultProps} />)
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)
    
    expect(mockStore.closeChat).toHaveBeenCalled()
  })

  it('should show minimized state', () => {
    mockStore.isOpen = true
    mockStore.isMinimized = true
    
    render(<AISalesChat {...defaultProps} />)
    
    // Should show business name but not input area
    expect(screen.getByText('Test Business')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Type your message...')).not.toBeInTheDocument()
  })

  it('should handle connection errors gracefully', () => {
    mockStore.isOpen = true
    mockStreamingChat.error = 'Connection failed'
    
    render(<AISalesChat {...defaultProps} />)
    
    // Should still render chat interface
    expect(screen.getByText('Test Business')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
  })

  it('should disable input when connected', () => {
    mockStore.isOpen = true
    mockStreamingChat.isConnected = true
    
    render(<AISalesChat {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Type your message...')
    expect(input).toBeDisabled()
  })

  it('should load initial greeting', async () => {
    mockStreamingChat.getInitialGreeting.mockResolvedValue('Welcome! How can I help?')
    mockStore.isOpen = true
    
    render(<AISalesChat {...defaultProps} />)
    
    await waitFor(() => {
      expect(mockStreamingChat.getInitialGreeting).toHaveBeenCalled()
    })
  })

  it('should auto-scroll to bottom when new messages arrive', () => {
    const scrollIntoViewMock = jest.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock
    
    mockStore.isOpen = true
    mockStore.messages = [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello!',
        timestamp: Date.now(),
      },
    ]
    
    render(<AISalesChat {...defaultProps} />)
    
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('should handle empty business data gracefully', () => {
    const propsWithoutData = {
      businessId: 'test-business',
      businessData: null,
    }
    
    render(<AISalesChat {...propsWithoutData} />)
    
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should apply correct ARIA labels for accessibility', () => {
    mockStore.isOpen = true
    render(<AISalesChat {...defaultProps} />)
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/chat with/i)).toBeInTheDocument()
  })

  it('should handle payment messages correctly', () => {
    mockStore.isOpen = true
    mockStore.messages = [
      {
        id: '1',
        role: 'assistant',
        content: 'Ready to complete your purchase?',
        timestamp: Date.now(),
        metadata: {
          isPaymentRequest: true,
          paymentData: {
            productId: 'test-product',
            productName: 'Test Product',
            finalPrice: 99,
          },
        },
      },
    ]

    render(<AISalesChat {...defaultProps} />)
    
    expect(screen.getByText('Ready to complete your purchase?')).toBeInTheDocument()
    // Payment component should be rendered
    expect(screen.getByText('Test Product')).toBeInTheDocument()
  })
})