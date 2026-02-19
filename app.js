// OneTake AI Express Signup - Main Application Logic

(function() {
    'use strict';

    // ==========================================
    // ASSUMPTIONS
    // Adjust these values as we get more data
    // ==========================================
    const DEFAULT_FREE_TO_PAID_CONVERSION_RATE = 0.30; // 30% of trials convert to paid
    const DEFAULT_CURRENCY = 'EUR';                     // All prices assumed in EUR
    const UNKNOWN_PRODUCT_EXPECTED_VALUE = 1;           // Fallback for unknown product IDs

    // Default plan info for unknown direct product links
    const DEFAULT_PLAN_INFO = {
        tier: 'OneTake AI',
        recurrence: 'yearly',
        trial: null,
        product: null, // Will be set from URL
        firstExpectedPayment: 120,
        freeToPaidConversionRate: DEFAULT_FREE_TO_PAID_CONVERSION_RATE
    };

    // Application state
    const state = {
        currentLanguage: 'en',
        formData: {
            firstName: '',
            email: '',
            useCases: [],
            estimatedVolume: ''
        },
        productId: 'pri_01kbcmen6n7ymcdk5y59vhv33h', // Default product (occasional-monthly-trial)
        planKey: null, // Will be set if using a preset
        planInfo: null, // Will contain plan details if using a preset
        hasTrial: true, // Default has trial
        isSubmitting: false
    };
    
    // Make state accessible globally for special-offer.js
    window.oneTakeState = state;
    
    // Initialize application
    function init() {
        detectLanguage();
        getPlanFromURL();
        initializePaddle();
        renderUseCases();
        setupDropdown();
        restoreSelectedUseCases(); // Restore chips if any checkboxes are selected
        applyTranslations();
        updateHeadline();
        updateButtonText();
        displayPlanInfo();
        setupEmailFieldListener(); // Add listener to show hidden fields
        attachEventListeners();
        console.log('OneTake Express Signup initialized');
    }
    
    // Detect browser language
    function detectLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        const langCode = browserLang.toLowerCase().split('-')[0];
        
        // Map browser language to supported languages
        const langMap = {
            'en': 'en',
            'fr': 'fr',
            'es': 'es',
            'pt': 'pt-br',
            'it': 'it',
            'ja': 'ja',
            'ru': 'ru',
            'de': 'de'
        };
        
        state.currentLanguage = langMap[langCode] || 'en';
        document.documentElement.lang = state.currentLanguage;
        console.log('Detected language:', state.currentLanguage);
    }
    
    // Get 2-letter language code for UserList
    function getTwoLetterLanguageCode() {
        // Convert pt-br to pt, keep others as first 2 letters
        return state.currentLanguage.split('-')[0];
    }
    
    // Get plan or product ID from URL parameters
    function getPlanFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const planKey = urlParams.get('plan');
        const productId = urlParams.get('product');
        
        if (planKey && planPresets[planKey]) {
            // Plan preset found
            state.planKey = planKey;
            state.planInfo = planPresets[planKey];
            state.productId = state.planInfo.product;
            state.hasTrial = !!state.planInfo.trial;
            console.log('Using plan preset:', planKey, state.planInfo);
        } else if (productId) {
            // Direct product ID provided without a matching preset
            state.productId = productId;
            state.planKey = null;
            state.planInfo = { ...DEFAULT_PLAN_INFO, product: productId };
            state.hasTrial = false;
            console.log('Using direct product ID:', productId);
        } else {
            // Use default (occasional-monthly-trial)
            state.productId = 'pri_01kbcmen6n7ymcdk5y59vhv33h';
            state.planKey = null;
            state.planInfo = null;
            state.hasTrial = true;
            console.log('Using default product ID:', state.productId);
        }
    }
    
    // Update headline based on trial status
    function updateHeadline() {
        const titleElement = document.querySelector('.form-title');
        if (!titleElement) return;
        
        const headlineKey = state.hasTrial ? 'headline' : 'headlineNoTrial';
        titleElement.textContent = getTranslation(headlineKey);
        titleElement.setAttribute('data-i18n', headlineKey);
    }
    
    // Update button text based on trial status
    function updateButtonText() {
        const btnTextElement = document.querySelector('.btn-text');
        if (!btnTextElement) return;
        
        const buttonKey = state.hasTrial ? 'button.submit' : 'button.submitNoTrial';
        btnTextElement.textContent = getTranslation(buttonKey);
        btnTextElement.setAttribute('data-i18n', buttonKey);
    }
    
    // Display plan information if using a preset
    function displayPlanInfo() {
        const planInfoElement = document.getElementById('planInfo');
        if (!planInfoElement || !state.planInfo) {
            if (planInfoElement) {
                planInfoElement.style.display = 'none';
            }
            return;
        }
        
        const tierSpan = planInfoElement.querySelector('.plan-tier');
        const recurrenceSpan = planInfoElement.querySelector('.plan-recurrence');
        const trialSpan = planInfoElement.querySelector('.plan-trial');
        
        if (tierSpan) tierSpan.textContent = state.planInfo.tier;
        if (recurrenceSpan && state.planInfo.recurrence) {
            recurrenceSpan.textContent = state.planInfo.recurrence.charAt(0).toUpperCase() + state.planInfo.recurrence.slice(1);
        }
        if (trialSpan && state.planInfo.trial) {
            trialSpan.textContent = ` • ${state.planInfo.trial}-day trial`;
        } else if (trialSpan) {
            trialSpan.textContent = '';
        }
        
        planInfoElement.style.display = 'block';
    }
    
    // Initialize Paddle
    function initializePaddle() {
        if (typeof Paddle !== 'undefined') {
            Paddle.Initialize({
                token: 'live_bb0b00885e63d509a759b2e2b29',
                eventCallback: handlePaddleEvent
            });
            console.log('Paddle initialized');
        } else {
            console.error('Paddle SDK not loaded');
        }
    }
    
    // Handle Paddle events
    function handlePaddleEvent(data) {
        console.log('Paddle event:', data);
        
        if (data.name === 'checkout.completed') {
            // Track purchase event
            trackPurchase(data);
        }
    }
    
    // Calculate expected value for a trial signup
    // Returns conversionRate * firstExpectedPayment, or the fallback value for unknown products
    function getExpectedTrialValue() {
        if (state.planInfo) {
            const rate = state.planInfo.freeToPaidConversionRate || DEFAULT_FREE_TO_PAID_CONVERSION_RATE;
            const payment = state.planInfo.firstExpectedPayment || UNKNOWN_PRODUCT_EXPECTED_VALUE;
            return parseFloat((rate * payment).toFixed(2));
        }
        return UNKNOWN_PRODUCT_EXPECTED_VALUE;
    }

    // Track purchase in AnyTrack, CrazyEgg, Plausible, and UserList
    function trackPurchase(paddleData) {
        const isTrial = state.hasTrial;
        const expectedValue = isTrial ? getExpectedTrialValue() : null;
        const actualValue = paddleData.data?.totals?.total || 0;

        const purchaseData = {
            value: isTrial ? expectedValue : actualValue,
            taxPrice: paddleData.data?.totals?.tax || 0,
            currency: paddleData.data?.currency_code || DEFAULT_CURRENCY,
            transactionId: paddleData.data?.transaction_id || '',
            email: state.formData.email,
            firstName: state.formData.firstName,
            items: paddleData.data?.items || []
        };

        if (isTrial) {
            console.log('Trial purchase detected. Expected value:', expectedValue, DEFAULT_CURRENCY);
        }

        // AnyTrack Purchase event (value = expectedValue for trials)
        if (typeof AnyTrack !== 'undefined') {
            AnyTrack('trigger', 'Purchase', purchaseData);
            console.log('AnyTrack Purchase event fired with value:', purchaseData.value);
        }

        // CrazyEgg Purchase conversion (worth = expectedValue for trials)
        if (typeof CE2 !== 'undefined') {
            const worth = isTrial ? expectedValue.toString() : (actualValue > 0 ? actualValue.toString() : UNKNOWN_PRODUCT_EXPECTED_VALUE.toString());
            const currency = purchaseData.currency || DEFAULT_CURRENCY;

            (window.CE_API || (window.CE_API=[])).push(function(){
                CE2.converted("f2ff5947-c667-49a1-85fd-210cdf91be10", {
                    worth: worth,
                    currency: currency
                });
            });
            console.log('CrazyEgg Purchase conversion fired with worth:', worth, 'currency:', currency);
        }

        // Plausible Purchase event (using revenue option for proper revenue attribution)
        if (typeof plausible !== 'undefined') {
            const plausibleOptions = {
                revenue: { amount: purchaseData.value, currency: purchaseData.currency },
                props: { plan: state.planKey || 'unknown' }
            };
            if (isTrial) {
                plausibleOptions.props.expectedValue = expectedValue;
            }
            plausible('Purchase', plausibleOptions);
            console.log('Plausible Purchase event fired with options:', plausibleOptions);
        }

        // UserList Purchase event (trial dates and expectedValue for trials)
        const userListProps = { ...purchaseData };
        if (isTrial) {
            userListProps.expectedValue = expectedValue;
            const now = new Date();
            userListProps.trial_started_on = now.toISOString();
            const trialDays = state.planInfo ? state.planInfo.trial : 7;
            userListProps.trial_expires_on = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
        }
        trackUserListEvent('Purchase', userListProps);
    }
    
    // Render use cases in custom dropdown with checkboxes
    function renderUseCases() {
        const optionsContainer = document.getElementById('dropdownOptions');
        if (!optionsContainer) return;
        
        // Separate 'other' from the rest
        const otherCase = 'other';
        const regularCases = useCaseValues.filter(uc => uc !== otherCase);
        
        // Shuffle regular cases
        const shuffled = shuffleArray([...regularCases]);
        
        // Add 'other' at the end
        const orderedCases = [...shuffled, otherCase];
        
        // Render checkbox options
        optionsContainer.innerHTML = orderedCases.map(value => {
            const id = `useCase_${value}`;
            const labelKey = `useCase.${value}`;
            
            return `
                <div class="dropdown-option" data-value="${value}">
                    <input type="checkbox" id="${id}" value="${value}">
                    <label for="${id}" data-i18n="${labelKey}">
                        ${getTranslation(labelKey)}
                    </label>
                </div>
            `;
        }).join('');
        
        // Attach checkbox change listeners
        const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handleUseCaseChange);
        });
    }
    
    // Handle use case checkbox change
    function handleUseCaseChange() {
        updateSelectedChips();
        clearError('useCases');
    }
    
    // Update the chips display
    function updateSelectedChips() {
        const chipsContainer = document.getElementById('selectedChips');
        const selectedUseCases = getSelectedUseCases();
        
        if (selectedUseCases.length === 0) {
            chipsContainer.innerHTML = `<span class="placeholder-text" data-i18n="label.useCases">${getTranslation('label.useCases')}</span>`;
            return;
        }
        
        chipsContainer.innerHTML = selectedUseCases.map(value => {
            const labelKey = `useCase.${value}`;
            const label = getTranslation(labelKey);
            return `
                <span class="chip" data-value="${value}">
                    ${label}
                    <span class="chip-remove" data-value="${value}"></span>
                </span>
            `;
        }).join('');
        
        // Attach remove listeners to chips
        const removeButtons = chipsContainer.querySelectorAll('.chip-remove');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.getAttribute('data-value');
                removeUseCase(value);
            });
        });
    }
    
    // Remove a use case
    function removeUseCase(value) {
        const checkbox = document.getElementById(`useCase_${value}`);
        if (checkbox) {
            checkbox.checked = false;
            updateSelectedChips();
        }
    }
    
    // Setup email field listener to show hidden fields
    function setupEmailFieldListener() {
        const emailField = document.getElementById('email');
        const useCasesGroup = document.getElementById('useCasesGroup');
        const usageFrequencyGroup = document.getElementById('usageFrequencyGroup');
        
        if (!emailField || !useCasesGroup || !usageFrequencyGroup) return;
        
        // Add hidden class initially
        useCasesGroup.classList.add('hidden-until-email');
        usageFrequencyGroup.classList.add('hidden-until-email');
        
        // Listen for input in email field
        emailField.addEventListener('input', function() {
            const hasContent = emailField.value.trim().length > 0;
            
            if (hasContent) {
                // Show fields with animation
                if (useCasesGroup.classList.contains('hidden-until-email')) {
                    useCasesGroup.classList.remove('hidden-until-email');
                    useCasesGroup.classList.add('visible');
                }
                if (usageFrequencyGroup.classList.contains('hidden-until-email')) {
                    usageFrequencyGroup.classList.remove('hidden-until-email');
                    usageFrequencyGroup.classList.add('visible');
                }
            }
        });
    }
    
    // Restore selected use cases (e.g., after page refresh or language change)
    function restoreSelectedUseCases() {
        // Check if any checkboxes are already checked and update chips
        const checkedBoxes = document.querySelectorAll('#dropdownOptions input[type="checkbox"]:checked');
        if (checkedBoxes.length > 0) {
            updateSelectedChips();
        }
    }
    
    // Setup dropdown interactions
    function setupDropdown() {
        const dropdown = document.getElementById('useCasesDropdown');
        const trigger = dropdown?.querySelector('.dropdown-trigger');
        const menu = dropdown?.querySelector('.dropdown-menu');
        
        if (!dropdown || !trigger || !menu) return;
        
        // Toggle dropdown on click
        trigger.addEventListener('click', () => {
            dropdown.classList.toggle('open');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        // Prevent dropdown from closing when clicking inside menu
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Handle keyboard
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropdown.classList.toggle('open');
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('open');
            }
        });
    }
    
    // Shuffle array (Fisher-Yates algorithm)
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    // Apply translations to the page
    function applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = getTranslation(key);
            
            if (translation) {
                // Use innerHTML for translations that contain HTML (like links)
                if (key === 'footer.privacy' || translation.includes('<a')) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });
        
        // Translate placeholders
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = getTranslation(key);
            
            if (translation) {
                element.placeholder = translation;
            }
        });
    }
    
    // Get translation for a key
    function getTranslation(key) {
        const lang = state.currentLanguage;
        return translations[lang]?.[key] || translations['en']?.[key] || key;
    }
    
    // Handle language change
    function handleLanguageChange(event) {
        const newLanguage = event.target.value;
        state.currentLanguage = newLanguage;
        document.documentElement.lang = newLanguage;
        
        // Re-render use cases with new translations
        renderUseCases();
        
        // Re-apply all translations
        applyTranslations();
        
        // Update headline and button
        updateHeadline();
        updateButtonText();
        
        // Restore chips after re-rendering with new language
        restoreSelectedUseCases();
        
        // Refresh special offer content if function exists (special-offer.html page)
        if (typeof window.refreshSpecialOfferContent === 'function') {
            window.refreshSpecialOfferContent();
        }
        
        console.log('Language changed to:', newLanguage);
    }
    
    // Attach event listeners
    function attachEventListeners() {
        const form = document.getElementById('signupForm');
        
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }
        
        // Language selector
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.value = state.currentLanguage;
            languageSelect.addEventListener('change', handleLanguageChange);
        }
        
        // Real-time validation
        const firstNameInput = document.getElementById('firstName');
        const emailInput = document.getElementById('email');
        
        if (firstNameInput) {
            firstNameInput.addEventListener('blur', () => validateField('firstName'));
            firstNameInput.addEventListener('input', () => clearError('firstName'));
        }
        
        if (emailInput) {
            emailInput.addEventListener('blur', () => validateField('email'));
            emailInput.addEventListener('input', () => clearError('email'));
        }
        
        // Usage frequency validation
        const usageFrequencySelect = document.getElementById('usageFrequency');
        if (usageFrequencySelect) {
            usageFrequencySelect.addEventListener('change', () => clearError('usageFrequency'));
        }
    }
    
    // Validate individual field
    function validateField(fieldName) {
        const input = document.getElementById(fieldName);
        const errorSpan = document.getElementById(`${fieldName}Error`);
        
        if (!input) return false;
        
        let isValid = true;
        let errorMessage = '';
        
        if (fieldName === 'firstName') {
            if (!input.value.trim()) {
                isValid = false;
                errorMessage = getTranslation('error.required');
            }
        } else if (fieldName === 'email') {
            if (!input.value.trim()) {
                isValid = false;
                errorMessage = getTranslation('error.required');
            } else if (!isValidEmail(input.value)) {
                isValid = false;
                errorMessage = getTranslation('error.email');
            }
        }
        
        if (!isValid) {
            input.classList.add('error');
            if (errorSpan) {
                errorSpan.textContent = errorMessage;
            }
        } else {
            input.classList.remove('error');
            if (errorSpan) {
                errorSpan.textContent = '';
            }
        }
        
        return isValid;
    }
    
    // Validate email format
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // Clear error for a field
    function clearError(fieldName) {
        const input = document.getElementById(fieldName);
        const errorSpan = document.getElementById(`${fieldName}Error`);
        
        if (input) {
            input.classList.remove('error');
        }
        
        if (errorSpan) {
            errorSpan.textContent = '';
        }
        
        // Special handling for dropdown
        if (fieldName === 'useCases') {
            const dropdownTrigger = document.querySelector('.dropdown-trigger');
            if (dropdownTrigger) {
                dropdownTrigger.classList.remove('error');
            }
        }
    }
    
    // Validate entire form
    function validateForm() {
        let isValid = true;
        
        // Validate first name
        if (!validateField('firstName')) {
            isValid = false;
        }
        
        // Validate email
        if (!validateField('email')) {
            isValid = false;
        }
        
        // Validate use cases
        const selectedUseCases = getSelectedUseCases();
        const useCasesError = document.getElementById('useCasesError');
        const dropdownTrigger = document.querySelector('.dropdown-trigger');
        
        if (selectedUseCases.length === 0) {
            isValid = false;
            if (useCasesError) {
                useCasesError.textContent = getTranslation('error.useCases');
            }
            if (dropdownTrigger) {
                dropdownTrigger.classList.add('error');
            }
        } else {
            if (useCasesError) {
                useCasesError.textContent = '';
            }
            if (dropdownTrigger) {
                dropdownTrigger.classList.remove('error');
            }
        }
        
        // Validate usage frequency
        const usageFrequencySelect = document.getElementById('usageFrequency');
        const usageFrequencyError = document.getElementById('usageFrequencyError');
        
        if (!usageFrequencySelect || !usageFrequencySelect.value) {
            isValid = false;
            if (usageFrequencyError) {
                usageFrequencyError.textContent = getTranslation('error.required');
            }
            if (usageFrequencySelect) {
                usageFrequencySelect.classList.add('error');
            }
        } else {
            if (usageFrequencyError) {
                usageFrequencyError.textContent = '';
            }
            if (usageFrequencySelect) {
                usageFrequencySelect.classList.remove('error');
            }
        }
        
        return isValid;
    }
    
    // Get selected use cases
    function getSelectedUseCases() {
        const checkboxes = document.querySelectorAll('#dropdownOptions input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    // Handle form submission
    async function handleFormSubmit(event) {
        event.preventDefault();
        
        if (state.isSubmitting) return;
        
        // Validate form
        if (!validateForm()) {
            console.log('Form validation failed');
            return;
        }
        
        // Collect form data
        state.formData.firstName = document.getElementById('firstName').value.trim();
        state.formData.email = document.getElementById('email').value.trim();
        state.formData.useCases = getSelectedUseCases();
        state.formData.estimatedVolume = document.getElementById('usageFrequency').value;
        
        console.log('Form data:', state.formData);
        
        // Show loading state
        setSubmitButtonLoading(true);
        state.isSubmitting = true;
        
        try {
            // Track formSubmit event (only if not personal/music use cases)
            await trackFormSubmit();
            
            // Track in UserList (this now creates the user AND tracks the event)
            await trackUserListEvent('formSubmit');
            
            // Wait a moment for tracking to complete
            await sleep(500);
            
            // Open Paddle checkout
            openPaddleCheckout();
            
        } catch (error) {
            console.error('Form submission error:', error);
            showError(getTranslation('error.network'));
        } finally {
            setSubmitButtonLoading(false);
            state.isSubmitting = false;
        }
    }
    
    // Track form submit event
    async function trackFormSubmit() {
        const useCases = state.formData.useCases;
        
        // Check if any use case contains 'personal' or 'music'
        const hasInvalidUseCase = useCases.some(uc => 
            uc.includes('music') || uc.includes('personal')
        );
        
        if (hasInvalidUseCase) {
            console.log('Skipping FormSubmit tracking - invalid ICP (personal/music)');
            return;
        }
        
        // Fire Plausible event
        if (typeof plausible !== 'undefined') {
            plausible('formSubmit', {
                props: {
                    use_cases: useCases.join(','),
                    estimated_volume: state.formData.estimatedVolume
                }
            });
            console.log('Plausible formSubmit event fired');
        }
        
        // Fire AnyTrack event
        if (typeof AnyTrack !== 'undefined') {
            AnyTrack('trigger', 'FormSubmit', {
                use_cases: useCases.join(','),
                estimated_volume: state.formData.estimatedVolume
            });
            console.log('AnyTrack FormSubmit event fired');
        }
        
        // Fire CrazyEgg conversion
        if (typeof CE2 !== 'undefined') {
            (window.CE_API || (window.CE_API=[])).push(function(){
                CE2.converted("ff76d55c-95cf-4be9-99a9-ef655b436cf9");
            });
            console.log('CrazyEgg formSubmit conversion fired');
        }
    }
    
    // Track UserList event with embedded user information
    async function trackUserListEvent(eventName, additionalProperties = {}) {
        const payload = {
            name: eventName,
            user: {
                email: state.formData.email,
                properties: {
                    first_name: state.formData.firstName,
                    language: getTwoLetterLanguageCode(),
                    use_cases: state.formData.useCases.length > 0 ? state.formData.useCases : undefined,
                    estimated_volume: state.formData.estimatedVolume || undefined
                }
            },
            properties: {
                ...additionalProperties,
                plan: state.planKey || undefined,
                use_cases: state.formData.useCases.length > 0 ? state.formData.useCases : undefined,
                estimated_volume: state.formData.estimatedVolume || undefined
            }
        };
        
        try {
            const response = await fetch('https://userlist-proxy-46gm3.bunny.run/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`UserList API error: ${response.status}`);
            }
            
            console.log(`UserList ${eventName} event tracked successfully`);
        } catch (error) {
            console.error('UserList tracking error:', error);
            // Don't block the flow for UserList errors
        }
    }
    
    // Open Paddle checkout
    function openPaddleCheckout() {
        if (typeof Paddle === 'undefined') {
            console.error('Paddle not available');
            showError('Payment system unavailable. Please try again.');
            return;
        }
        
        const items = [{
            priceId: state.productId,
            quantity: 1
        }];
        
        const customer = {
            email: state.formData.email
        };
        
        // Build success URL with query parameters
        const successParams = new URLSearchParams({
            email: state.formData.email,
            language: getTwoLetterLanguageCode(),
            product: state.productId
        });
        
        // Add plan if available
        if (state.planKey) {
            successParams.set('plan', state.planKey);
        }
        
        const successUrl = `https://yes.onetake.ai/onboarding?${successParams.toString()}`;
        
        const settings = {
            displayMode: 'overlay',
            theme: 'light',
            locale: getTwoLetterLanguageCode(),
            successUrl: successUrl
        };
        
        // Get Rewardful referral if available
        const referral = window.Rewardful && window.Rewardful.referral;
        const customData = referral ? { rewardful: { referral: referral } } : null;
        
        console.log('Opening Paddle checkout with:', { items, customer, settings, customData });
        
        try {
            const checkoutConfig = {
                settings: settings,
                items: items,
                customer: customer
            };
            
            // Add custom data (including Rewardful) if available
            if (customData) {
                checkoutConfig.customData = customData;
            }
            
            Paddle.Checkout.open(checkoutConfig);
        } catch (error) {
            console.error('Paddle checkout error:', error);
            showError('Could not open checkout. Please try again.');
        }
    }
    
    // Set submit button loading state
    function setSubmitButtonLoading(isLoading) {
        const button = document.getElementById('submitBtn');
        const btnText = button.querySelector('.btn-text');
        const btnSpinner = button.querySelector('.btn-spinner');
        
        if (isLoading) {
            button.disabled = true;
            btnText.style.display = 'none';
            btnSpinner.style.display = 'inline-flex';
        } else {
            button.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    }
    
    // Show error message
    function showError(message) {
        // You could implement a toast notification here
        // For now, just log and show in first error field
        console.error(message);
        const firstError = document.querySelector('.error-message');
        if (firstError) {
            firstError.textContent = message;
        }
    }
    
    // Sleep utility
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
