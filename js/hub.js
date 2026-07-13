// Hub Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Initialize copy buttons
  initializeCopyButtons();
  
  // Initialize price ticker (simulated)
  updatePriceTicker();
  
  // Initialize animations
  initializeAnimations();
});

/**
 * Initialize copy-to-clipboard functionality
 */
function initializeCopyButtons() {
  const copyButtons = document.querySelectorAll('.copy-btn');
  
  copyButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      const addressText = this.previousElementSibling.textContent;
      
      // Copy to clipboard
      navigator.clipboard.writeText(addressText).then(() => {
        // Show feedback
        const originalText = this.textContent;
        this.textContent = '✓ تم النسخ';
        this.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
          this.textContent = originalText;
          this.style.backgroundColor = '';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('فشل النسخ. يرجى المحاولة يدويًا.');
      });
    });
  });
}

/**
 * Update price ticker (simulated)
 */
function updatePriceTicker() {
  const priceDisplay = document.querySelector('.price-display');
  
  if (!priceDisplay) return;
  
  // Simulated price (in real app, fetch from API)
  const basePrice = 1.00;
  const variation = (Math.random() - 0.5) * 0.01; // ±0.5% variation
  const currentPrice = (basePrice + variation).toFixed(4);
  
  priceDisplay.textContent = `$${currentPrice}`;
  
  // Update every 5 seconds
  setInterval(() => {
    const newVariation = (Math.random() - 0.5) * 0.01;
    const newPrice = (basePrice + newVariation).toFixed(4);
    priceDisplay.textContent = `$${newPrice}`;
  }, 5000);
}

/**
 * Initialize scroll animations
 */
function initializeAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1
  });
  
  document.querySelectorAll('.contract-item, .link-card').forEach(el => {
    observer.observe(el);
  });
}

/**
 * Handle network switching (for future implementation)
 */
function switchNetwork(networkName) {
  console.log('Switching to network:', networkName);
  // Implementation would connect to wallet and switch network
}

/**
 * Format address for display
 */
function formatAddress(address) {
  if (!address) return 'N/A';
  if (address.length <= 10) return address;
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

// Export functions for use in HTML
window.hubFunctions = {
  switchNetwork,
  formatAddress
};
