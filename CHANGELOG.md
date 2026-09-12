# Changelog

## [0.13.0](https://github.com/muhilham/agr-client-portal/compare/v0.12.2...v0.13.0) (2026-09-12)


### Features

* **ux:** order history — status filter, month grouping, cursor pagination ([41cf3f3](https://github.com/muhilham/agr-client-portal/commit/41cf3f3723096b2d779a39a9bc85fafef327aedd))


### Bug Fixes

* wrap OrdersClient in Suspense for useSearchParams (Next.js App Router requirement) ([3c80d73](https://github.com/muhilham/agr-client-portal/commit/3c80d733917a8b35869abb1c103294cf2a6dab07))

## [0.12.2](https://github.com/muhilham/agr-client-portal/compare/v0.12.1...v0.12.2) (2026-09-11)


### Bug Fixes

* correct image domain — was pointing to Supabase Storage, images actually come from cdn.agroastery.com ([625903b](https://github.com/muhilham/agr-client-portal/commit/625903b16326a4e9c9e92bffbd5b65d62cca21d8))

## [0.12.1](https://github.com/muhilham/agr-client-portal/compare/v0.12.0...v0.12.1) (2026-09-11)


### Bug Fixes

* **ui:** replace &lt;img&gt; with &lt;Image fill&gt; in ProductCard + configure remotePatterns ([437848f](https://github.com/muhilham/agr-client-portal/commit/437848fffd0286c1c1d534f1466ac932f0b70f84))
* **ux:** add 'Kembali ke halaman masuk' link inside unregistered card ([b7cd09a](https://github.com/muhilham/agr-client-portal/commit/b7cd09a7df24dfa90a1dec699ecc749d97fe6fe9))
* **ux:** add sign-out button on unauthorized page ([d6c3db7](https://github.com/muhilham/agr-client-portal/commit/d6c3db7dd6fa27e9d4a17fba7aa8a7b871af1e2a))
* **ux:** make sign-out button a proper tap target (48px+, border, hover state) ([226e934](https://github.com/muhilham/agr-client-portal/commit/226e934b95c6a4e7cd3963088a769a31852c7122))
* **ux:** rename sign-out button to 'Keluar dari portal' ([fc1ecb7](https://github.com/muhilham/agr-client-portal/commit/fc1ecb7ee2b696cea86c46bc1bd1f9432fa4192c))

## [0.12.0](https://github.com/muhilham/agr-client-portal/compare/v0.11.0...v0.12.0) (2026-09-11)


### Features

* **infra:** fire admin Telegram alerts when order pipeline steps fail ([27fd646](https://github.com/muhilham/agr-client-portal/commit/27fd646722c1266920b372cff6ff127ab56fc1a4))


### Bug Fixes

* type cast for capturedRatesBody in shipping e2e ([90f0142](https://github.com/muhilham/agr-client-portal/commit/90f01424763faab6564fe7cc7bd3f16c5a4dad82))
* **ux:** rewrite checkout error copy — actionable, human, code-switched ([19e1c63](https://github.com/muhilham/agr-client-portal/commit/19e1c6337ab4f173fa8c63a4f0a6aa2abfeed7b0))


### Tests

* **e2e:** replace shipping.spec.ts stubs with real assertions ([e6aa2dd](https://github.com/muhilham/agr-client-portal/commit/e6aa2ddd9f6cb2a9111679e758a8f5ee02e3c767))

## [0.11.0](https://github.com/muhilham/agr-client-portal/compare/v0.10.5...v0.11.0) (2026-09-11)


### Features

* **ux:** enrich confirmation page with order summary + shipping promise ([1c40056](https://github.com/muhilham/agr-client-portal/commit/1c4005625ac13c526bd2890cb4f3c41386751cf1))


### Bug Fixes

* correct isPickupOrder type (shipping_courier nullable) ([bde7570](https://github.com/muhilham/agr-client-portal/commit/bde75705452463f7d93c8a939ad29b09fccf44f5))

## [0.10.5](https://github.com/muhilham/agr-client-portal/compare/v0.10.4...v0.10.5) (2026-09-11)


### Bug Fixes

* **checkout:** idempotent order submit + client-side rate throttle ([0799ec3](https://github.com/muhilham/agr-client-portal/commit/0799ec33f2be8c2214451a039fdebec903d9c6fd)), closes [#19](https://github.com/muhilham/agr-client-portal/issues/19)

## [0.10.4](https://github.com/muhilham/agr-client-portal/compare/v0.10.3...v0.10.4) (2026-09-11)


### Bug Fixes

* **auth:** actionable Akses ditolak for unregistered clients ([dc5e9fe](https://github.com/muhilham/agr-client-portal/commit/dc5e9fe7731fa564c48348f2e4eb6d71981033b9))

## [0.10.3](https://github.com/muhilham/agr-client-portal/compare/v0.10.2...v0.10.3) (2026-09-09)


### Bug Fixes

* **orders:** pass p_items as native array to create_order_and_items ([#45](https://github.com/muhilham/agr-client-portal/issues/45)) ([9cc1da2](https://github.com/muhilham/agr-client-portal/commit/9cc1da29e716e40e04a3016de837863ef327c34d))

## [0.10.2](https://github.com/muhilham/agr-client-portal/compare/v0.10.1...v0.10.2) (2026-09-09)


### Bug Fixes

* **deploy:** restore SOPS binary-envelope format for sync-env.mjs ([#43](https://github.com/muhilham/agr-client-portal/issues/43)) ([ac03c35](https://github.com/muhilham/agr-client-portal/commit/ac03c35dfbec8a7833586dfcc9d247e8b16feb63))

## [0.10.1](https://github.com/muhilham/agr-client-portal/compare/v0.10.0...v0.10.1) (2026-09-08)


### Bug Fixes

* **payment:** use WhatsApp business number instead of personal number ([#41](https://github.com/muhilham/agr-client-portal/issues/41)) ([56ddbe4](https://github.com/muhilham/agr-client-portal/commit/56ddbe4e1139bb89b351d193fb5e5ba75ea8c9f0))

## [0.10.0](https://github.com/muhilham/agr-client-portal/compare/v0.9.0...v0.10.0) (2026-09-08)


### Features

* **checkout:** manual transfer payment instructions + saya-sudah-bayar flow ([#37](https://github.com/muhilham/agr-client-portal/issues/37)) ([2a9dfa0](https://github.com/muhilham/agr-client-portal/commit/2a9dfa0ac2f0a7a6aa62c5f8e8aa9b902fb2ed8c))


### Bug Fixes

* **orders:** use atomic create_order_and_items RPC to prevent phantom orders ([#39](https://github.com/muhilham/agr-client-portal/issues/39)) ([1d8a034](https://github.com/muhilham/agr-client-portal/commit/1d8a034c248f44eb972878fb0da2fc723c217824))

## [0.9.0](https://github.com/muhilham/agr-client-portal/compare/v0.8.0...v0.9.0) (2026-09-07)


### Features

* **portal:** Pesan Ulang — reorder from order history ([#34](https://github.com/muhilham/agr-client-portal/issues/34)) ([220e1af](https://github.com/muhilham/agr-client-portal/commit/220e1af2c57d50590be252bb2648c457469db2a7))

## [0.8.0](https://github.com/muhilham/agr-client-portal/compare/v0.7.2...v0.8.0) (2026-09-03)


### Features

* **orders:** snapshot shipping address at checkout into order record ([#32](https://github.com/muhilham/agr-client-portal/issues/32)) ([8ef298e](https://github.com/muhilham/agr-client-portal/commit/8ef298ef3ea1ce70f2a1d24e7b671f1905313c86))

## [0.7.2](https://github.com/muhilham/agr-client-portal/compare/v0.7.1...v0.7.2) (2026-09-03)


### Bug Fixes

* **auth:** enforce clients.is_active on all portal surfaces ([#29](https://github.com/muhilham/agr-client-portal/issues/29)) ([802672b](https://github.com/muhilham/agr-client-portal/commit/802672bf7dd351d8f6e3b9e67e23fcca9f43dbb2))
* **ux:** clamp below-min quantity with visible hint instead of silent reset ([#31](https://github.com/muhilham/agr-client-portal/issues/31)) ([a9722e1](https://github.com/muhilham/agr-client-portal/commit/a9722e149ecfaf854adced0ceb9465856a8b5e4f))

## [0.7.1](https://github.com/muhilham/agr-client-portal/compare/v0.7.0...v0.7.1) (2026-09-03)


### Bug Fixes

* **shipping:** totalize per-line weight for Biteship rate queries ([#10](https://github.com/muhilham/agr-client-portal/issues/10)) ([f42f303](https://github.com/muhilham/agr-client-portal/commit/f42f30367b1340ec36bc855f1535dbcb717e2b85))

## [0.7.0](https://github.com/muhilham/agr-client-portal/compare/v0.6.0...v0.7.0) (2026-08-27)


### Features

* **telegram:** route notifications to thread topic ([2f3c551](https://github.com/muhilham/agr-client-portal/commit/2f3c55118c3a922dc2ca552065d6349fbcdb3f94))

## [0.6.0](https://github.com/muhilham/agr-client-portal/compare/v0.5.0...v0.6.0) (2026-08-07)


### Features

* free shipping & manual shipping modes ([#7](https://github.com/muhilham/agr-client-portal/issues/7)) ([f4b410d](https://github.com/muhilham/agr-client-portal/commit/f4b410d98e55bd2153a0be66c5d85aca911a0c52))

## [0.5.0](https://github.com/muhilham/agr-client-portal/compare/v0.4.0...v0.5.0) (2026-08-07)


### Features

* **orders:** add FulfillmentToggle and PickupInfoCard components ([99c63cf](https://github.com/muhilham/agr-client-portal/commit/99c63cf5ef80d64c202d54f91056414eb757d8ad))
* **orders:** add getPickupInfo server action ([d391b9b](https://github.com/muhilham/agr-client-portal/commit/d391b9b273c8a2f84c339843cdf578acd941ae8b))
* **orders:** add pickup discriminator, cart validation extraction, and schema ([35ddfc2](https://github.com/muhilham/agr-client-portal/commit/35ddfc2c3276030242af0afaa05c1eb86213a17a))
* **orders:** branch order creation on pickup vs shipping ([e5e82cc](https://github.com/muhilham/agr-client-portal/commit/e5e82cc93cfc3fae82dfa9b2c1dc843785ebd36b))
* **orders:** show pickup label in Telegram order notification ([5f3aff9](https://github.com/muhilham/agr-client-portal/commit/5f3aff95aab32073bc1689c120b5d4c165bf58c9))
* **orders:** show pickup section on order detail page ([e4c0eec](https://github.com/muhilham/agr-client-portal/commit/e4c0eecf122480c3feda48bed2e231cc0489f490))
* **orders:** wire fulfillment toggle into order review page ([6f30786](https://github.com/muhilham/agr-client-portal/commit/6f30786f803759e174b4231c5da53952ff31ab54))


### Bug Fixes

* **orders:** make invoice address optional for pickup orders ([9581f3e](https://github.com/muhilham/agr-client-portal/commit/9581f3e7db7a5f71d84bd3fc9d830278d67e3814))
* **orders:** resolve lint warnings in review page and e2e tests ([77b9240](https://github.com/muhilham/agr-client-portal/commit/77b92408a15670ba3b554ffdf09cfc34215509ee))


### Tests

* **orders:** add E2E coverage for pickup order submission, detail, and zero-address invoice ([e9a9a80](https://github.com/muhilham/agr-client-portal/commit/e9a9a8060bc61cb08c00f6444ffd8eb539eb2f38))


### Documentation

* **orders:** add self-pickup order design spec ([dc24915](https://github.com/muhilham/agr-client-portal/commit/dc24915856771edeb6b97e6a16eee938cca2c2e8))
* **orders:** add self-pickup order implementation plan ([36d7273](https://github.com/muhilham/agr-client-portal/commit/36d727367cd9a44e2d30d44d946a110df7167885))
* **orders:** address code review feedback on self-pickup spec ([0a7e9a6](https://github.com/muhilham/agr-client-portal/commit/0a7e9a6b37bcafc917cd73117b41edad62dbcd52))
* **orders:** clarify order-number generation shared by both branches ([d028f01](https://github.com/muhilham/agr-client-portal/commit/d028f0175c76d427c004085a929f57a5bfbf1081))
* **orders:** make pickup contact_phone optional with fallback ([af3c6aa](https://github.com/muhilham/agr-client-portal/commit/af3c6aa82567e02ce24550eaa69ebb1dfc1667a1))
* updated agent skill for codex ([f501477](https://github.com/muhilham/agr-client-portal/commit/f501477e294ae85fe406e3c2b23a9cffe9dd976e))

## [0.4.0](https://github.com/muhilham/agr-client-portal/compare/v0.3.0...v0.4.0) (2026-05-07)


### Features

* **portal:** add download invoice button to order detail page ([ac8d70d](https://github.com/muhilham/agr-client-portal/commit/ac8d70d81997fd620f73b4d0d44dfc2713716eaa))
* **portal:** add DownloadInvoiceButton client component ([dbb8a70](https://github.com/muhilham/agr-client-portal/commit/dbb8a709ce1821d36a5395b77194d32f226d3e55))
* **portal:** add invoice PDF generation API route ([c5bde5a](https://github.com/muhilham/agr-client-portal/commit/c5bde5a21cdecfa99fdd4d84baa2c27759eb6f86))
* **portal:** add InvoiceDocument PDF component ([a08ca5f](https://github.com/muhilham/agr-client-portal/commit/a08ca5fc122acab1acee03e6a572ddeb538e1abc))


### Bug Fixes

* **api:** extract PDF render to .tsx helper to fix TypeScript build error ([85aa2dd](https://github.com/muhilham/agr-client-portal/commit/85aa2dd9733e4267c7a6f5995e3b1c2f23b6f352))
* **api:** rename invoice route from .tsx to .ts for Next.js App Router compatibility ([c0954ce](https://github.com/muhilham/agr-client-portal/commit/c0954ce18e350374698d14f1f4ad800e4c79aba6))
* **env:** use correct staging SUPABASE_SERVICE_ROLE_KEY ([9d98d7a](https://github.com/muhilham/agr-client-portal/commit/9d98d7a4e8d8fc5bca0cda6c9fa74f7fb98c1bb8))
* **env:** use correct staging SUPABASE_SERVICE_ROLE_KEY ([7f7232d](https://github.com/muhilham/agr-client-portal/commit/7f7232d7d715c09a302dd5ac9c5d36817dde0d80))
* **logo:** agroastery svg ([79e0b4b](https://github.com/muhilham/agr-client-portal/commit/79e0b4b586c65d178b37ddb0f8ec25402d71ba73))
* **portal:** address PR review warnings — error feedback, null guards ([9c7a0c4](https://github.com/muhilham/agr-client-portal/commit/9c7a0c4a6dddd51c91e39ab8a3bb6b7ad39f95a2))
* **portal:** fix invoice download by querying addresses via admin client ([e016b6a](https://github.com/muhilham/agr-client-portal/commit/e016b6a7402f699cd8d36ea5edbe37ae104ec6d0))


### Tests

* **portal:** add failing E2E tests for invoice download ([37d8ad1](https://github.com/muhilham/agr-client-portal/commit/37d8ad1328a9ae473cbb625776d082c0cb688e78))


### Documentation

* **config:** add invoice download feature design spec ([2ce4463](https://github.com/muhilham/agr-client-portal/commit/2ce44631bdbb46d12938b2d0fbee7841bc2e53c2))
* **config:** add invoice download implementation plan ([0c84fa1](https://github.com/muhilham/agr-client-portal/commit/0c84fa19d2fb624023461d5daa9ad797420fd446))

## [0.3.0](https://github.com/muhilham/agr-client-portal/compare/v0.2.0...v0.3.0) (2026-05-05)


### Features

* **config:** add SOPS + Age encrypted env management ([73013ab](https://github.com/muhilham/agr-client-portal/commit/73013ab27ae9cf2b87ba27c28f4bfa99cff1114c))
* **config:** add SOPS env sync to deploy workflows ([8cf61e0](https://github.com/muhilham/agr-client-portal/commit/8cf61e074d64444e0e7edd32fa53294ae6ff4a4b))
* **env:** add script to clean git-managed envs from Railway ([bd30aa9](https://github.com/muhilham/agr-client-portal/commit/bd30aa97cbd29d3aea5bfbb75347251c61c563b6))
* **env:** add sync-env.mjs script to sync SOPS-encrypted env files to Railway ([0371b2e](https://github.com/muhilham/agr-client-portal/commit/0371b2ea980cdbb770dee2755d59b41fa85ca194))


### Bug Fixes

* apply PR review feedback ([71d2b32](https://github.com/muhilham/agr-client-portal/commit/71d2b32069492574f931f7ecb4cfbcbd74fdb3cd))


### Documentation

* add environment variables management guide ([37e8473](https://github.com/muhilham/agr-client-portal/commit/37e8473155c88d1b02039d63824cdc8274c6a065))

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
