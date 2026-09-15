# Message catalog structure

Translations are stored by locale and functional domain.

- `en/` and `es/` MUST remain structurally symmetric.
- Existing next-intl public namespaces are preserved.
- A namespace may be split across files only when leaf keys do not overlap.
- `i18n/messages.ts` composes fragments and rejects duplicate leaf keys.
- `scripts/check-i18n.ts` verifies EN/ES key and shape parity.
- Product glossary/help content belongs under `messages/{locale}/glossary/`.
- Technical terminology belongs under `docs/glossary/` and is English-only.

Run the repository's i18n check before merging translation changes.
