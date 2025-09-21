import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_COLLECTION_NAME = 101;
const ERR_INVALID_EDITION_CAP = 102;
const ERR_INVALID_ROYALTY_PERCENT = 103;
const ERR_INVALID_CONTENT_HASH = 104;
const ERR_INVALID_TITLE = 105;
const ERR_INVALID_DESCRIPTION = 106;
const ERR_COLLECTION_ALREADY_EXISTS = 107;
const ERR_COLLECTION_NOT_FOUND = 108;
const ERR_EDITION_CAP_EXCEEDED = 109;
const ERR_INVALID_METADATA = 110;
const ERR_PAUSED = 111;
const ERR_NOT_PAUSED = 112;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_MAX_COLLECTIONS_EXCEEDED = 114;
const ERR_INVALID_COLLECTIBLE_TYPE = 115;
const ERR_INVALID_BASE_URI = 116;
const ERR_INVALID_ROYALTY_RECIPIENT = 117;
const ERR_INVALID_MINT_FEE = 118;
const ERR_INVALID_STATUS = 119;
const ERR_INVALID_TIMESTAMP = 120;
const ERR_INVALID_COLLABORATORS = 121;
const ERR_INVALID_COLLAB_SPLIT = 122;
const ERR_BATCH_LIMIT_EXCEEDED = 123;
const ERR_INVALID_BATCH_SIZE = 124;
const ERR_COLLECTION_UPDATE_NOT_ALLOWED = 125;

interface Collection {
	name: string;
	editionCap: number;
	editionCount: number;
	royaltyPercent: number;
	royaltyRecipient: string;
	creator: string;
	baseUri: string;
	collectibleType: string;
	timestamp: number;
	status: boolean;
	collaborators: string[];
	collabSplits: number[];
}

interface NFT {
	collectionId: number;
	contentHash: Uint8Array;
	title: string;
	description: string;
	metadata: string | null;
	owner: string;
	timestamp: number;
}

interface CollectionUpdate {
	updateName: string;
	updateEditionCap: number;
	updateRoyaltyPercent: number;
	updateTimestamp: number;
	updater: string;
}

type Result<T> = {
	ok: boolean;
	value: T | number;
};

class NFTMinterMock {
	state: {
		nextCollectionId: number;
		nextTokenId: number;
		maxCollections: number;
		mintFee: number;
		paused: boolean;
		authorityContract: string | null;
		collections: Map<number, Collection>;
		collectionsByName: Map<string, number>;
		nfts: Map<number, NFT>;
		collectionUpdates: Map<number, CollectionUpdate>;
	} = {
		nextCollectionId: 0,
		nextTokenId: 0,
		maxCollections: 1000,
		mintFee: 500,
		paused: false,
		authorityContract: null,
		collections: new Map(),
		collectionsByName: new Map(),
		nfts: new Map(),
		collectionUpdates: new Map(),
	};
	blockHeight: number = 0;
	caller: string = "ST1TEST";
	stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

	constructor() {
		this.reset();
	}

	reset() {
		this.state = {
			nextCollectionId: 0,
			nextTokenId: 0,
			maxCollections: 1000,
			mintFee: 500,
			paused: false,
			authorityContract: null,
			collections: new Map(),
			collectionsByName: new Map(),
			nfts: new Map(),
			collectionUpdates: new Map(),
		};
		this.blockHeight = 0;
		this.caller = "ST1TEST";
		this.stxTransfers = [];
	}

	setAuthorityContract(contractPrincipal: string): Result<boolean> {
		if (this.state.authorityContract !== null) {
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		}
		this.state.authorityContract = contractPrincipal;
		return { ok: true, value: true };
	}

	setMintFee(newFee: number): Result<boolean> {
		if (this.state.authorityContract === null) {
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		}
		this.state.mintFee = newFee;
		return { ok: true, value: true };
	}

	setMaxCollections(newMax: number): Result<boolean> {
		if (this.state.authorityContract === null) {
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		}
		this.state.maxCollections = newMax;
		return { ok: true, value: true };
	}

