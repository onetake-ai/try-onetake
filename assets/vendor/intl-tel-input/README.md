# intl-tel-input (self-hosted)

Country picker and validation for the phone field (`/assets/phone-field/`). Served from our own domain so no third party can change or remove it.

- Version: 29.5.10 (MIT, see `LICENSE`)
- Source: https://registry.npmjs.org/intl-tel-input/-/intl-tel-input-29.5.10.tgz
- Tarball integrity (checked before copying): `sha512-ohZXPbJESkXPkqHucTQMA8rnklCFILFajq4UIOG75Ju1EF1gww0O+jKR2VRDDeIsRMxlGto36nUgwLtfPVJ4FQ==`

| File | Copied from (`package/dist/`) | SHA-256 |
|------|------|---------|
| `js/intlTelInputWithUtils.min.js` | `js/intlTelInputWithUtils.min.js` | `f978156d7f69e0abec8cbe6f47a30570a4da98acf78424739e96a21ad012a959` |
| `css/intlTelInput.min.css` | `css/intlTelInput.min.css` | `122dc6a10109d0ee543ac3f60ef80abc9f07646235761660ab2668cb3d68f7c3` |
| `img/flags.webp` | `img/flags.webp` | `ed164ab32687531059bf7fd23cca87b8ad1fe5fa7ab9b0dd974ad362716c086a` |
| `img/flags@2x.webp` | `img/flags@2x.webp` | `c8b020b385c0e5fb025ce404f4d3ff4e94d002f18fc5c684fc2aaed7ac6ba00f` |
| `LICENSE` | `../LICENSE` | `cf73c26f3430cdb778415da427dfec99303332d0ab691f1e43e024b9cb81e1be` |

We use the build with the validation utils included (one classic script, global `intlTelInput`), so nothing is loaded as an ES module and the embed works on other domains. The picker's interface strings for our 8 languages are copied into `UI_TRANSLATIONS` in `/assets/phone-field/phone-field.js`; country names come from the browser (`Intl.DisplayNames`).

## Upgrading

1. Download the newest tarball from `https://registry.npmjs.org/intl-tel-input/latest` (field `dist.tarball`) and check it against `dist.integrity`.
2. Replace the files above with the ones from the tarball (same paths) and update this README (version, hashes).
3. Read the changelog: if options or method names changed, update `/assets/phone-field/phone-field.js`.
4. Test one form (see the "Phone field" section in `/CLAUDE.md`).
