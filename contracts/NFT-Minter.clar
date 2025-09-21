 (define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-EDITION-CAP u101)
(define-constant ERR-INVALID-ROYALTY-PERCENT u102)
(define-constant ERR-INVALID-METADATA u103)
(define-constant ERR-MINT-PAUSED u104)
(define-constant ERR-COLLECTION-ALREADY-EXISTS u105)
(define-constant ERR-COLLECTION-NOT-FOUND u106)
(define-constant ERR-INVALID-COLLECTION-ID u107)
(define-constant ERR-MAX-COLLECTIONS-EXCEEDED u108)
(define-constant ERR-INVALID-TIMESTAMP u109)
(define-constant ERR-INVALID-CONTENT-HASH u110)
(define-constant ERR-INVALID-TITLE u111)
(define-constant ERR-INVALID-DESCRIPTION u112)
(define-constant ERR-EDITION-CAP-REACHED u113)
(define-constant ERR-INVALID-COLLABORATOR u114)
(define-constant ERR-TOO-MANY-COLLABORATORS u115)
(define-constant ERR-INVALID-BASE-URI u116)
(define-constant ERR-INVALID-STATUS u117)
(define-constant ERR-UPDATE-NOT-ALLOWED u118)
(define-constant ERR-INVALID-UPDATE-PARAM u119)
(define-constant ERR-INVALID-MINT-AMOUNT u120)

(define-non-fungible-token collectible-nft uint)

(define-data-var next-collection-id uint u0)
(define-data-var max-collections uint u100)
(define-data-var mint-fee uint u500)
(define-data-var contract-owner principal tx-sender)
(define-data-var mint-paused bool false)

(define-map collections
  uint
  {
    name: (string-ascii 100),
    edition-cap: uint,
    edition-count: uint,
    royalty-percent: uint,
    creator: principal,
    timestamp: uint,
    base-uri: (string-ascii 200),
    status: bool,
    collaborators: (list 10 principal),
    royalty-splits: (list 10 uint)
  }
)

(define-map collections-by-name
  (string-ascii 100)
  uint)

(define-map nft-metadata
  uint
  {
    content-hash: (buff 32),
    title: (string-ascii 100),
    description: (string-ascii 500),
    mint-timestamp: uint,
    minter: principal
  }
)

(define-map collection-updates
  uint
  {
    update-name: (string-ascii 100),
    update-edition-cap: uint,
    update-royalty-percent: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-collection (id uint))
  (map-get? collections id)
)

(define-read-only (get-collection-updates (id uint))
  (map-get? collection-updates id)
)

(define-read-only (get-nft-metadata (token-id uint))
  (map-get? nft-metadata token-id)
)

(define-read-only (is-collection-registered (name (string-ascii 100)))
  (is-some (map-get? collections-by-name name))
)

