// Launchfly Landing Page - JavaScript

// ========================================
// 1. Header Scroll Effect
// ========================================

window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ========================================
// 2. Mobile Menu Toggle
// ========================================

const mobileMenu = document.getElementById('mobileMenu');
const navLinks = document.querySelector('.nav-links');

if (mobileMenu) {
    mobileMenu.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenu.classList.toggle('active');
    });
}

// ========================================
// 3. Character Counter
// ========================================

const businessInput = document.getElementById('businessIdea');
const charCount = document.getElementById('charCount');

if (businessInput && charCount) {
    businessInput.addEventListener('input', function() {
        // Update character count
        charCount.textContent = this.value.length;
        
        // Auto-resize textarea
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });
}

// ========================================
// 4. Launch Business Function
// ========================================

function launchBusiness() {
    const idea = document.getElementById('businessIdea').value.trim();
    
    if (idea.length < 10) {
        // Update placeholder with encouragement
        businessInput.placeholder = "Come on, give us something to work with! What's your dream business? What problems can you solve?";
        businessInput.focus();
        
        // Add shake animation
        businessInput.style.animation = 'shake 0.5s';
        setTimeout(() => {
            businessInput.style.animation = '';
        }, 500);
        
        return;
    }

    // Show loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');

    // Track the submission
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate AI processing steps
    const steps = [
        { text: "Analyzing your business idea...", delay: 1000 },
        { text: "Identifying target customers...", delay: 2000 },
        { text: "Creating product offerings...", delay: 3000 },
        { text: "Setting up payment systems...", delay: 4000 },
        { text: "Launching marketing campaigns...", delay: 5000 }
    ];

    const loadingText = document.querySelector('.loading-text');
    const loadingSubtext = document.querySelector('.loading-subtext');

    steps.forEach((step, index) => {
        setTimeout(() => {
            loadingText.textContent = step.text;
            
            // Update progress percentage
            const progress = Math.round(((index + 1) / steps.length) * 100);
            loadingSubtext.textContent = `${progress}% complete`;
        }, step.delay);
    });

    // Final redirect
    setTimeout(() => {
        // In production, this would submit to your backend
        const payload = {
            sessionId: sessionId,
            idea: idea,
            timestamp: new Date().toISOString(),
            source: 'minimal-landing'
        };
        
        console.log('Launching business:', payload);
        
        // For demo purposes
        alert('🚀 Your business is live! Redirecting to your dashboard...');
        loadingOverlay.classList.remove('active');
        
        // In production: window.location.href = `/dashboard?session=${sessionId}`;
    }, 6000);
}

// ========================================
// 5. Example Pills Click Handler
// ========================================

document.querySelectorAll('.example-pill').forEach(pill => {
    pill.addEventListener('click', function() {
        if (!this.classList.contains('live')) {
            const text = this.querySelector('span:nth-child(2)').textContent;
            businessInput.value = `I want to start a ${text} business`;
            businessInput.focus();
            
            // Trigger character count update
            const event = new Event('input');
            businessInput.dispatchEvent(event);
        }
    });
});

// ========================================
// 6. FAQ Accordion
// ========================================

const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    
    question.addEventListener('click', () => {
        const wasActive = item.classList.contains('active');
        
        // Close all other FAQ items
        faqItems.forEach(otherItem => {
            otherItem.classList.remove('active');
        });
        
        // Toggle current item
        if (!wasActive) {
            item.classList.add('active');
        }
    });
});

// ========================================
// 7. Smooth Scroll to Top
// ========================================

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Focus on the input after scrolling
    setTimeout(() => {
        businessInput.focus();
    }, 500);
}

// ========================================
// 8. Live Counter Updates
// ========================================

let activeBusinesses = 89;
let revenueToday = 47892;
let spotsRemaining = 12;

// Update live business count
setInterval(() => {
    // Random fluctuation
    activeBusinesses += Math.floor(Math.random() * 5) - 2;
    activeBusinesses = Math.max(50, Math.min(150, activeBusinesses));
    
    // Update any live counters on the page
    const liveCounter = document.querySelector('.live-counter');
    if (liveCounter) {
        liveCounter.textContent = activeBusinesses;
    }
}, 5000);

// Update revenue metrics
setInterval(() => {
    revenueToday += Math.floor(Math.random() * 500);
    
    // Update revenue displays
    const revenueDisplay = document.querySelector('.revenue-today');
    if (revenueDisplay) {
        revenueDisplay.textContent = `$${revenueToday.toLocaleString()}`;
    }
}, 10000);