	pauseContract(): Result<boolean> {
		if (this.state.authorityContract === null) {
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		}
		if (this.state.paused) {
			return { ok: false, value: ERR_PAUSED };
		}
		this.state.paused = true;
		return { ok: true, value: true };
	}

	unpauseContract(): Result<boolean> {
		if (this.state.authorityContract === null) {
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		}
		if (!this.state.paused) {
			return { ok: false, value: ERR_NOT_PAUSED };
		}
		this.state.paused = false;
		return { ok: true, value: true };
	}

	createCollection(
		name: string,
		editionCap: number,
		royaltyPercent: number,
		royaltyRecipient: string,
		baseUri: string,
		collectibleType: string,
		collaborators: string[],
		collabSplits: number[]
	): Result<number> {
		if (this.state.paused) return { ok: false, value: ERR_PAUSED };
		if (this.state.nextCollectionId >= this.state.maxCollections)
			return { ok: false, value: ERR_MAX_COLLECTIONS_EXCEEDED };
		if (!name || name.length > 100)
			return { ok: false, value: ERR_INVALID_COLLECTION_NAME };
		if (editionCap <= 0 || editionCap > 1000)
			return { ok: false, value: ERR_INVALID_EDITION_CAP };
		if (royaltyPercent > 100)
			return { ok: false, value: ERR_INVALID_ROYALTY_PERCENT };
		if (royaltyRecipient === this.caller)
			return { ok: false, value: ERR_INVALID_ROYALTY_RECIPIENT };
		if (!baseUri || baseUri.length > 200)
			return { ok: false, value: ERR_INVALID_BASE_URI };
		if (!["art", "music", "collectible"].includes(collectibleType))
			return { ok: false, value: ERR_INVALID_COLLECTIBLE_TYPE };
		if (collaborators.length > 10)
			return { ok: false, value: ERR_INVALID_COLLABORATORS };
		if (collabSplits.length !== collaborators.length)
			return { ok: false, value: ERR_INVALID_COLLAB_SPLIT };
		const sum = collabSplits.reduce((a, b) => a + b, 0);
		if (collaborators.length > 0 && sum !== 100)
			return { ok: false, value: ERR_INVALID_COLLAB_SPLIT };
		if (this.state.collectionsByName.has(name))
			return { ok: false, value: ERR_COLLECTION_ALREADY_EXISTS };
		if (this.state.authorityContract === null)
			return { ok: false, value: ERR_NOT_AUTHORIZED };

		this.stxTransfers.push({
			amount: this.state.mintFee,
			from: this.caller,
			to: this.state.authorityContract,
		});

		const id = this.state.nextCollectionId;
		const collection: Collection = {
			name,
			editionCap,
			editionCount: 0,
			royaltyPercent,
			royaltyRecipient,
			creator: this.caller,
			baseUri,
			collectibleType,
			timestamp: this.blockHeight,
			status: true,
			collaborators,
			collabSplits,
		};
		this.state.collections.set(id, collection);
		this.state.collectionsByName.set(name, id);
		this.state.nextCollectionId++;
		return { ok: true, value: id };
	}

	mintNft(
		collectionId: number,
		contentHash: Uint8Array,
		title: string,
		description: string,
		metadata: string | null
	): Result<number> {
		const collection = this.state.collections.get(collectionId);
		if (!collection) return { ok: false, value: ERR_COLLECTION_NOT_FOUND };
		if (this.state.paused) return { ok: false, value: ERR_PAUSED };
		if (collection.creator !== this.caller)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (collection.editionCount >= collection.editionCap)
			return { ok: false, value: ERR_EDITION_CAP_EXCEEDED };
		if (contentHash.length !== 32)
			return { ok: false, value: ERR_INVALID_CONTENT_HASH };
		if (!title || title.length > 100)
			return { ok: false, value: ERR_INVALID_TITLE };
		if (description.length > 500)
			return { ok: false, value: ERR_INVALID_DESCRIPTION };
		if (metadata && metadata.length > 1000)
			return { ok: false, value: ERR_INVALID_METADATA };

		const tokenId = this.state.nextTokenId;
		const nft: NFT = {
			collectionId,
			contentHash,
			title,
			description,
			metadata,
			owner: this.caller,
			timestamp: this.blockHeight,
		};
		this.state.nfts.set(tokenId, nft);
		collection.editionCount++;
		this.state.nextTokenId++;
		return { ok: true, value: tokenId };
	}

