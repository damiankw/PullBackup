## [1.1.2](https://github.com/damiankw/PullBackup/compare/v1.1.1...v1.1.2) (2026-06-18)


### Bug Fixes

* **deps:** add psutil and croniter to requirements ([d49496d](https://github.com/damiankw/PullBackup/commit/d49496d982f1da870a52667725ae383966176d34))

## [1.1.1](https://github.com/damiankw/PullBackup/compare/v1.1.0...v1.1.1) (2026-06-18)


### Bug Fixes

* add email-validator, print version and elapsed time on startup ([347b499](https://github.com/damiankw/PullBackup/commit/347b499742e96f03a9aded1ad027f62a20765ffb))

# [1.1.0](https://github.com/damiankw/PullBackup/compare/v1.0.0...v1.1.0) (2026-06-18)


### Bug Fixes

* **auth:** add iss/aud claims to JWT and verify them on decode ([62de316](https://github.com/damiankw/PullBackup/commit/62de316789bf5b403388321cba55a79d113c7dd8))
* **browse-backups:** set hasPreviousSnapshot when restoring from URL params ([17ba3fa](https://github.com/damiankw/PullBackup/commit/17ba3fa9d4254fd7265ad8dce6bbe74b9ccbcaab))
* **security:** implement TOFU host key verification ([#5](https://github.com/damiankw/PullBackup/issues/5)) ([bb4d35c](https://github.com/damiankw/PullBackup/commit/bb4d35ca0e405f34215679005c1f5e16db9b01e9))
* **security:** input validation on server/job fields and sanitize key filenames ([4087ff5](https://github.com/damiankw/PullBackup/commit/4087ff55d578019a31bbe330c1d827df7c09be62))
* **security:** log terminal session connect/disconnect events ([#6](https://github.com/damiankw/PullBackup/issues/6)) ([c01aef0](https://github.com/damiankw/PullBackup/commit/c01aef00dac4ab4814a965a37943640bf415a048))
* **security:** restrict CORS to explicit allowed origins ([9f88a32](https://github.com/damiankw/PullBackup/commit/9f88a3203cdea16beab974ddb8ae941a47b98adb))
* **security:** run container as non-root pullbackup user ([41a2831](https://github.com/damiankw/PullBackup/commit/41a2831acdd48d604cb8ef1e1e33bfa87ccd38c8))
* **security:** send JWT as first WebSocket message instead of URL query param ([ead97e2](https://github.com/damiankw/PullBackup/commit/ead97e2cbf2ab1b5b93a688423ad4dcab6e438ac))


### Features

* **backup-history:** add Browse Backup Files action button ([7bca59c](https://github.com/damiankw/PullBackup/commit/7bca59ca4dc8090d5f10419cc328683e82056681))
* **backup-jobs:** create README.md on job creation and update it on edit ([72b603f](https://github.com/damiankw/PullBackup/commit/72b603fe3e5b04658bf9496aa8b07ead6c3ae22a))
* **browse-backups:** replace dropdown with three-column server/job/snapshot browser ([9cc5552](https://github.com/damiankw/PullBackup/commit/9cc555272b9e22ed25c5b7bded30fdf977ff32f9))
* **settings:** add configurable backup directory with browse UI ([16773d5](https://github.com/damiankw/PullBackup/commit/16773d58370a135fd5397f57dd0058d83bf5d058))
* **ssh-keys:** add key generation and file import ([f9e4832](https://github.com/damiankw/PullBackup/commit/f9e4832db050f82de061c18dbff1a6e4d723d5e8))
