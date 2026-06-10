// =====================================================
// LAUNCHFLY COMBINED JAVASCRIPT
// High-performance, accessible interactivity
// =====================================================

// Utility: Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== MOBILE NAVIGATION =====
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileNavOverlay = document.getElementById('mobileNavOverlay');
const mobileNavLinks = document.querySelectorAll('.mobile-nav-link, .mobile-nav-cta');
const body = document.body;

// Toggle mobile menu
function toggleMobileMenu() {
    const isActive = mobileNavOverlay.classList.contains('active');
    
    if (isActive) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

function openMobileMenu() {
    mobileNavOverlay.classList.add('active');
    mobileMenuToggle.classList.add('active');
    body.classList.add('menu-open'); // Prevent scrolling when menu is open
    
    // Set focus to first menu item for accessibility
    setTimeout(() => {
        mobileNavLinks[0]?.focus();
    }, 300);
}

function closeMobileMenu() {
    mobileNavOverlay.classList.remove('active');
    mobileMenuToggle.classList.remove('active');
    body.classList.remove('menu-open'); // Restore scrolling
    
    // Return focus to menu toggle
    mobileMenuToggle.focus();
}

// Event listeners for mobile menu
mobileMenuToggle.addEventListener('click', toggleMobileMenu);

// Close menu when clicking on links
mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
        closeMobileMenu();
    });
});

// Close menu on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNavOverlay.classList.contains('active')) {
        closeMobileMenu();
    }
});

// ===== HEADER SCROLL EFFECT =====
const header = document.getElementById('header');
let lastScrollTop = 0;

const handleScroll = debounce(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 10) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    
    lastScrollTop = scrollTop;
}, 10);

window.addEventListener('scroll', handleScroll, { passive: true });

// ===== SMOOTH SCROLLING FOR ANCHOR LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        // Skip if it's just "#"
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        
        if (target) {
            const headerHeight = 80;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ===== FAQ ACCORDION =====
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    
    question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        
        // Close all other items
        faqItems.forEach(otherItem => {
            if (otherItem !== item) {
                otherItem.classList.remove('active');
            }
        });
        
        // Toggle current item
        if (!isActive) {
            item.classList.add('active');
            // Announce to screen readers
            answer.setAttribute('aria-expanded', 'true');
        } else {
            item.classList.remove('active');
            answer.setAttribute('aria-expanded', 'false');
        }
    });
    
    // Initialize ARIA attributes
    answer.setAttribute('aria-expanded', 'false');
});

// ===== TALLY FORM INTEGRATION =====
// Generate unique session ID
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

function openTallyPopup(plan = 'Default') {
    if (event) {
        event.preventDefault();
    }
    
    if (typeof Tally !== 'undefined') {
        Tally.openPopup('mOqz1Y', {
            layout: 'modal',
            width: 700,
            hideTitle: true,
            autoClose: 3000,
            onOpen: () => {
                console.log('Form opened');
            },
            onClose: () => {
                console.log('Form closed');
            },
            onSubmit: () => {
                console.log('Form submitted');
                // Track conversion if analytics is set up
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'conversion', {
                        'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL',
                        'value': 1.0,
                        'currency': 'USD'
                    });
                }
            },
            hiddenFields: {
                sessionID: sessionId,
                selectedPlan: plan,
                referrer: document.referrer,
                landingPage: window.location.pathname
            }
        });
    } else {
        console.error('Tally form widget not loaded');
    }
}

// Make function globally available
window.openTallyPopup = openTallyPopup;

// ===== DYNAMIC CONTENT UPDATES =====
// Live users counter
const liveUsersElement = document.getElementById('liveUsers');
let currentUsers = 127;

function updateLiveUsers() {
    // Simulate realistic fluctuation
    const change = Math.floor(Math.random() * 11) - 5; // -5 to +5
    currentUsers = Math.max(85, Math.min(180, currentUsers + change)); // Keep between 85-180
    
    if (liveUsersElement) {
        const strongElement = liveUsersElement.querySelector('strong');
        if (strongElement) {
            // Animate the number change
            animateValue(strongElement, parseInt(strongElement.textContent), currentUsers, 1000);
        }
    }
}

// Animate number changes
function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16); // 60 FPS
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            element.textContent = end;
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, 16);
}

// Update live users every 3-7 seconds
setInterval(updateLiveUsers, 3000 + Math.random() * 4000);

// Spots countdown
const spotsElement = document.getElementById('spots');
const heroBadge = document.getElementById('heroBadge');
let spotsLeft = 12;

function updateSpots() {
    if (spotsLeft > 3 && Math.random() > 0.7) {
        spotsLeft--;
        
        if (spotsElement) {
            animateValue(spotsElement, parseInt(spotsElement.textContent), spotsLeft, 500);
        }
        
        if (heroBadge) {
            heroBadge.innerHTML = `<span class="badge-icon">🔥</span><span>Limited Time: ${spotsLeft} Spots Left This Week</span>`;
            heroBadge.classList.add('pulse');
            setTimeout(() => heroBadge.classList.remove('pulse'), 1000);
        }
    }
}

// Update spots occasionally
setInterval(updateSpots, 25000 + Math.random() * 10000);

// Countdown timer
function updateCountdown() {
    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');
    
    if (hoursElement && minutesElement) {
        let hours = parseInt(hoursElement.textContent);
        let minutes = parseInt(minutesElement.textContent);
        
        minutes--;
        
        if (minutes < 0) {
            minutes = 59;
            hours--;
            
            if (hours < 0) {
                hours = 23;
            }
        }
        
        hoursElement.textContent = hours.toString().padStart(2, '0');
        minutesElement.textContent = minutes.toString().padStart(2, '0');
    }
}

// Update countdown every minute
setInterval(updateCountdown, 60000);

// ===== INTERSECTION OBSERVER FOR ANIMATIONS =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            
            // Special handling for step cards
            if (entry.target.classList.contains('step-card')) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateX(0)';
            }
            
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.section-header, .story-card, .comparison-card, .pricing-card, .guarantee-card, .faq-item').forEach(el => {
    observer.observe(el);
});

// ===== PERFORMANCE OPTIMIZATIONS =====
// Lazy load images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src || img.src;
                img.classList.add('loaded');
                imageObserver.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll('img').forEach(img => {
        imageObserver.observe(img);
    });
}

// ===== ACCESSIBILITY ENHANCEMENTS =====
// Skip to content link
document.addEventListener('DOMContentLoaded', () => {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'visually-hidden';
    skipLink.textContent = 'Skip to main content';
    skipLink.style.position = 'absolute';
    skipLink.style.top = '-40px';
    skipLink.style.left = '0';
    skipLink.style.zIndex = '100';
    
    skipLink.addEventListener('focus', () => {
        skipLink.style.top = '0';
    });
    
    skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
});

// ===== ERROR HANDLING =====
window.addEventListener('error', (e) => {
    console.error('Script error:', e.message, 'at', e.filename, ':', e.lineno);
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('Launchfly initialized successfully');
    
    // Check if all critical elements exist
    const criticalElements = [
        'header',
        'mobileMenuToggle',
        'mobileNavOverlay',
        'heroBadge'
    ];
    
    criticalElements.forEach(id => {
        if (!document.getElementById(id)) {
            console.warn(`Critical element #${id} not found`);
        }
    });
});