	batchMintNfts(
		collectionId: number,
		hashes: Uint8Array[],
		titles: string[],
		descriptions: string[],
		metadatas: (string | null)[]
	): Result<{ collectionId: number; count: number }> {
		const batchSize = hashes.length;
		const collection = this.state.collections.get(collectionId);
		if (!collection) return { ok: false, value: ERR_COLLECTION_NOT_FOUND };
		if (this.state.paused) return { ok: false, value: ERR_PAUSED };
		if (collection.creator !== this.caller)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (batchSize <= 0 || batchSize > 10)
			return { ok: false, value: ERR_INVALID_BATCH_SIZE };
		if (collection.editionCount + batchSize > collection.editionCap)
			return { ok: false, value: ERR_EDITION_CAP_EXCEEDED };
		if (
			batchSize !== titles.length ||
			batchSize !== descriptions.length ||
			batchSize !== metadatas.length
		)
			return { ok: false, value: ERR_INVALID_BATCH_SIZE };

		let count = 0;
		for (let i = 0; i < batchSize; i++) {
			if (hashes[i].length !== 32)
				return { ok: false, value: ERR_INVALID_CONTENT_HASH };
			if (!titles[i] || titles[i].length > 100)
				return { ok: false, value: ERR_INVALID_TITLE };
			if (descriptions[i].length > 500)
				return { ok: false, value: ERR_INVALID_DESCRIPTION };
			if (metadatas[i] && metadatas[i]!.length > 1000)
				return { ok: false, value: ERR_INVALID_METADATA };

			const tokenId = this.state.nextTokenId;
			const nft: NFT = {
				collectionId,
				contentHash: hashes[i],
				title: titles[i],
				description: descriptions[i],
				metadata: metadatas[i],
				owner: this.caller,
				timestamp: this.blockHeight,
			};
			this.state.nfts.set(tokenId, nft);
			this.state.nextTokenId++;
			count++;
		}
		collection.editionCount += count;
		return { ok: true, value: { collectionId, count } };
	}

	updateCollection(
		id: number,
		updateName: string,
		updateEditionCap: number,
		updateRoyaltyPercent: number
	): Result<boolean> {
		const collection = this.state.collections.get(id);
		if (!collection) return { ok: false, value: ERR_COLLECTION_NOT_FOUND };
		if (this.state.paused) return { ok: false, value: ERR_PAUSED };
		if (collection.creator !== this.caller)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (!updateName || updateName.length > 100)
			return { ok: false, value: ERR_INVALID_COLLECTION_NAME };
		if (updateEditionCap <= 0 || updateEditionCap > 1000)
			return { ok: false, value: ERR_INVALID_EDITION_CAP };
		if (updateRoyaltyPercent > 100)
			return { ok: false, value: ERR_INVALID_ROYALTY_PERCENT };
		if (
			this.state.collectionsByName.has(updateName) &&
			this.state.collectionsByName.get(updateName) !== id
		) {
			return { ok: false, value: ERR_COLLECTION_ALREADY_EXISTS };
		}

		const updated: Collection = {
			...collection,
			name: updateName,
			editionCap: updateEditionCap,
			royaltyPercent: updateRoyaltyPercent,
			timestamp: this.blockHeight,
		};
		this.state.collections.set(id, updated);
		this.state.collectionsByName.delete(collection.name);
		this.state.collectionsByName.set(updateName, id);
		this.state.collectionUpdates.set(id, {
			updateName,
			updateEditionCap,
			updateRoyaltyPercent,
			updateTimestamp: this.blockHeight,
			updater: this.caller,
		});
		return { ok: true, value: true };
	}

