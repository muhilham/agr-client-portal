# Changelog

## [0.2.0](https://github.com/muhilham/agr-client-portal/compare/v0.1.0...v0.2.0) (2026-05-05)


### Features

* **biteship:** add getBiteshipCouriers with 1h cache ([31e7fd4](https://github.com/muhilham/agr-client-portal/commit/31e7fd4acd39066d91ba3b4cc1b6e6de15febd2f))
* **biteship:** add typed API wrappers with timeout ([443aa4d](https://github.com/muhilham/agr-client-portal/commit/443aa4d03e1342f9871bd4261876c64c1c01ca51))
* cdn hostname next config ([270dc30](https://github.com/muhilham/agr-client-portal/commit/270dc3020148efc7b9b8421586a7f1bf05e25e48))
* **config:** deploy to Railway with plain img tags and nixpacks ([ba7a631](https://github.com/muhilham/agr-client-portal/commit/ba7a631bbed94819871a782626b9e3f39d645a94))
* **order:** accept shippingSelection, return discriminated union, use loadShippingContext ([783a759](https://github.com/muhilham/agr-client-portal/commit/783a75917a7cde276bde9e73c03c4ea82cf01d56))
* **orders:** add shipping section on detail, grand total on list ([d45d003](https://github.com/muhilham/agr-client-portal/commit/d45d003ed5625884fa0f85a531353e53a67031e4))
* **portal:** add FulfillmentBadge component ([e1709ae](https://github.com/muhilham/agr-client-portal/commit/e1709aef17e373a19663c8b5d00543e661d90f7c))
* **portal:** add isClientAssigned flag to CatalogProduct ([16109b1](https://github.com/muhilham/agr-client-portal/commit/16109b137e648de5d141ac923da0e24f0b3e26ac))
* **portal:** add logout button to portal navigation ([3a72779](https://github.com/muhilham/agr-client-portal/commit/3a727798a26909ea0cfc6545717466564edc8dd8))
* **portal:** add PaymentBadge component ([8bdda8c](https://github.com/muhilham/agr-client-portal/commit/8bdda8c90a546e67d3549683041e5fa9f2820b5a))
* **portal:** add Produk Saya / Produk Lainnya tabs to catalog ([b4b09ba](https://github.com/muhilham/agr-client-portal/commit/b4b09badd7e27fd7a6600389b142492d11905777))
* **portal:** insert fulfillment_status and payment_status on order creation ([b72c476](https://github.com/muhilham/agr-client-portal/commit/b72c4766137a157f1999fdd35fe3899d3d630001))
* **portal:** render fulfillment and payment badges in orders list ([a1339ff](https://github.com/muhilham/agr-client-portal/commit/a1339ff2a3f9ee03d14f83851a70f8be883d91ec))
* **portal:** render fulfillment and payment badges on order detail ([3ebe558](https://github.com/muhilham/agr-client-portal/commit/3ebe55830f3d1768ed1c0bba969bda4e75d996ca))
* **portal:** replace brand placeholder with Agroastery logo ([beac97d](https://github.com/muhilham/agr-client-portal/commit/beac97d8da16a41bf55e6856cccc021b9bfe99f2))
* **portal:** use agr favicon ([83dcc8c](https://github.com/muhilham/agr-client-portal/commit/83dcc8c2d861cd06567eeba901f19066eb3b2168))
* **review:** add shipping rates, courier picker, grand total ([f6dd7f7](https://github.com/muhilham/agr-client-portal/commit/f6dd7f769d2607a50574db2d08b2f27f671d394e))
* **shipping:** add getShippingRates server action ([d363749](https://github.com/muhilham/agr-client-portal/commit/d36374948bccfdfe4a6f79ec44648d6f894e79bc))
* **shipping:** add loadShippingContext, groupRatesByCourier, findRateMatch ([7280430](https://github.com/muhilham/agr-client-portal/commit/7280430fdca82cb8c25c2aa1275ae15996b155a6))
* **shipping:** complete Biteship shipping cost integration ([5acbe64](https://github.com/muhilham/agr-client-portal/commit/5acbe640eb86d5420663d5b0dddf299d139973e4))
* **shipping:** use dynamic courier fetch with env fallback ([79a35ad](https://github.com/muhilham/agr-client-portal/commit/79a35ad33386722290cb832d0a2a0623fe2c2ec7))
* **ui:** add AddressCard and CourierPicker components ([a392b65](https://github.com/muhilham/agr-client-portal/commit/a392b65d0da8ea09eee02079647b2d5ce2c49b7a))


### Bug Fixes

* **auth:** clear stale sb- cookies on refresh_token_not_found ([1bee81b](https://github.com/muhilham/agr-client-portal/commit/1bee81be5856367be173c4da811881af1f2ab1af))
* **auth:** use NEXT_PUBLIC_SITE_URL for OAuth redirect base URL ([e40a38d](https://github.com/muhilham/agr-client-portal/commit/e40a38d7914386390140372a2a7ac89aa6ca319f))
* **biteship:** omit empty couriers param to use all enabled couriers ([29fbeba](https://github.com/muhilham/agr-client-portal/commit/29fbebaaecc6b76f5d17623849ab097c16870399))
* **biteship:** strip null lat/lng values from rates request body ([5669f3e](https://github.com/muhilham/agr-client-portal/commit/5669f3ea825a00c2fb42bcde2e34b77951638261))
* **infra:** address code review feedback for Task 1 ([41fec07](https://github.com/muhilham/agr-client-portal/commit/41fec077739b18cc036a06f269b60c4b679b0582))
* **notifications:** switch Telegram parse_mode to HTML ([65e81ad](https://github.com/muhilham/agr-client-portal/commit/65e81ad4818bf45c873e56c350168a999cb02198))
* **orders,notifications,auth:** harden order creation and notifications ([2c6a9da](https://github.com/muhilham/agr-client-portal/commit/2c6a9dac98ceb8687a7419313cbd30577b435fd1))
* **portal:** fix SSR hydration mismatches from multiline className strings ([af93a7e](https://github.com/muhilham/agr-client-portal/commit/af93a7e196e6e60840ee0ef651139c3765265759))
* **shipping:** address final review blockers - import type, error handling, E2E tests ([f851f3d](https://github.com/muhilham/agr-client-portal/commit/f851f3da58716fe5bea66504a4b24527fb3d3ab8))
* **shipping:** defend against empty courier array and extract default constant ([c1753fc](https://github.com/muhilham/agr-client-portal/commit/c1753fcac2f3643ddf90bd8d11ee5f061836f3c3))
* **shipping:** fallback to any address when no default exists ([9c644d3](https://github.com/muhilham/agr-client-portal/commit/9c644d392dc1df26bda712b205d4d06852cccfcf))
* **telegram:** make non-blocking, add shipping fields to notification ([f1b95d1](https://github.com/muhilham/agr-client-portal/commit/f1b95d11514c3d32a30fa5837c8631106cd8b240))
* **telegram:** wrap entire function in try/catch to guarantee non-blocking ([8eb90de](https://github.com/muhilham/agr-client-portal/commit/8eb90dedc3669a69b94bee05b6684fad2484b8ef))


### Refactors

* **catalog:** switch to getSupabaseAdmin, add ship_weight_grams, remove as unknown cast ([69d4116](https://github.com/muhilham/agr-client-portal/commit/69d4116c68648932021b7bdaaf0e9805caf27c3c))
* **portal:** remove legacy StatusBadge component ([76c3df3](https://github.com/muhilham/agr-client-portal/commit/76c3df3d31db19711834c5e30d202fb7c3db8b96))


### Tests

* **e2e:** add Biteship mocks, seed helper, and shipping flow tests ([507c4dc](https://github.com/muhilham/agr-client-portal/commit/507c4dc9c0e90c3da2804f98194ca106474131ba))
* **portal:** add failing E2E tests for product list tabs ([5e9b43c](https://github.com/muhilham/agr-client-portal/commit/5e9b43cc35568d86d9e237e3b133b0c9ff9a01bb))
* **portal:** expect split fulfillment and payment badges in detail E2E ([22b51b2](https://github.com/muhilham/agr-client-portal/commit/22b51b297476a975982d5f5ce2cedefe221a15e4))
* **portal:** seed global-only product for tab E2E tests ([d64409c](https://github.com/muhilham/agr-client-portal/commit/d64409cd6652f3af905125786089f355b9d98103))


### Documentation

* add AGENTS.md, DOCS.md, and migration safety README ([215fc7e](https://github.com/muhilham/agr-client-portal/commit/215fc7ecf3d78244ade553f4ad3c1ef31157d6c8))
* **config:** add semver + release CI/CD design spec ([de834d4](https://github.com/muhilham/agr-client-portal/commit/de834d4780e0bb3034256db335e1c706e932b3fd))
* **config:** add semver CI/CD implementation plan ([ad23755](https://github.com/muhilham/agr-client-portal/commit/ad23755c6123b69eac510060b29b4393eba1d671))
* **env:** mark BITESHIP_COURIERS as optional fallback ([36b2b46](https://github.com/muhilham/agr-client-portal/commit/36b2b46b55007603831b681fdb92f23c33111878))
* **portal:** add product list tab split design spec ([5aa7567](https://github.com/muhilham/agr-client-portal/commit/5aa7567682876ae269650b07a7227056f4e10307))
* **portal:** add product list tabs implementation plan ([e1710cd](https://github.com/muhilham/agr-client-portal/commit/e1710cda9cb3c57177b276f5119f3ebca39588c0))
* **portal:** add shipping cost design spec for Biteship rates flow ([5228735](https://github.com/muhilham/agr-client-portal/commit/5228735835761f9d5cda83e660a70170edc57a15))
* **portal:** apply second-pass review fixes for shipping spec ([60149f6](https://github.com/muhilham/agr-client-portal/commit/60149f626f5acbfbf5b8b5df3fd227b45942dcc8))
* **portal:** apply spec review fixes for shipping design ([03a6238](https://github.com/muhilham/agr-client-portal/commit/03a6238f4e9d0f774c88dcbdb861f7752d268527))
* **portal:** implementation plan for order status split alignment ([2dc3c07](https://github.com/muhilham/agr-client-portal/commit/2dc3c0720a1af79ff5d4bb28b9fa5e534a32c940))
* **portal:** spec for order status split alignment with agr-ops migration 014 ([4a7773a](https://github.com/muhilham/agr-client-portal/commit/4a7773a592cad673baaa6c32f1b108e6cdb1d4f9))
* **portal:** switch status badge labels to raw English values in spec ([d321055](https://github.com/muhilham/agr-client-portal/commit/d32105569339dde751aaec4dd80d4ff06f7394ed))