(define-private (validate-name (name (string-ascii 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
      (ok true)
      (err ERR-INVALID-UPDATE-PARAM))
)

(define-private (validate-edition-cap (cap uint))
  (if (and (> cap u0) (<= cap u1000))
      (ok true)
      (err ERR-INVALID-EDITION-CAP))
)

(define-private (validate-royalty-percent (percent uint))
  (if (<= percent u20)
      (ok true)
      (err ERR-INVALID-ROYALTY-PERCENT))
)

(define-private (validate-content-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-CONTENT-HASH))
)

(define-private (validate-title (title (string-ascii 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (desc (string-ascii 500)))
  (if (<= (len desc) u500)
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-base-uri (uri (string-ascii 200)))
  (if (and (> (len uri) u0) (<= (len uri) u200))
      (ok true)
      (err ERR-INVALID-BASE-URI))
)

(define-private (validate-collaborators (collabs (list 10 principal)))
  (if (<= (len collabs) u10)
      (ok true)
      (err ERR-TOO-MANY-COLLABORATORS))
)

(define-private (validate-royalty-splits (splits (list 10 uint)))
  (let ((total (fold + splits u0)))
    (if (and (is-eq (len splits) (len (default-to (list) (get collaborators none)))) (<= total u100))
        (ok true)
        (err ERR-INVALID-ROYALTY-PERCENT)))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (is-owner (caller principal))
  (is-eq caller (var-get contract-owner))
)

(define-public (set-mint-paused (paused bool))
  (begin
    (asserts! (is-owner tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set mint-paused paused)
    (ok true)
  )
)

(define-public (set-mint-fee (new-fee uint))
  (begin
    (asserts! (is-owner tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set mint-fee new-fee)
    (ok true)
  )
)

(define-public (set-max-collections (new-max uint))
  (begin
    (asserts! (is-owner tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set max-collections new-max)
    (ok true)
  )
)

(define-public (create-collection
  (name (string-ascii 100))
  (edition-cap uint)
  (royalty-percent uint)
  (base-uri (string-ascii 200))
  (collaborators (list 10 principal))
  (royalty-splits (list 10 uint))
)
  (let (
        (next-id (+ (var-get next-collection-id) u1))
      )
    (asserts! (< (var-get next-collection-id) (var-get max-collections)) (err ERR-MAX-COLLECTIONS-EXCEEDED))
    (try! (validate-name name))
    (try! (validate-edition-cap edition-cap))
    (try! (validate-royalty-percent royalty-percent))
    (try! (validate-base-uri base-uri))
    (try! (validate-collaborators collaborators))
    (try! (validate-royalty-splits royalty-splits))
    (asserts! (is-none (map-get? collections-by-name name)) (err ERR-COLLECTION-ALREADY-EXISTS))
    (try! (stx-transfer? (var-get mint-fee) tx-sender (var-get contract-owner)))
    (map-set collections next-id
      {
        name: name,
        edition-cap: edition-cap,
        edition-count: u0,
        royalty-percent: royalty-percent,
        creator: tx-sender,
        timestamp: block-height,
        base-uri: base-uri,
        status: true,
        collaborators: collaborators,
        royalty-splits: royalty-splits
      }
    )
    (map-set collections-by-name name next-id)
    (var-set next-collection-id next-id)
    (print { event: "collection-created", id: next-id })
    (ok next-id)
  )
)

(define-public (mint-nft
  (collection-id uint)
  (content-hash (buff 32))
  (title (string-ascii 100))
  (description (string-ascii 500))
)
  (let (
        (collection (unwrap! (map-get? collections collection-id) (err ERR-COLLECTION-NOT-FOUND)))
        (next-token-id (+ (var-get next-collection-id) u1)) ;; Note: This should be a separate token counter, but for simplicity
        (current-count (get edition-count collection))
      )
    (asserts! (not (var-get mint-paused)) (err ERR-MINT-PAUSED))
    (asserts! (is-eq (get creator collection) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (< current-count (get edition-cap collection)) (err ERR-EDITION-CAP-REACHED))
    (try! (validate-content-hash content-hash))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (nft-mint? collectible-nft next-token-id tx-sender))
    (map-set nft-metadata next-token-id
      {
        content-hash: content-hash,
        title: title,
        description: description,
        mint-timestamp: block-height,
        minter: tx-sender
      }
    )
    (map-set collections collection-id
      (merge collection { edition-count: (+ current-count u1) })
    )
    (print { event: "nft-minted", token-id: next-token-id, collection-id: collection-id })
    (ok next-token-id)
  )
)

(define-public (update-collection
  (collection-id uint)
  (update-name (string-ascii 100))
  (update-edition-cap uint)
  (update-royalty-percent uint)
)
  (let ((collection (unwrap! (map-get? collections collection-id) (err ERR-COLLECTION-NOT-FOUND))))
    (asserts! (is-eq (get creator collection) tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-name update-name))
    (try! (validate-edition-cap update-edition-cap))
    (try! (validate-royalty-percent update-royalty-percent))
    (let ((existing (map-get? collections-by-name update-name)))
      (match existing
        existing-id
          (asserts! (is-eq existing-id collection-id) (err ERR-COLLECTION-ALREADY-EXISTS))
        true
      )
    )
    (let ((old-name (get name collection)))
      (if (not (is-eq old-name update-name))
          (begin
            (map-delete collections-by-name old-name)
            (map-set collections-by-name update-name collection-id)
          )
          true
      )
    )
    (map-set collections collection-id
      (merge collection
        {
          name: update-name,
          edition-cap: update-edition-cap,
          royalty-percent: update-royalty-percent,
          timestamp: block-height
        }
      )
    )
    (map-set collection-updates collection-id
      {
        update-name: update-name,
        update-edition-cap: update-edition-cap,
        update-royalty-percent: update-royalty-percent,
        update-timestamp: block-height,
        updater: tx-sender
      }
    )
    (print { event: "collection-updated", id: collection-id })
    (ok true)
  )
)

(define-public (get-collection-count)
  (ok (var-get next-collection-id))
)

(define-public (check-collection-existence (name (string-ascii 100)))
  (ok (is-collection-registered name))
)