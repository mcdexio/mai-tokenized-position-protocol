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

        it("perp emergency - failed", async () => {
            await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
            await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u3 });
            
            await perp.perpetual.beginGlobalSettlement(toWad(7000));
            try {
                await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
                throw null;
            } catch (error) {
                assert.ok(error.message.includes("wrong perpetual status"));
            }
            try {
                await tokenizer.redeemAndWithdraw(toWad(1), toWad('13999.9999999999999999'), { from: u2 });
                throw null;
            } catch (error) {
                assert.ok(error.message.includes("wrong perpetual status"));
            }
            try {
                await tokenizer.settle({ from: u2 });
                throw null;
            } catch (error) {
                assert.ok(error.message.includes("wrong perpetual status"));
            }
        });

        it("perp settled - success", async () => {
            await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
            await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u3 });
            await perp.perpetual.beginGlobalSettlement(toWad(7000));
            await perp.perpetual.endGlobalSettlement();
            try {
                await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
                throw null;
            } catch (error) {
                assert.ok(error.message.includes("wrong perpetual status"));
            }
            try {
                await tokenizer.redeemAndWithdraw(toWad(1), toWad('13999.9999999999999999'), { from: u2 });
                throw null;
            } catch (error) {
                assert.ok(error.message.includes("wrong perpetual status"));
            }
            await tokenizer.settle({ from: u2 });
            await tokenizer.settle({ from: u3 });
            assertApproximate(assert, fromWad(await perp.collateral.balanceOf(u2)), 7000 * 10 - 7000 * 1 /* short pos is not settled yet */)
            assertApproximate(assert, fromWad(await perp.collateral.balanceOf(u3)), 7000 * 10 - 7000 * 1 /* short pos is not settled yet */)
        });

        it("perp settled, transfer token - success", async () => {
            await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
            await perp.perpetual.beginGlobalSettlement(toWad(7000));
            await tokenizer.transfer(u3, toWad(0.5), { from: u2 });
            await perp.perpetual.endGlobalSettlement();
            await tokenizer.transfer(u3, toWad(0.5), { from: u2 });
            await tokenizer.settle({ from: u2 }); // do nothing
            await tokenizer.settle({ from: u3 });
            assertApproximate(assert, fromWad(await perp.collateral.balanceOf(u2)), 7000 * 10 - 7000 * 2 /* short pos is not settled yet */)
            assertApproximate(assert, fromWad(await perp.collateral.balanceOf(u3)), 7000 * 10 + 7000 * 1 /* short pos is not settled yet */)
        });

        // it("position inconsistent", async () => {
        //     const a = '6966'
        //     assertApproximate(assert, a, 7033, 1);
        // });

        // it("tp pause", async () => {
        // });

        // it("tp stop", async () => {
        // });

    });
});