// ========================================
// 9. Intersection Observer for Animations
// ========================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            
            // Trigger number animations if it's a stat
            if (entry.target.classList.contains('stat-number')) {
                animateNumber(entry.target);
            }
        }
    });
}, observerOptions);

// Observe elements that should animate on scroll
document.querySelectorAll('.step-card, .testimonial-card, .price-card, .guarantee-item').forEach(el => {
    observer.observe(el);
});

// ========================================
// 10. Number Animation
// ========================================

function animateNumber(element) {
    const finalValue = element.textContent;
    const isPrice = finalValue.includes('$');
    const isPercentage = finalValue.includes('%');
    
    // Extract numeric value
    let numericValue = parseInt(finalValue.replace(/[^0-9]/g, ''));
    if (isNaN(numericValue)) return;
    
    // Animate from 0 to final value
    let currentValue = 0;
    const increment = numericValue / 50;
    const timer = setInterval(() => {
        currentValue += increment;
        
        if (currentValue >= numericValue) {
            currentValue = numericValue;
            clearInterval(timer);
        }
        
        // Format and display
        let displayValue = Math.floor(currentValue);
        if (isPrice) {
            displayValue = '$' + displayValue.toLocaleString();
        } else if (isPercentage) {
            displayValue = displayValue + '%';
        } else {
            displayValue = displayValue.toLocaleString();
        }
        
        element.textContent = displayValue;
    }, 20);
}

// ========================================
// 11. Shake Animation CSS
// ========================================

const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// ========================================
// 12. Random Live Updates
// ========================================

function updateLiveExamples() {
    const pills = document.querySelectorAll('.example-pill');
    
    // Randomly toggle live status
    pills.forEach(pill => {
        if (Math.random() > 0.8) {
            if (pill.classList.contains('live')) {
                // Business completed - show revenue
                pill.classList.remove('live');
                const status = pill.querySelector('.pill-status');
                if (status) {
                    const revenue = Math.floor(Math.random() * 2000) + 500;
                    status.outerHTML = `<span class="success-metric">↗ $${revenue} today</span>`;
                }
            } else if (!pill.querySelector('.success-metric')) {
                // Start new business
                pill.classList.add('live');
                const lastSpan = pill.querySelector('span:last-child');
                if (lastSpan && !lastSpan.classList.contains('pill-status')) {
                    lastSpan.outerHTML = '<span class="pill-status"></span>';
                }
            }
        }
    });
}

// Run every 10 seconds
setInterval(updateLiveExamples, 10000);

// ========================================
// 13. Typing Effect for Placeholder
// ========================================

const placeholderTexts = [
    "I want to sell custom t-shirts to college students...",
    "I want to offer social media management for small businesses...",
    "I want to create meal plans for busy professionals...",
    "I want to teach guitar lessons online...",
    "I want to sell handmade jewelry on Instagram..."
];

let currentPlaceholderIndex = 0;

function rotatePlaceholder() {
    if (businessInput && !businessInput.value) {
        currentPlaceholderIndex = (currentPlaceholderIndex + 1) % placeholderTexts.length;
        businessInput.placeholder = placeholderTexts[currentPlaceholderIndex];
    }
}

// Rotate placeholder every 5 seconds
setInterval(rotatePlaceholder, 5000);

// ========================================
// 14. Initialize on Load
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Focus on input field
    if (businessInput) {
        businessInput.focus();
    }
    
    // Add visible class to hero elements
    setTimeout(() => {
        document.querySelector('.hero-content').classList.add('visible');
    }, 100);
});

// ========================================
// 15. Performance Tracking
// ========================================

// Track time on page
let timeOnPage = 0;
setInterval(() => {
    timeOnPage++;
    
    // After 30 seconds, show urgency
    if (timeOnPage === 30 && !document.querySelector('.urgency-popup')) {
        showUrgencyPopup();
    }
}, 1000);

function showUrgencyPopup() {
    // Create urgency notification
    const popup = document.createElement('div');
    popup.className = 'urgency-popup';
    popup.innerHTML = `
        <p>⚡ 3 people just started their businesses!</p>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #5865f2, #4752c4);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 16px;
        animation: slideIn 0.5s ease;
        z-index: 1000;
    `;
    
    document.body.appendChild(popup);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (popup.parentElement) {
            popup.remove();
        }
    }, 5000);
}

// Add slide-in animation
const slideInStyle = document.createElement('style');
slideInStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(slideInStyle);