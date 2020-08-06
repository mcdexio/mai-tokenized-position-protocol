const assert = require('assert');
const BigNumber = require('bignumber.js');
const { increaseEvmBlock, increaseEvmTime, createEVMSnapshot, restoreEVMSnapshot, toBytes32, assertApproximate } = require('./funcs');
const { toWad, fromWad, infinity } = require('./constants');
const { inspect, printFunding } = require('./funcs')
const { typicalPerp } = require('./perp.js')
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
        try {
            await tokenizer.setDevAddress(u1, { from: u1 });
            throw null;
        } catch (error) {
            assert.ok(error.message.includes("not owner"), error);
        }

        try {
            await tokenizer.setMintFeeRate(toWad("0.01"), { from: u1 });
            throw null;
        } catch (error) {
            assert.ok(error.message.includes("not owner"), error);
        }

        try {
            await tokenizer.pause({ from: u1 });
            throw null;
        } catch (error) {
            assert.ok(error.message.includes("unauthorized"), error);
        }

        try {
            await tokenizer.unpause({ from: u1 });
            throw null;
        } catch (error) {
            assert.ok(error.message.includes("unauthorized"), error);
        }

        try {
            await tokenizer.shutdown({ from: u1 });
            throw null;
        } catch (error) {
            assert.ok(error.message.includes("not owner"), error);
        }

        try {
            await tokenizer.setCap(toWad(1), { from: u1 });
            throw null;
        } catch (error) {
            assert.ok(error.message.includes("not owner"), error);
        }
    })
});