	getCollectionCount(): Result<number> {
		return { ok: true, value: this.state.nextCollectionId };
	}

	getTokenCount(): Result<number> {
		return { ok: true, value: this.state.nextTokenId };
	}

	checkCollectionExistence(name: string): Result<boolean> {
		return { ok: true, value: this.state.collectionsByName.has(name) };
	}

	getCollection(id: number): Collection | undefined {
		return this.state.collections.get(id);
	}

	getNft(id: number): NFT | undefined {
		return this.state.nfts.get(id);
	}
}

describe("NFTMinter", () => {
	let contract: NFTMinterMock;

	beforeEach(() => {
		contract = new NFTMinterMock();
		contract.reset();
		contract.setAuthorityContract("ST2AUTH");
	});

	it("creates a collection successfully", () => {
		contract.caller = "ST1TEST";
		const result = contract.createCollection(
			"ArtCollection",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			["ST4COLLAB1", "ST5COLLAB2"],
			[50, 50]
		);
		expect(result.ok).toBe(true);
		expect(result.value as number).toBe(0);

		const collection = contract.getCollection(0);
		expect(collection?.name).toBe("ArtCollection");
		expect(collection?.editionCap).toBe(100);
		expect(collection?.royaltyPercent).toBe(10);
		expect(collection?.royaltyRecipient).toBe("ST3RECIP");
		expect(collection?.baseUri).toBe("https://example.com/");
		expect(collection?.collectibleType).toBe("art");
		expect(collection?.collaborators).toEqual(["ST4COLLAB1", "ST5COLLAB2"]);
		expect(collection?.collabSplits).toEqual([50, 50]);
		expect(contract.stxTransfers).toEqual([
			{ amount: 500, from: "ST1TEST", to: "ST2AUTH" },
		]);
	});

	it("rejects duplicate collection names", () => {
		contract.createCollection(
			"ArtCollection",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		const result = contract.createCollection(
			"ArtCollection",
			200,
			20,
			"ST4RECIP",
			"https://example2.com/",
			"music",
			[],
			[]
		);
		expect(result.ok).toBe(false);
		expect(result.value as number).toBe(ERR_COLLECTION_ALREADY_EXISTS);
	});

	it("rejects collection creation when paused", () => {
		contract.pauseContract();
		const result = contract.createCollection(
			"PausedCollection",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		expect(result.ok).toBe(false);
	});

	it("mints an NFT successfully", () => {
		contract.createCollection(
			"ArtCollection",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		const hash = new Uint8Array(32);
		const result = contract.mintNft(
			0,
			hash,
			"NFT Title",
			"Description",
			"Metadata"
		);
		expect(result.ok).toBe(true);
		expect(result.value as number).toBe(0);

		const nft = contract.getNft(0);
		expect(nft?.collectionId).toBe(0);
		expect(nft?.title).toBe("NFT Title");
		expect(nft?.description).toBe("Description");
		expect(nft?.metadata).toBe("Metadata");
		const collection = contract.getCollection(0);
		expect(collection?.editionCount).toBe(1);
	});

	it("rejects minting when edition cap exceeded", () => {
		contract.createCollection(
			"SmallCollection",
			1,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		const hash = new Uint8Array(32);
		contract.mintNft(0, hash, "NFT1", "Desc1", null);
		const result = contract.mintNft(0, hash, "NFT2", "Desc2", null);
		expect(result.ok).toBe(false);
		expect(result.value as number).toBe(ERR_EDITION_CAP_EXCEEDED);
	});

	it("batch mints NFTs successfully", () => {
		contract.createCollection(
			"BatchCollection",
			5,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		const hashes = [new Uint8Array(32), new Uint8Array(32)];
		const titles = ["NFT1", "NFT2"];
		const descriptions = ["Desc1", "Desc2"];
		const metadatas = [null, null];
		const result = contract.batchMintNfts(
			0,
			hashes,
			titles,
			descriptions,
			metadatas
		);
		expect(result.ok).toBe(true);
		expect((result.value as { count: number }).count).toBe(2);
		const collection = contract.getCollection(0);
		expect(collection?.editionCount).toBe(2);
	});

	it("rejects batch minting with invalid size", () => {
		contract.createCollection(
			"InvalidBatch",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		const hashes: Uint8Array[] = [];
		const titles: string[] = [];
		const descriptions: string[] = [];
		const metadatas: (string | null)[] = [];
		const result = contract.batchMintNfts(
			0,
			hashes,
			titles,
			descriptions,
			metadatas
		);
		expect(result.ok).toBe(false);
		expect(result.value as number).toBe(ERR_INVALID_BATCH_SIZE);
	});

	it("updates a collection successfully", () => {
		contract.createCollection(
			"OldCollection",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		const result = contract.updateCollection(0, "NewCollection", 200, 20);
		expect(result.ok).toBe(true);
		expect(result.value as boolean).toBe(true);
		const collection = contract.getCollection(0);
		expect(collection?.name).toBe("NewCollection");
		expect(collection?.editionCap).toBe(200);
		expect(collection?.royaltyPercent).toBe(20);
		const update = contract.state.collectionUpdates.get(0);
		expect(update?.updateName).toBe("NewCollection");
		expect(update?.updateEditionCap).toBe(200);
		expect(update?.updateRoyaltyPercent).toBe(20);
	});

	it("rejects update for non-existent collection", () => {
		const result = contract.updateCollection(99, "NewCollection", 200, 20);
		expect(result.ok).toBe(false);
	});

	it("sets mint fee successfully", () => {
		const result = contract.setMintFee(1000);
		expect(result.ok).toBe(true);
		expect(result.value as boolean).toBe(true);
		expect(contract.state.mintFee).toBe(1000);
	});

	it("returns correct collection count", () => {
		contract.createCollection(
			"Collection1",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		contract.createCollection(
			"Collection2",
			200,
			20,
			"ST4RECIP",
			"https://example2.com/",
			"music",
			[],
			[]
		);
		const result = contract.getCollectionCount();
		expect(result.ok).toBe(true);
		expect(result.value as number).toBe(2);
	});

	it("checks collection existence correctly", () => {
		contract.createCollection(
			"TestCollection",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		const result = contract.checkCollectionExistence("TestCollection");
		expect(result.ok).toBe(true);
		expect(result.value as boolean).toBe(true);
		const result2 = contract.checkCollectionExistence("NonExistent");
		expect(result2.ok).toBe(true);
		expect(result2.value as boolean).toBe(false);
	});

	it("rejects collection creation with empty name", () => {
		const result = contract.createCollection(
			"",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		expect(result.ok).toBe(false);
		expect(result.value as number).toBe(ERR_INVALID_COLLECTION_NAME);
	});

	it("rejects collection creation with max collections exceeded", () => {
		contract.state.maxCollections = 1;
		contract.createCollection(
			"Collection1",
			100,
			10,
			"ST3RECIP",
			"https://example.com/",
			"art",
			[],
			[]
		);
		const result = contract.createCollection(
			"Collection2",
			200,
			20,
			"ST4RECIP",
			"https://example2.com/",
			"music",
			[],
			[]
		);
		expect(result.ok).toBe(false);
		expect(result.value as number).toBe(ERR_MAX_COLLECTIONS_EXCEEDED);
	});

	it("parses collection parameters with Clarity types", () => {
		const name = stringAsciiCV("TestCollection");
		const editionCap = uintCV(100);
		const royaltyPercent = uintCV(10);
		expect(name.value).toBe("TestCollection");
		expect(editionCap.value).toEqual(BigInt(100));
		expect(royaltyPercent.value).toEqual(BigInt(10));
	});
});
