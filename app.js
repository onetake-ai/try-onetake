// OneTake AI Express Signup - Main Application Logic
// Requires: pricing-data.js, translations.js, tracking-params.js, cohort.js,
//           /assets/checkout/checkout-core.js (must be loaded before this script)

(function() {
    'use strict';

    var core = window.oneTakeCheckout;

    // ==========================================
    // ENVIRONMENT
    // ==========================================
    const isSandbox = new URLSearchParams(window.location.search).get('environment') === 'sandbox';
    const activePlanPresets = isSandbox ? sandboxPlanPresets : planPresets;

    // Application state
    const state = {
        currentLanguage: 'en',
        formData: {
            firstName: '',
            email: '',
            useCases: [],
            estimatedVolume: ''
        },
        productId: 'pri_01ksfshd2k1145y5v96v8bk0se',
        planKey: null,
        planInfo: null,
        hasTrial: true,
        hasOneTimeCharge: false,
        isSubmitting: false,
        checkoutCompleted: false,
        downsellShown: false,
        downsellAccepted: false,
        downsellPlanKey: null,
        downsellPlanInfo: null,
        originalPlanKey: null,
        trackingParams: {}
    };

    // Make state accessible globally for special-offer.js
    window.oneTakeState = state;
    window.oneTakeIsSandbox = isSandbox;

    // Initialize application
    function init() {
        detectLanguage();
        getPlanFromURL();
        core.initPaddle(isSandbox, handlePaddleEvent);
        renderUseCases();
        setupDropdown();
        restoreSelectedUseCases();
        applyTranslations();
        updateHeadline();
        updateButtonText();
        displayPlanInfo();
        setupEmailFieldListener();
        attachEventListeners();
        console.log('OneTake Express Signup initialized' + (isSandbox ? ' [SANDBOX MODE]' : ''));
    }

    // Detect browser language
    function detectLanguage() {
        state.currentLanguage = core.detectLanguage();
        document.documentElement.lang = state.currentLanguage;
        console.log('Detected language:', state.currentLanguage);
    }

    // Get 2-letter language code
    function getTwoLetterLanguageCode() {
        return core.getTwoLetterLanguageCode(state.currentLanguage);
    }

    // Get plan or product ID from URL parameters
    function getPlanFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const planKey = urlParams.get('plan');
        const productId = urlParams.get('product');

        if (planKey && activePlanPresets[planKey]) {
            state.planKey = planKey;
            state.planInfo = activePlanPresets[planKey];
            state.productId = state.planInfo.product;
            state.hasTrial = !!state.planInfo.trial;
            state.hasOneTimeCharge = !!state.planInfo.oneTimeCharge;
            console.log('Using plan preset:', planKey, state.planInfo);
        } else if (productId) {
            state.productId = productId;
            state.planKey = null;
            state.planInfo = { ...core.DEFAULT_PLAN_INFO, product: productId };
            state.hasTrial = false;
            state.hasOneTimeCharge = false;
            console.log('Using direct product ID:', productId);
        } else {
            const defaultKey = 'launch-monthly-trial';
            const defaultPreset = activePlanPresets[defaultKey];
            state.productId = defaultPreset ? defaultPreset.product : 'pri_01ksfshd2k1145y5v96v8bk0se';
            state.planKey = defaultKey;
            state.planInfo = defaultPreset || null;
            state.hasTrial = !!defaultPreset && !!defaultPreset.trial;
            state.hasOneTimeCharge = !!defaultPreset && !!defaultPreset.oneTimeCharge;
            console.log('Using default product ID:', state.productId);
        }

        state.trackingParams = window.oneTakeTracking
            ? window.oneTakeTracking.parseTrackingParams(urlParams)
            : {};
    }

    // Update headline based on trial status
    function updateHeadline() {
        const titleElement = document.querySelector('.form-title');
        if (!titleElement) return;

        const headlineKey = state.hasOneTimeCharge ? 'headlineOneDollarTrial' : state.hasTrial ? 'headline' : 'headlineNoTrial';
        titleElement.textContent = getTranslation(headlineKey, { days: (state.planInfo && state.planInfo.trial) || DEFAULT_TRIAL_DAYS });
        titleElement.setAttribute('data-i18n', headlineKey);
    }

    // Update button text based on trial status
    function updateButtonText() {
        const btnTextElement = document.querySelector('.btn-text');
        if (!btnTextElement) return;

        const buttonKey = state.hasOneTimeCharge ? 'button.submitOneDollarTrial' : state.hasTrial ? 'button.submit' : 'button.submitNoTrial';
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

    // Handle Paddle events
    function handlePaddleEvent(data) {
        console.log('Paddle event:', data);

        if (data.name === 'checkout.completed') {
            state.checkoutCompleted = true;
            core.trackPurchase(state, data, isSandbox);
            trackUserListEvent('Purchase');
        }

        if (data.name === 'checkout.closed') {
            if (!state.checkoutCompleted && !state.downsellShown) {
                core.maybeShowDownsell(state, activePlanPresets, showDownsellModal);
            }
        }

        if (data.name === 'checkout.customer.updated') {
            if (typeof AnyTrack !== 'undefined') {
                AnyTrack('trigger', 'InitiateCheckout', {});
                console.log('AnyTrack InitiateCheckout event fired');
            }
        }

        if (data.name === 'checkout.payment.selected') {
            if (typeof AnyTrack !== 'undefined') {
                AnyTrack('trigger', 'AddPaymentInfo', {});
                console.log('AnyTrack AddPaymentInfo event fired');
            }
        }
    }

    // Render use cases in custom dropdown with checkboxes
    function renderUseCases() {
        const optionsContainer = document.getElementById('dropdownOptions');
        if (!optionsContainer) return;

        const otherCase = 'other';
        const regularCases = useCaseValues.filter(uc => uc !== otherCase);
        const shuffled = core.shuffleArray([...regularCases]);
        const orderedCases = [...shuffled, otherCase];

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

        useCasesGroup.classList.add('hidden-until-email');
        usageFrequencyGroup.classList.add('hidden-until-email');

        emailField.addEventListener('input', function() {
            const hasContent = emailField.value.trim().length > 0;

            if (hasContent) {
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

        trigger.addEventListener('click', () => {
            dropdown.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropdown.classList.toggle('open');
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('open');
            }
        });
    }

    // Apply translations to the page
    function applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');

        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = getTranslation(key);

            if (translation) {
                if (key === 'footer.privacy' || translation.includes('<a')) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });

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
    function getTranslation(key, params) {
        return core.getTranslation(state.currentLanguage, key, params);
    }

    // Handle language change
    function handleLanguageChange(event) {
        const newLanguage = event.target.value;
        state.currentLanguage = newLanguage;
        document.documentElement.lang = newLanguage;

        renderUseCases();
        applyTranslations();
        updateHeadline();
        updateButtonText();
        restoreSelectedUseCases();

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

        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.value = state.currentLanguage;
            languageSelect.addEventListener('change', handleLanguageChange);
        }

        const downsellClose   = document.getElementById('downsellClose');
        const downsellAcceptBtn = document.getElementById('downsellAccept');
        const downsellDismiss = document.getElementById('downsellDismiss');
        const downsellModal   = document.getElementById('downsellModal');

        if (downsellClose)   downsellClose.addEventListener('click', hideDownsellModal);
        if (downsellAcceptBtn) downsellAcceptBtn.addEventListener('click', handleAcceptDownsell);
        if (downsellDismiss) downsellDismiss.addEventListener('click', hideDownsellModal);

        if (downsellModal) {
            downsellModal.addEventListener('click', function(e) {
                if (e.target === downsellModal) hideDownsellModal();
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') hideDownsellModal();
        });

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
            } else if (!core.isValidEmail(input.value)) {
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

        if (!validateField('firstName')) {
            isValid = false;
        }

        if (!validateField('email')) {
            isValid = false;
        }

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

        if (!validateForm()) {
            console.log('Form validation failed');
            return;
        }

        state.formData.firstName = document.getElementById('firstName').value.trim();
        state.formData.email = document.getElementById('email').value.trim();
        state.formData.useCases = getSelectedUseCases();
        state.formData.estimatedVolume = document.getElementById('usageFrequency').value;

        console.log('Form data:', state.formData);

        setSubmitButtonLoading(true);
        state.isSubmitting = true;

        try {
            core.trackFormSubmit(state, isSandbox);

            trackUserListEvent('formSubmit');

            if (window.fpr) window.fpr("referral", { email: state.formData.email });

            await core.sleep(500);

            core.openCheckout(state, activePlanPresets, {
                onError: function(msg) { showError(msg); }
            });

        } catch (error) {
            console.error('Form submission error:', error);
            showError(getTranslation('error.network'));
        } finally {
            setSubmitButtonLoading(false);
            state.isSubmitting = false;
        }
    }

    // UserList events deprecated
    async function trackUserListEvent(eventName, additionalProperties = {}) {
        console.log('Skipping UserList event (deprecated):', eventName);
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
        console.error(message);
        const firstError = document.querySelector('.error-message');
        if (firstError) {
            firstError.textContent = message;
        }
    }

    // ==========================================
    // DOWNSELL LOGIC (UI only — plan logic is in checkout-core.js)
    // ==========================================

    // Populate and open the downsell modal.
    function showDownsellModal(downsellKey, downsellPlan, originalPlanKey) {
        const modal = document.getElementById('downsellModal');
        if (!modal) return;

        const originalPlan = activePlanPresets[originalPlanKey] || state.planInfo;
        const isRecurrenceDownsell = originalPlan &&
            (originalPlan.recurrence === 'yearly' || originalPlan.recurrence === 'quarterly') &&
            downsellPlan.recurrence === 'monthly';

        const titleEl = document.getElementById('downsellTitle');
        const bodyEl  = document.getElementById('downsellBody');
        if (titleEl) titleEl.textContent = getTranslation(isRecurrenceDownsell ? 'downsell.title.yearly' : 'downsell.title.tier');
        if (bodyEl)  bodyEl.textContent  = getTranslation(isRecurrenceDownsell ? 'downsell.body.yearly'  : 'downsell.body.tier');

        const planNameEl = document.getElementById('downsellPlanName');
        if (planNameEl) {
            const recurrenceLabel = downsellPlan.recurrence.charAt(0).toUpperCase() + downsellPlan.recurrence.slice(1);
            planNameEl.textContent = downsellPlan.tier + ' — ' + recurrenceLabel;
        }

        const planPriceEl = document.getElementById('downsellPlanPrice');
        if (planPriceEl) {
            const recurrenceMap = {
                monthly:   getTranslation('downsell.perMonth'),
                yearly:    getTranslation('downsell.perYear'),
                quarterly: getTranslation('downsell.perQuarter')
            };
            const perPeriod = recurrenceMap[downsellPlan.recurrence] || '';
            const trialSuffix = downsellPlan.trial
                ? ' · ' + getTranslation('downsell.trialNote', { days: downsellPlan.trial })
                : '';
            planPriceEl.textContent = '€' + downsellPlan.firstExpectedPayment + perPeriod + trialSuffix;
        }

        modal.querySelectorAll('[data-i18n]').forEach(function(el) {
            const t = getTranslation(el.getAttribute('data-i18n'));
            if (t) el.textContent = t;
        });

        state.downsellPlanKey  = downsellKey;
        state.downsellPlanInfo = downsellPlan;
        state.downsellShown    = true;

        modal.classList.add('is-open');

        if (!isSandbox && typeof plausible !== 'undefined') {
            plausible('DownsellShown', { props: { downsell_plan: downsellKey, original_plan: originalPlanKey } });
        }
        if (typeof AnyTrack !== 'undefined') {
            AnyTrack('trigger', 'DownsellShown', { downsell_plan: downsellKey, original_plan: originalPlanKey });
        }
        console.log('Downsell shown:', downsellKey);
    }

    function hideDownsellModal() {
        const modal = document.getElementById('downsellModal');
        if (modal) modal.classList.remove('is-open');
    }

    function handleAcceptDownsell() {
        hideDownsellModal();
        core.acceptDownsell(state, isSandbox);
        core.openCheckout(state, activePlanPresets, {
            onError: function(msg) { showError(msg); }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
