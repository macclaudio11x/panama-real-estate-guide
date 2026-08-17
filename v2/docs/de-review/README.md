# German language check — what Rodrigo needs to do

Two pages are written and staged as drafts. Neither can go live until someone who did not write them has read them against the English source. That is not a convention, it is a database constraint: `article_translations` refuses `status = 'published'` unless `checked_by` and `checked_on` are set, and refuses `checked_by = translator_id`.

**The drafter was an AI, and it also ran an automated blind back-translation on both pages.** That pass caught real defects — a case error propagated across both pages, six English calques, two German tax terms of art used wrongly, a dangling reference, and a claim that understated its own data. All fixed. But it validates **figures and terminology, not idiom.** Whether these read as German written by a German is exactly what it cannot tell us, and is exactly what you are here for.

---

## The two pages

| File | Target URL | Words | Source article |
|---|---|---|---|
| `auswandern-nach-panama-als-rentner.md` | `/de/leben/auswandern-nach-panama-als-rentner` | 2,498 | `/living/retire-in-panama` |
| `immobilienmarkt-panama.md` | `/de/kaufen/immobilienmarkt-panama` | 2,100 | `/buying/panama-real-estate-market-2026` |

Read each against its English source, open side by side. Not from the German alone.

---

## What to check, in this order

**1. Every figure, date, fee and legal citation matches the English row.** Highest value, so it goes first. A translated page that drifts on a number is this site's known failure mode, and a wrong number in German is harder to catch later because fewer people read it.

**2. Every claim matches, including the hedges.** If the English hedges, the German hedges. Translation is where "may be exempt" quietly becomes "is exempt".

**3. Terminology.** Panamanian legal terms stay in Spanish, italicised, glossed in German on first use. These German terms must **never** appear as translations:

| Concept | Correct | Never |
|---|---|---|
| Rights of possession | *derecho de posesión* | Besitzrecht, Besitzanspruch |
| Public Registry | *Registro Público* | Grundbuch |
| Condominium regime | *propiedad horizontal* (PH) | Wohnungseigentum, WEG |
| HOA fee | *cuota de mantenimiento* | Hausgeld |
| Transfer tax | *impuesto de transferencia* / Übertragungssteuer | Grunderwerbsteuer |
| Discount | Ermäßigung | Nachlass |

**Two deliberate exceptions.** Both pages name `Grundbuch` and `Grunderwerbsteuer` **on purpose**, in passages that exist to warn against them — "das *Registro Público* ist **kein Grundbuch** im deutschen Sinne", and "**'Grunderwerbsteuer' ist der falsche Rahmen**". Those are the argument, not a slip. Do not remove them.

**4. `Sie` throughout**, including every form label, error string, CTA and the 404. This is where `du` gets in, because component copy is written by whoever built the component.

**5. Sources intact.** Every source on the English row present, titles untranslated, German glosses accurate.

**6. Does it read as German?** Written in German, not translated from English. **This is the check nothing else can do and the whole reason you are reading it.** If it reads like the machine-translated pages this site removed last year, it fails.

---

## The claims to be hardest on

These pages deliberately contradict what the German market publishes. Each correction is sourced, and each is the kind of thing that costs a reader money if we are wrong. Please be sceptical of these specifically:

**Retirement page**
- The reduced B/.750 pension threshold turns on the **sum the property was acquired for**, not the *Katasterwert*. A German law-firm page says cadastral value.
- Pharmacy discount is **10 %, on prescription only** — not the 20 % the German market repeats.
- The **15 % private-hospital discount applies only if you hold no hospitalisation insurance.** No German page carries the condition.
- The dollar **does not remove exchange-rate risk** for a euro pensioner; it moves it to the EUR/USD leg and hits the whole cost base.

**Property page**
- The **2 % transfer tax is the seller's**, assessed on land or cadastral value, not the buyer's on the purchase price. A German-language page by a Panama-admitted lawyer says otherwise.
- The **$120,000 property-tax exemption is not automatic** — it must be applied for and runs only from the application date, per DGI's own FAQ.
- Two different $120,000 thresholds exist (proposed ITBI relief on new builds vs. the *Patrimonio Familiar* exemption). The page separates them; check it does so clearly.

---

## When you are done

Tell whoever is running this **which pages passed and the date you read them**. Nothing gets stamped before you have actually read it — `checked_on` is the date of the reading, not the date the reviewer was appointed.

If a page comes back for rework, that is expected. Budget for it.

**Note on the public badge:** these pages carry **no "reviewed for accuracy" badge**. That badge is a separate field (`reviewer_id`) and it is an E-E-A-T claim backed by a professional credential. The language check is internal and never renders. If you also hold a relevant credential and want to sign publicly, that is a separate conversation.
