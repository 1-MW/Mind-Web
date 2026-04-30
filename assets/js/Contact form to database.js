function showRateLimitWarning() {
  const status = document.getElementById('status');
  if(status) status.style.display = 'none';
  
  const overlay = document.createElement('div');
  overlay.className = 'form-success-overlay';
  overlay.innerHTML = `
    <div class="form-success-card" style="border-top: 4px solid #ffaa00;">
      <div class="form-success-checkmark" style="background: rgba(255, 170, 0, 0.2); color: #ffaa00; border-color: rgba(255, 170, 0, 0.4);">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="form-success-title"><span class="en">Limit Reached</span><span class="ar">تم بلوغ الحد الأقصى</span></h3>
      <p class="form-success-message">
        <span class="en" style="display:block;margin-bottom:8px;">You've reached the maximum number of messages allowed.<br>Please wait 24 hours after receiving a reply before sending again.<br>Thank you for your patience.</span>
        <span class="ar" style="display:block;">لقد وصلت إلى الحد الأقصى للرسائل المسموح بها.<br>يرجى الانتظار 24 ساعة بعد الرد على رسائلك قبل الإرسال مجدداً.<br>شكراً لتفهمك.</span>
      </p>
      <button class="form-success-close" onclick="this.closest('.form-success-overlay').remove()">Got it</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Disable form fully
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Rate Limited';
    submitBtn.style.background = 'transparent';
    submitBtn.style.border = '1px solid #ffaa00';
    submitBtn.style.color = '#ffaa00';
    submitBtn.style.cursor = 'not-allowed';
  }
}

async function submitForm(event) { 
  event.preventDefault(); 
  const form = event.target; 
  const status = document.getElementById('status'); 
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnIcon = document.getElementById('btnIcon');

  const firstName = document.getElementById('inputFirstName').value; 
  const lastName = document.getElementById('inputLastName').value; 
  const email = document.getElementById('inputEmail').value; 
  const message = document.getElementById('message').value; 

  if (!firstName || !lastName || !email || !message) { 
    status.style.display = 'block';
    status.innerHTML = '⚠️ Please fill in all fields.'; 
    status.style.color = '#ff5050'; 
    status.style.background = 'rgba(255,80,80,0.1)';
    status.style.padding = '10px';
    status.style.borderRadius = '8px';
    return; 
  } 

  // ========== PROFESSIONAL SECURITY FILTERS ==========
  
  // 1. Email Restriction (@gmail.com only)
  if (!email.toLowerCase().endsWith('@gmail.com')) {
    status.style.display = 'block';
    status.innerHTML = '🛡️ Security Policy: Only @gmail.com addresses are allowed.'; 
    status.style.color = '#ff5050'; 
    status.style.background = 'rgba(255,80,80,0.1)';
    status.style.padding = '10px';
    status.style.borderRadius = '8px';
    return;
  }

  // 2. Content Filter (Profanity & Suspicious Keywords)
  const forbiddenWords = ['sex', 'porn', 'fuck', 'shit', 'casino', 'bet', 'free money', 'winner', 'يا خول', 'شرموط', 'كسمك', 'سكس', 'نيك', 'قحبة'];
  const lowercaseMsg = message.toLowerCase();
  const foundWord = forbiddenWords.find(word => lowercaseMsg.includes(word));

  if (foundWord) {
    status.style.display = 'block';
    status.innerHTML = '🛡️ Content Filter: Your message contains prohibited or suspicious content.'; 
    status.style.color = '#ff5050'; 
    status.style.background = 'rgba(255,80,80,0.15)';
    status.style.padding = '12px';
    status.style.borderRadius = '8px';
    return;
  }

  // Loading state
  status.style.display = 'block';
  status.innerHTML = '⏳ Sending your message securely...'; 
  status.style.color = 'var(--primary)'; 
  status.style.background = 'rgba(0,212,255,0.1)';
  status.style.padding = '10px';
  status.style.borderRadius = '8px';
  status.style.border = 'none';
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.style.cursor = 'not-allowed';
  }
  if (btnText) btnText.innerText = 'Sending...';
  if (btnIcon) btnIcon.className = 'fas fa-spinner fa-spin';

  // Build payload with keys matching backend expectations
  const dataObj = {
    firstName: firstName,
    lastName: lastName,
    email: email,
    message: message
  };

  // Include honeypot if filled (for backend bot detection)
  const honeypot = document.getElementById('_honeypot');
  if (honeypot && honeypot.value) {
    dataObj._honeypot = honeypot.value;
  }

  try {
    const response = await fetch('/api/contact', { 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataObj)
    });

    if (response.status === 429) {
      showRateLimitWarning();
      return; // Stop execution
    }

    if (!response.ok) {
      throw new Error('Server error');
    }

    // Professional Success Animation Overlay
    status.style.display = 'none';
    form.reset();
    
    const overlay = document.createElement('div');
    overlay.className = 'form-success-overlay';
    overlay.innerHTML = `
      <div class="form-success-card">
        <div class="form-success-checkmark">
          <i class="fas fa-check"></i>
        </div>
        <h3 class="form-success-title">Message Sent!</h3>
        <p class="form-success-message">Thank you for reaching out. We'll get back to you within 24 hours. Stay tuned!</p>
        <button class="form-success-close" onclick="this.closest('.form-success-overlay').remove()">Got it</button>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s ease';
        setTimeout(() => overlay.remove(), 400);
      }
    }, 6000);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
    if (btnText) btnText.innerText = 'Send Message';
    if (btnIcon) btnIcon.className = 'fas fa-paper-plane';

  } catch (error) {
    console.error('Error:', error);
    status.innerHTML = '✗ Oops! There was a problem sending the message. Please try via WhatsApp.'; 
    status.style.color = '#ff5050'; 
    status.style.background = 'rgba(255,80,80,0.1)';
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
    if (btnText) btnText.innerText = 'Send Message';
    if (btnIcon) btnIcon.className = 'fas fa-paper-plane';
  }
}
