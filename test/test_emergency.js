const assert = require('assert');
const BigNumber = require('bignumber.js');
const { increaseEvmBlock, increaseEvmTime, createEVMSnapshot, restoreEVMSnapshot, toBytes32, assertApproximate } = require('./funcs');
const { toWei, fromWei, toWad, fromWad, infinity, Side } = require('./constants');
const { inspect, printFunding } = require('./funcs')
const { typicalPerp } = require('./perp.js')
const Tokenizer = artifacts.require('TokenizerImplV1.sol');

contract('tokenizer', accounts => {
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
        await tokenizer.initialize("USD -> BTC", "uBTC", perp.perpetual.address, 18);
    });

    afterEach(async function () {
        await restoreEVMSnapshot(snapshotId);
    });

    describe("emergency", async () => {
        beforeEach(async () => {
            // index
            await perp.setIndexPrice(7000);
            const indexPrice = await perp.amm.indexPrice();
            assert.equal(fromWad(indexPrice.price), 7000);

            // approve
            await perp.collateral.transfer(u1, toWad(7000 * 1 * 3));
            await perp.collateral.transfer(u2, toWad(7000 * 10));
            await perp.collateral.transfer(u3, toWad(7000 * 10));
            await perp.collateral.approve(perp.perpetual.address, infinity, { from: u1 });
            await perp.collateral.approve(perp.perpetual.address, infinity, { from: u2 });
            await perp.collateral.approve(perp.perpetual.address, infinity, { from: u3 });

            // create amm
            await perp.perpetual.deposit(toWad(7000 * 1 * 3), { from: u1 });
            await perp.amm.createPool(toWad(1), { from: u1 });
        });

        it("position inconsistent", async () => {
        });

        it("emergency", async () => {
        });

        it("global settlement", async () => {
        });
    });
});
