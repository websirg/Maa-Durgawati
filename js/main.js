/**
 * MAA DURGAWATI MEDICAL AND CLINIC
 * Main Interactive Script
 * Multi-Page Navigation & WhatsApp Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const WHATSAPP_NUMBER = '916393303352';

  // 1. Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        if (isOpen) {
          icon.classList.remove('fa-bars');
          icon.classList.add('fa-xmark');
        } else {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target) && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        const icon = mobileToggle.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      }
    });
  }

  // 2. Active Page Highlighting based on current pathname
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-menu .nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Check homepage matches
    if ((currentPath === '/' || currentPath.endsWith('index.html') || currentPath === '') && (href === 'index.html' || href === '/')) {
      link.classList.add('active');
    } else if (href !== 'index.html' && href !== '/' && currentPath.includes(href)) {
      link.classList.add('active');
    }
  });

  // 3. Sticky Header Elevation on Scroll
  const siteHeader = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (siteHeader) {
      if (window.scrollY > 20) {
        siteHeader.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
      } else {
        siteHeader.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.06)';
      }
    }
  }, { passive: true });

  // 4. Contact Enquiry Form Submission to WhatsApp
  const contactForm = document.getElementById('medicalEnquiryForm');
  const formFeedback = document.getElementById('formFeedback');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('custName');
      const phoneInput = document.getElementById('custPhone');
      const messageInput = document.getElementById('custMessage');

      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const message = messageInput ? messageInput.value.trim() : '';

      // Validation
      if (!name) {
        showFeedback('कृपया अपना नाम दर्ज करें। (Please enter your name.)', 'error');
        nameInput.focus();
        return;
      }

      const phoneRegex = /^[0-9+\s-]{10,14}$/;
      if (!phone || !phoneRegex.test(phone.replace(/\s+/g, ''))) {
        showFeedback('कृपया एक सही 10 अंकों का मोबाइल नंबर दर्ज करें। (Please enter a valid 10-digit phone number.)', 'error');
        phoneInput.focus();
        return;
      }

      if (!message) {
        showFeedback('कृपया अपनी दवाई या प्रश्न का विवरण दर्ज करें। (Please enter your medicine details or message.)', 'error');
        messageInput.focus();
        return;
      }

      // Format WhatsApp message
      const waMessage = 
        `नमस्ते Drx प्रशांत जी,\n\n` +
        `मुझे *माँ दुर्गावती मेडिकल एंड क्लिनिक* से जानकारी चाहिए:\n` +
        `👤 *नाम:* ${name}\n` +
        `📱 *मोबाइल:* ${phone}\n` +
        `💊 *दवाई / पूछताछ:* ${message}\n\n` +
        `कृपया उपलब्धता और विवरण बताएं। धन्यवाद!`;

      const encodedMessage = encodeURIComponent(waMessage);
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

      showFeedback('आपकी पूछताछ तैयार है! WhatsApp विंडो खोली जा रही है... (Redirecting to WhatsApp...)', 'success');

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 400);
    });
  }

  function showFeedback(text, type) {
    if (!formFeedback) return;
    formFeedback.textContent = text;
    formFeedback.className = `form-feedback-notice ${type}`;
    formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // 5. Dynamic Current Year in Footer
  const yearSpan = document.getElementById('currentYear');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});
