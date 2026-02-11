// OneTake AI Special Offer Page - Conditional Content

(function() {
    'use strict';
    
    // Wait for app.js to initialize state
    function initSpecialOfferContent() {
        // Check if this is a trial offer - use global state
        const isTrial = window.oneTakeState ? window.oneTakeState.hasTrial : false;
        
        console.log('Special Offer: isTrial =', isTrial);
        
        // Show/hide sub-headline based on trial status
        toggleSubHeadline(isTrial);
        
        // Populate benefits list
        populateBenefits(isTrial);
        
        // Show/hide FAQ
        if (isTrial) {
            populateFAQ();
        }
        
        // Show/hide Johnson box
        showJohnsonBox(isTrial);
    }
    
    // Get translation helper
    function getTranslation(key) {
        const lang = window.oneTakeState ? window.oneTakeState.currentLanguage : 'en';
        return translations[lang]?.[key] || translations['en']?.[key] || key;
    }
    
    // Show/hide sub-headline (show only for NON-trials)
    function toggleSubHeadline(isTrial) {
        const subHeadline = document.querySelector('.sub-headline');
        if (subHeadline) {
            subHeadline.style.display = isTrial ? 'none' : 'block';
        }
    }
    
    // Populate benefits based on trial status
    function populateBenefits(isTrial) {
        const benefitsList = document.getElementById('benefitsList');
        if (!benefitsList) {
            console.log('Benefits list element not found');
            return;
        }
        
        const benefits = [];
        
        if (isTrial) {
            benefits.push(getTranslation('benefit.trial'));
        }
        
        benefits.push(getTranslation('benefit.features'));
        
        if (isTrial) {
            benefits.push(getTranslation('benefit.payNothing'));
            benefits.push(getTranslation('benefit.cancel'));
        }
        
        console.log('Populating benefits:', benefits);
        benefitsList.innerHTML = benefits.map(benefit => 
            `<li>${benefit}</li>`
        ).join('');
    }
    
    // Populate FAQ section (only for trials)
    function populateFAQ() {
        const faqSection = document.getElementById('faqSection');
        if (!faqSection) return;
        
        const faqs = [
            {
                question: getTranslation('faq.creditCard.question'),
                answer: getTranslation('faq.creditCard.answer')
            },
            {
                question: getTranslation('faq.avoid.question'),
                answer: getTranslation('faq.avoid.answer')
            }
        ];
        
        faqSection.innerHTML = faqs.map(faq => `
            <div class="faq-item">
                <div class="faq-question">${faq.question}</div>
                <div class="faq-answer">${faq.answer}</div>
            </div>
        `).join('');
    }
    
    // Show/hide Johnson box
    function showJohnsonBox(isTrial) {
        const johnsonBox = document.getElementById('johnsonBox');
        if (johnsonBox && isTrial) {
            johnsonBox.style.display = 'block';
        }
    }
    
    // Expose refresh function globally so app.js can call it on language change
    window.refreshSpecialOfferContent = function() {
        if (window.oneTakeState && typeof translations !== 'undefined') {
            initSpecialOfferContent();
        }
    };
    
    // Initialize when DOM is ready and after a short delay to ensure app.js has loaded
    function tryInit() {
        if (window.oneTakeState && typeof translations !== 'undefined') {
            initSpecialOfferContent();
        } else {
            // Retry after a short delay
            setTimeout(tryInit, 50);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
    
})();
