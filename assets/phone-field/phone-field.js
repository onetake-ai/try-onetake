/*
 * Phone field: WhatsApp number (or mobile number) with a country picker.
 *
 * Wraps intl-tel-input, self-hosted in /assets/vendor/intl-tel-input/ (see its README).
 * The field is always optional: an empty field is valid, and if the library cannot load,
 * the field stays a plain <input type="tel"> that never blocks a form.
 *
 *   oneTakePhoneField.attach(input, { lang: 'fr' })  -> Promise, turns the input into the picker
 *   oneTakePhoneField.read(input)                     -> { value: '+33612345678' or '', valid: true|false }
 *   oneTakePhoneField.setValue(input, '+33612345678') -> prefill
 *   oneTakePhoneField.fromUrl()                       -> ?telephone= from the URL, or ''
 */
(function () {
    'use strict';

    if (window.oneTakePhoneField) return;

    var scriptSrc = (document.currentScript && document.currentScript.src) || 'https://try.onetake.ai/assets/phone-field/phone-field.js';
    var HERE = new URL('./', scriptSrc).href;
    var VENDOR = new URL('../vendor/intl-tel-input/', scriptSrc).href;

    var E164 = /^\+[1-9]\d{6,14}$/;

    // Default country when the browser locale has no region, by page language.
    var COUNTRY_BY_LANG = { en: 'us', fr: 'fr', es: 'es', pt: 'br', it: 'it', ja: 'jp', ru: 'ru', de: 'de' };
    var COMMON_COUNTRIES = ['fr', 'be', 'ch', 'ca', 'us', 'gb'];

    // Interface strings of the picker, copied from intl-tel-input's locale files.
    var UI_TRANSLATIONS = {
        fr: {
            selectedCountryAriaLabel: 'Changer le pays du numéro de téléphone, sélectionné ${countryName} (${dialCode})',
            noCountrySelected: 'Sélectionnez le pays du numéro de téléphone',
            countryListAriaLabel: 'Liste des pays',
            searchPlaceholder: 'Recherche',
            clearSearchAriaLabel: 'Effacer la recherche',
            closeCountrySelectorAriaLabel: 'Fermer',
            searchEmptyState: 'Aucun résultat trouvé',
            results: ['Aucun résultat trouvé', '1 résultat trouvé', '{n} résultats trouvés']
        },
        es: {
            selectedCountryAriaLabel: 'Cambiar país para el número de teléfono, seleccionado ${countryName} (${dialCode})',
            noCountrySelected: 'Selecciona el país para el número de teléfono',
            countryListAriaLabel: 'Lista de países',
            searchPlaceholder: 'Buscar',
            clearSearchAriaLabel: 'Borrar búsqueda',
            closeCountrySelectorAriaLabel: 'Cerrar',
            searchEmptyState: 'No se han encontrado resultados',
            results: ['No se han encontrado resultados', '1 resultado encontrado', '{n} resultados encontrados']
        },
        pt: {
            selectedCountryAriaLabel: 'Alterar o país do número de telefone. Selecionado: ${countryName} (${dialCode})',
            noCountrySelected: 'Selecionar o país do número de telefone',
            countryListAriaLabel: 'Lista de países',
            searchPlaceholder: 'Pesquisar',
            clearSearchAriaLabel: 'Limpar pesquisa',
            closeCountrySelectorAriaLabel: 'Fechar',
            searchEmptyState: 'Nenhum resultado encontrado',
            results: ['Nenhum resultado encontrado', '1 resultado encontrado', '{n} resultados encontrados']
        },
        it: {
            selectedCountryAriaLabel: 'Cambia il paese del numero di telefono, selezionato ${countryName} (${dialCode})',
            noCountrySelected: 'Seleziona il paese del numero di telefono',
            countryListAriaLabel: 'Elenco dei paesi',
            searchPlaceholder: 'Ricerca',
            clearSearchAriaLabel: 'Cancella ricerca',
            closeCountrySelectorAriaLabel: 'Chiudi',
            searchEmptyState: 'Nessun risultato trovato',
            results: ['Nessun risultato trovato', '1 risultato trovato', '{n} risultati trovati']
        },
        ja: {
            selectedCountryAriaLabel: '電話番号の国を変更、選択中: ${countryName} (${dialCode})',
            noCountrySelected: '電話番号の国を選択',
            countryListAriaLabel: '国のリスト',
            searchPlaceholder: '検索',
            clearSearchAriaLabel: '検索をクリア',
            closeCountrySelectorAriaLabel: '閉じる',
            searchEmptyState: '結果が見つかりません',
            results: ['結果が見つかりません', '1 件の結果が見つかりました', '{n} 件の結果が見つかりました']
        },
        ru: {
            selectedCountryAriaLabel: 'Изменить страну для номера телефона, выбрана ${countryName} (${dialCode})',
            noCountrySelected: 'Выберите страну для номера телефона',
            countryListAriaLabel: 'Список стран',
            searchPlaceholder: 'Поиск',
            clearSearchAriaLabel: 'Очистить поиск',
            closeCountrySelectorAriaLabel: 'Закрыть',
            searchEmptyState: 'Результатов не найдено',
            results: ['Результатов не найдено', 'Найден 1 результат', 'Найдено результатов: {n}']
        },
        de: {
            selectedCountryAriaLabel: 'Land der Telefonnummer ändern, ausgewählt ${countryName} (${dialCode})',
            noCountrySelected: 'Land der Telefonnummer auswählen',
            countryListAriaLabel: 'Liste der Länder',
            searchPlaceholder: 'Suchen',
            clearSearchAriaLabel: 'Suche löschen',
            closeCountrySelectorAriaLabel: 'Schließen',
            searchEmptyState: 'Keine Suchergebnisse',
            results: ['Keine Suchergebnisse', '1 Suchergebnis', '{n} Suchergebnisse']
        }
    };

    var loading = null;
    var instances = new WeakMap();

    function addStylesheet(href) {
        if (document.querySelector('link[href="' + href + '"]')) return;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    // Loads the library once. Resolves with intlTelInput, or null if it could not load.
    function load() {
        if (window.intlTelInput) return Promise.resolve(window.intlTelInput);
        if (loading) return loading;
        addStylesheet(VENDOR + 'css/intlTelInput.min.css');
        addStylesheet(HERE + 'phone-field.css');
        loading = new Promise(function (resolve) {
            var script = document.createElement('script');
            script.src = VENDOR + 'js/intlTelInputWithUtils.min.js';
            // The library holds non-ASCII characters: read it as UTF-8 even on a host page without <meta charset>
            script.charset = 'utf-8';
            script.onload = function () { resolve(window.intlTelInput || null); };
            script.onerror = function () {
                console.warn('Phone field: intl-tel-input could not load, using a plain field.');
                resolve(null);
            };
            document.head.appendChild(script);
        });
        return loading;
    }

    function shortLang(lang) {
        return String(lang || document.documentElement.lang || 'en').toLowerCase().split(/[-_]/)[0];
    }

    // Region of the browser locale (fr-CA -> ca), else the default country of the page language.
    function guessCountry(lang) {
        var locales = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
        for (var i = 0; i < locales.length; i++) {
            var match = /^[a-z]{2,3}[-_]([a-z]{2})$/i.exec(locales[i] || '');
            if (match) return match[1].toLowerCase();
        }
        return COUNTRY_BY_LANG[shortLang(lang)] || 'us';
    }

    function uiTranslations(lang) {
        var t = UI_TRANSLATIONS[shortLang(lang)];
        if (!t) return {};
        var out = {};
        Object.keys(t).forEach(function (key) {
            if (key !== 'results') out[key] = t[key];
        });
        out.searchSummaryAria = function (count) {
            return count === 0 ? t.results[0] : count === 1 ? t.results[1] : t.results[2].replace('{n}', count);
        };
        return out;
    }

    function attach(input, opts) {
        opts = opts || {};
        if (!input || input.dataset.phoneFieldAttached) return Promise.resolve(instances.get(input) || null);
        input.dataset.phoneFieldAttached = '1';
        input.type = 'tel';
        input.setAttribute('autocomplete', 'tel');
        input.setAttribute('inputmode', 'tel');

        return load().then(function (lib) {
            if (!lib) return null;
            var initial = guessCountry(opts.lang);
            var order = [initial].concat(COMMON_COUNTRIES.filter(function (c) { return c !== initial; }));
            var iti = lib(input, {
                initialCountry: initial,
                countryOrder: order,
                countryNameLocale: shortLang(opts.lang),
                uiTranslations: uiTranslations(opts.lang),
                separateDialCode: true,
                containerClass: 'otp-phone'
            });
            instances.set(input, iti);
            // A number pasted or prefilled before the library loaded is reformatted.
            if (input.value) iti.setNumber(input.value);
            return iti;
        });
    }

    function normalize(raw) {
        var cleaned = String(raw || '').replace(/[\s.\-()\/]/g, '');
        if (cleaned.indexOf('00') === 0) cleaned = '+' + cleaned.slice(2);
        return cleaned;
    }

    // { value, valid }: value is E.164 or ''. An empty field is valid.
    function read(input) {
        if (!input || !String(input.value || '').trim()) return { value: '', valid: true };
        var iti = instances.get(input);
        if (iti) {
            var valid = iti.isValidNumber() === true;
            return { value: valid ? iti.getNumber() : '', valid: valid };
        }
        // Library missing or still loading: keep a well-formed international number, never block.
        var cleaned = normalize(input.value);
        return { value: E164.test(cleaned) ? cleaned : '', valid: true };
    }

    function setValue(input, value) {
        if (!input || !value) return;
        var iti = instances.get(input);
        if (iti) iti.setNumber(value);
        else input.value = value;
    }

    // ?telephone= from the URL (a value still holding an unrendered Liquid tag is ignored).
    function fromUrl() {
        var value = new URLSearchParams(window.location.search).get('telephone') || '';
        // An unencoded "+" in a query string reads as a space.
        value = value.replace(/^ (?=\d)/, '+').trim();
        if (!value || value.indexOf('{{') !== -1 || value.indexOf('{%') !== -1) return '';
        return value;
    }

    window.oneTakePhoneField = {
        load: load,
        attach: attach,
        read: read,
        setValue: setValue,
        fromUrl: fromUrl,
        normalize: function (raw) {
            var cleaned = normalize(raw);
            return E164.test(cleaned) ? cleaned : '';
        }
    };
})();
