// Whitepaper Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Initialize table of contents
  initializeTableOfContents();
  
  // Initialize smooth scrolling
  initializeSmoothScroll();
  
  // Initialize animations
  initializeAnimations();
  
  // Initialize download button
  initializeDownloadButton();
});

/**
 * Initialize table of contents functionality
 */
function initializeTableOfContents() {
  const tocLinks = document.querySelectorAll('.toc a');
  
  tocLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Highlight the clicked link
        tocLinks.forEach(l => l.style.color = '');
        this.style.color = '#f0c060';
        
        setTimeout(() => {
          this.style.color = '';
        }, 2000);
      }
    });
  });
}

/**
 * Initialize smooth scrolling for all internal links
 */
function initializeSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

/**
 * Initialize scroll animations
 */
function initializeAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1
  });
  
  document.querySelectorAll('.section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(section);
  });
}

/**
 * Initialize download button
 */
function initializeDownloadButton() {
  const downloadBtn = document.querySelector('.download-btn');
  
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Show loading state
      const originalText = this.textContent;
      this.textContent = 'جاري التحميل...';
      this.disabled = true;
      
      // Simulate download (in real app, this would trigger actual PDF download)
      setTimeout(() => {
        // Create a simple PDF or redirect to PDF URL
        console.log('Downloading whitepaper...');
        
        // Reset button
        this.textContent = originalText;
        this.disabled = false;
        
        // Show success message
        alert('تم تحميل الورقة البيضاء بنجاح');
      }, 1500);
    });
  }
}

/**
 * Generate table of contents from headings
 */
function generateTableOfContents() {
  const sections = document.querySelectorAll('.section h2');
  const tocContainer = document.querySelector('.toc ul');
  
  if (!tocContainer) return;
  
  sections.forEach((heading, index) => {
    const id = heading.id || `section-${index}`;
    heading.id = id;
    
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${id}`;
    a.textContent = heading.textContent;
    
    li.appendChild(a);
    tocContainer.appendChild(li);
  });
}

/**
 * Track reading progress
 */
function trackReadingProgress() {
  const sections = document.querySelectorAll('.section');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const progressBar = document.querySelector('.reading-progress');
        if (progressBar) {
          const progress = (Array.from(sections).indexOf(entry.target) / sections.length) * 100;
          progressBar.style.width = progress + '%';
        }
      }
    });
  }, {
    threshold: 0.5
  });
  
  sections.forEach(section => observer.observe(section));
}

// Export functions for use in HTML
window.whitepaperFunctions = {
  generateTableOfContents,
  trackReadingProgress
};
