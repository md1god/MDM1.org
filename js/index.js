// Index Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Initialize animations
  initializeAnimations();
  
  // Initialize button interactions
  initializeButtons();
  
  // Initialize parallax effect
  initializeParallax();
  
  // Initialize scroll animations
  initializeScrollAnimations();
});

/**
 * Initialize scroll animations for elements
 */
function initializeAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards';
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  document.querySelectorAll('.feature-card, .stat-item, .cta-section').forEach(el => {
    observer.observe(el);
  });
}

/**
 * Initialize button interactions
 */
function initializeButtons() {
  const buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      // Add ripple effect
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');
      
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

/**
 * Initialize parallax effect
 */
function initializeParallax() {
  const heroSection = document.querySelector('.hero-section');
  
  if (!heroSection) return;
  
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = heroSection.querySelectorAll('[data-parallax]');
    
    parallaxElements.forEach(element => {
      const speed = element.dataset.parallax || 0.5;
      element.style.transform = `translateY(${scrolled * speed}px)`;
    });
  });
}

/**
 * Initialize scroll animations
 */
function initializeScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, {
    threshold: 0.1
  });
  
  document.querySelectorAll('[data-animate]').forEach(el => {
    observer.observe(el);
  });
}

/**
 * Smooth scroll to section
 */
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

/**
 * Add ripple effect CSS
 */
const style = document.createElement('style');
style.textContent = `
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    transform: scale(0);
    animation: ripple-animation 0.6s ease-out;
    pointer-events: none;
  }
  
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Export functions for use in HTML
window.indexFunctions = {
  scrollToSection
};
