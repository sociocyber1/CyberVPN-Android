# NoToVPN starter-list sources

- IANA Root Zone Database is the authoritative record of delegated top-level domains, and distinguishes country-code entries from generic and other TLDs: https://www.iana.org/domains/root/db
- The Russian Government's official English-language site links the common government services portal (`gosuslugi.ru`), the Council of Federation (`council.gov.ru`), the Constitutional Court (`ksrf.ru`), and other official institutional domains: https://government.ru/en/
- Russia's Federal Tax Service's official site is `nalog.gov.ru`: https://www.nalog.gov.ru/eng/

Implementation note: country-code TLD rules should be seeded as suffix rules (for example `.ru`, `.kz`, `.eu`), not as an assertion that every site beneath them is a government site. Include only official service hostnames explicitly verified by a government source. User-editable lists should retain a practical upper bound and avoid turning all country TLDs on by default without clear confirmation because this sends DNS for those zones directly to the configured physical-network resolver in NoToVPN mode.
