/* Halloween 2026 offers: direct order form (card or bank transfer, B2B only).
 * DRAFT: no payment provider is connected yet. On submit, the form validates
 * the fields and shows what would be sent. Replace submitOrder() once the
 * card checkout and invoice flow are confirmed. */
(function () {
    'use strict';

    function prefillFromUrl(form) {
        var params = new URLSearchParams(window.location.search);
        [['firstName', 'first_name'], ['email', 'email']].forEach(function (pair) {
            var input = form.elements[pair[0]];
            var value = (params.get(pair[1]) || '').trim();
            // Ignore values still holding an unrendered Liquid tag
            if (input && value && !/[{}<>]/.test(value) && !input.value) input.value = value;
        });
    }

    function showError(form, message) {
        var el = form.querySelector('.error');
        el.textContent = message;
        el.hidden = !message;
    }

    function submitOrder(form, data) {
        var done = form.querySelector('.done');
        var method = data.payment === 'transfer'
            ? 'une facture avec IBAN serait envoyée à ' + data.email
            : 'le paiement par carte s\'ouvrirait ici';
        done.textContent = 'Brouillon : la commande « ' + form.dataset.offer + ' » est valide ; ' + method + '. Le paiement n\'est pas encore branché.';
        done.hidden = false;
    }

    function handleSubmit(event) {
        event.preventDefault();
        var form = event.target;
        if (!form.checkValidity()) {
            showError(form, 'Merci de remplir les champs obligatoires et de cocher les trois cases.');
            form.reportValidity();
            return;
        }
        showError(form, '');
        var data = {};
        new FormData(form).forEach(function (value, key) { data[key] = value; });
        submitOrder(form, data);
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('form.order-form').forEach(function (form) {
            prefillFromUrl(form);
            form.addEventListener('submit', handleSubmit);
        });
    });
})();
