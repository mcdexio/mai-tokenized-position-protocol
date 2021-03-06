const assert = require('assert');
const { shouldThrows, createEVMSnapshot, restoreEVMSnapshot, toBytes32, assertApproximate } = require('./funcs');
const { toWad, fromWad, infinity } = require('./constants');
const { inspect, printFunding } = require('./funcs');
const { typicalPerp } = require('./perp.js');
const { default: BigNumber } = require('bignumber.js');
const Tokenizer = artifacts.require('TokenizerImplV1.sol');

contract('governance', accounts => {
    let tokenizer;
    let perp;
   
    const broker = accounts[9];
    const admin = accounts[0];
    const dev = accounts[1];

    const u1 = accounts[4];
    const u2 = accounts[5];
    const u3 = accounts[6];

    let snapshotId;

    beforeEach(async () => {
        snapshotId = await createEVMSnapshot();
            
        perp = typicalPerp(accounts, false);
        await perp.deploy();
        await perp.useDefaultGovParameters();
        await perp.usePoolDefaultParameters();
        tokenizer = await Tokenizer.new();
        await perp.globalConfig.addComponent(perp.perpetual.address, tokenizer.address);
        await tokenizer.initialize("USD -> BTC", "uBTC", perp.perpetual.address, 18, dev, toWad('1000000'));
    });

    afterEach(async function () {
        await restoreEVMSnapshot(snapshotId);
    });

    it("change dev", async () => {
        assert.equal(await tokenizer.getDevAddress(), dev);
        await tokenizer.setDevAddress(u1);
        assert.equal(await tokenizer.getDevAddress(), u1);
    });

    it("change fee", async () => {
        assert.equal(fromWad(await tokenizer.getMintFeeRate()), "0");
        await tokenizer.setMintFeeRate(toWad("0.01"));
        assert.equal(fromWad(await tokenizer.getMintFeeRate()), "0.01");
    });

    it("only owner", async () => {
        await shouldThrows(tokenizer.setDevAddress(u1, { from: u1 }), "not owner");
        await shouldThrows(tokenizer.setMintFeeRate(toWad("0.01"), { from: u1 }), "not owner");
        await shouldThrows(tokenizer.pause({ from: u1 }), "unauthorized");
        await shouldThrows(tokenizer.unpause({ from: u1 }), "unauthorized");
        await shouldThrows(tokenizer.shutdown({ from: u1 }), "not owner");
        await shouldThrows(tokenizer.setCap(toWad(1), { from: u1 }), "not owner");
    });

    it("reader", async () => {
        await tokenizer.setMintFeeRate(toWad("0.01"));
        const gov = await tokenizer.dumpGov();
        assert.equal(gov[0], perp.perpetual.address);
        assert.equal(gov[1], dev);
        assert.equal(fromWad(gov[2]), "0.01");
        assert.equal(fromWad(gov[3]), "1000000");
        assert.ok(!gov[4], "should not paused");
        assert.ok(!gov[5], "should not stopped");
    });
});
