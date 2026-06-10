// =====================================================
// LAUNCHFLY OPTIMIZED JAVASCRIPT
// Professional, Performant, Accessible
// =====================================================

(function() {
    'use strict';

    // ===== UTILITIES =====
    
    // Debounce function for performance
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

    // Throttle function for scroll events
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ===== DOM ELEMENTS =====
    const header = document.getElementById('header');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    const liveCount = document.getElementById('liveCount');
    const spotsElement = document.getElementById('spots');
    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');

    // ===== STATE =====
    let isMenuOpen = false;
    let currentLiveCount = 127;
    let spotsLeft = 12;

    // ===== MOBILE NAVIGATION =====
    function toggleMobileMenu() {
        isMenuOpen = !isMenuOpen;
        updateMobileMenu();
    }

    function updateMobileMenu() {
        if (isMenuOpen) {
            // Open menu
            mobileMenuBtn.setAttribute('aria-expanded', 'true');
            mobileNav.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            
            // Focus first link for accessibility
            setTimeout(() => {
                const firstLink = mobileNav.querySelector('.mobile-nav-link');
                if (firstLink) firstLink.focus();
            }, 100);
        } else {
            // Close menu
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            mobileNav.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            
            // Return focus to menu button
            mobileMenuBtn.focus();
        }
    }

    function closeMobileMenu() {
        if (isMenuOpen) {
            isMenuOpen = false;
            updateMobileMenu();
        }
    }

    // Mobile menu event listeners
    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        
        // Close menu when clicking links
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
        
        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isMenuOpen) {
                closeMobileMenu();
            }
        });
        
        // Trap focus in mobile menu when open
        mobileNav.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && isMenuOpen) {
                const focusableElements = mobileNav.querySelectorAll(
                    'a, button, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
    }

    // ===== HEADER SCROLL EFFECT =====
    let lastScrollTop = 0;
    const scrollThreshold = 10;

    const handleScroll = throttle(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > scrollThreshold) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScrollTop = scrollTop;
    }, 100);

    window.addEventListener('scroll', handleScroll, { passive: true });

    // ===== SMOOTH SCROLLING =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just "#" or if it's a Tally popup trigger
            if (href === '#' || this.onclick) return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const headerHeight = 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Update focus for accessibility
                target.setAttribute('tabindex', '-1');
                target.focus();
            }
        });
    });

    // ===== TALLY FORM INTEGRATION =====
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    window.openTallyPopup = function(event, plan = 'Default') {
        if (event) {
            event.preventDefault();
        }
        
        // Close mobile menu if open
        closeMobileMenu();
        
        if (typeof Tally !== 'undefined') {
            Tally.openPopup('mOqz1Y', {
                layout: 'modal',
                width: 700,
                hideTitle: true,
                autoClose: 3000,
                onOpen: () => {
                    console.log('Form opened:', plan);
                    // Track form open event
                    trackEvent('form_open', { plan });
                },
                onClose: () => {
                    console.log('Form closed');
                },
                onSubmit: () => {
                    console.log('Form submitted');
                    // Track conversion
                    trackEvent('form_submit', { plan });
                },
                hiddenFields: {
                    sessionId: sessionId,
                    selectedPlan: plan,
                    referrer: document.referrer || 'direct',
                    landingPage: window.location.pathname,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            console.error('Tally form widget not loaded');
            // Fallback: could redirect to a contact page
        }
    };

    // ===== DYNAMIC CONTENT UPDATES =====
    
    // Animate number changes
    function animateNumber(element, start, end, duration) {
        const startTime = Date.now();
        const difference = end - start;
        
        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out cubic)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + difference * easeProgress);
            
            element.textContent = current.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
    }

    // Update live users count
    function updateLiveUsers() {
        if (!liveCount) return;
        
        // Simulate realistic fluctuation
        const change = Math.floor(Math.random() * 11) - 5; // -5 to +5
        const newCount = Math.max(85, Math.min(180, currentLiveCount + change));
        
        animateNumber(liveCount, currentLiveCount, newCount, 1000);
        currentLiveCount = newCount;
    }

    // Update spots left
    function updateSpots() {
        if (!spotsElement || spotsLeft <= 3) return;
        
        // Occasionally decrease spots
        if (Math.random() > 0.7) {
            const newSpots = spotsLeft - 1;
            animateNumber(spotsElement, spotsLeft, newSpots, 500);
            spotsLeft = newSpots;
            
            // Update hero badge if exists
            const heroBadge = document.querySelector('.badge-warning strong');
            if (heroBadge) {
                heroBadge.textContent = spotsLeft;
            }
        }
    }

    // Update countdown timer
    function updateCountdown() {
        if (!hoursElement || !minutesElement) return;
        
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

    // Start dynamic updates
    setInterval(updateLiveUsers, 3000 + Math.random() * 4000);
    setInterval(updateSpots, 25000 + Math.random() * 10000);
    setInterval(updateCountdown, 60000);

    // ===== INTERSECTION OBSERVER =====
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements for scroll animations
    document.addEventListener('DOMContentLoaded', () => {
        const animatedElements = document.querySelectorAll(
            '.step, .testimonial-card, .comparison-card, .pricing-card, .guarantee-card, .faq-item'
        );
        
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    });

    // ===== ANALYTICS HELPER =====
    function trackEvent(eventName, data = {}) {
        // Google Analytics 4
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, data);
        }
        
        // Facebook Pixel
        if (typeof fbq !== 'undefined') {
            fbq('track', eventName, data);
        }
        
        // Console log for development
        if (window.location.hostname === 'localhost') {
            console.log('Track event:', eventName, data);
        }
    }

    // ===== PERFORMANCE OPTIMIZATIONS =====
    
    // Lazy load images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // ===== ACCESSIBILITY ENHANCEMENTS =====
    
    // Handle FAQ keyboard navigation
    document.querySelectorAll('.faq-item').forEach(item => {
        const summary = item.querySelector('.faq-question');
        if (summary) {
            summary.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.open = !item.open;
                }
            });
        }
    });

    // Announce dynamic content changes to screen readers
    function announceChange(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // ===== ERROR HANDLING =====
    window.addEventListener('error', (e) => {
        console.error('Script error:', e.message, 'at', e.filename, ':', e.lineno);
        
        // Report critical errors
        if (e.message && e.message.includes('Tally')) {
            console.error('Tally form error - fallback to email');
            // Could implement fallback behavior here
        }
    });

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Launchfly initialized');
        
        // Check critical elements
        const criticalElements = {
            header: header,
            mobileMenuBtn: mobileMenuBtn,
            mobileNav: mobileNav
        };
        
        Object.entries(criticalElements).forEach(([name, element]) => {
            if (!element) {
                console.warn(`Critical element not found: ${name}`);
            }
        });
        
        // Initial animations
        updateLiveUsers();
        
        // Track page view
        trackEvent('page_view', {
            page_path: window.location.pathname,
            page_title: document.title
        });
    });

})();