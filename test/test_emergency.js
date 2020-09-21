const assert = require('assert');
const BigNumber = require('bignumber.js');
const { shouldThrows, createEVMSnapshot, restoreEVMSnapshot, toBytes32, assertApproximate } = require('./funcs');
const { toWad, fromWad, infinity } = require('./constants');
const { inspect, printFunding } = require('./funcs')
const { typicalPerp } = require('./perp.js')
const Tokenizer = artifacts.require('TokenizerImplV1.sol');

contract('emergency', accounts => {
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

        // insurance
        await perp.collateral.transfer(u1, toWad(7000));
        await perp.perpetual.depositToInsuranceFund(toWad(7000), { from: u1 });
    });

    afterEach(async function () {
        await restoreEVMSnapshot(snapshotId);
    });

    it("perp emergency - failed", async () => {
        await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
        await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u3 });
        
        await perp.perpetual.beginGlobalSettlement(toWad(7000));
        await shouldThrows(tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 }), "wrong perpetual status");
        await shouldThrows(tokenizer.redeemAndWithdraw(toWad(1), toWad('13999.9999999999999999'), { from: u2 }), "wrong perpetual status");
        await shouldThrows(tokenizer.settle({ from: u2 }), "wrong perpetual status");
        await tokenizer.transfer(u3, toWad(1), { from: u2 });
        await tokenizer.transfer(u2, toWad(1), { from: u3 });
        await tokenizer.approve(u2, infinity, { from: u2 });
        await tokenizer.transferFrom(u2, u3, toWad(1), { from: u2 });
    });

    it("perp settled - success", async () => {
        await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
        await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u3 });
        await perp.perpetual.beginGlobalSettlement(toWad(7000));
        await perp.perpetual.endGlobalSettlement();
        await shouldThrows(tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 }), "wrong perpetual status");
        await shouldThrows(tokenizer.redeemAndWithdraw(toWad(1), toWad('13999.9999999999999999'), { from: u2 }), "wrong perpetual status");
        await tokenizer.settle({ from: u2 });
        await tokenizer.settle({ from: u3 });
        assertApproximate(assert, fromWad(await perp.collateral.balanceOf(u2)), 7000 * 10 - 7000 * 1 /* short pos is not settled yet */)
        assertApproximate(assert, fromWad(await perp.collateral.balanceOf(u3)), 7000 * 10 - 7000 * 1 /* short pos is not settled yet */)
        assert.equal(fromWad(await perp.perpetual.marginBalance.call(tokenizer.address)), 0);
    });

    it("perp settled, transfer token - success", async () => {
        await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
        await perp.perpetual.beginGlobalSettlement(toWad(7000));
        await tokenizer.transfer(u3, toWad(0.5), { from: u2 });
        await perp.perpetual.endGlobalSettlement();
        await tokenizer.transfer(u3, toWad(0.5), { from: u2 });
        await shouldThrows(tokenizer.settle({ from: u2 }), "invalid tpAmount"); // all shares were transferred
        await tokenizer.settle({ from: u3 });
        assertApproximate(assert, fromWad(await perp.collateral.balanceOf(u2)), 7000 * 10 - 7000 * 2 /* short pos is not settled yet */)
        assertApproximate(assert, fromWad(await perp.collateral.balanceOf(u3)), 7000 * 10 + 7000 * 1 /* short pos is not settled yet */)
        assert.equal(fromWad(await perp.perpetual.marginBalance.call(tokenizer.address)), 0);
    });

    it("position (> 0) inconsistent - can transfer and redeem, the others failed", async () => {
        await perp.amm.setGovernanceParameter(toBytes32("poolFeeRate"), 0);
        await perp.amm.setGovernanceParameter(toBytes32("poolDevFeeRate"), 0);
        await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
        
        // make tp unsafe
        await perp.amm.buy(toWad(0.1), infinity, infinity, { from: u1 });
        await perp.amm.setBlockTimestamp((await perp.amm.mockBlockTimestamp()).toNumber() + 86400 * 73);
        assert.ok(!(await perp.perpetual.isSafe.call(tokenizer.address)));
        assert.ok(!(await perp.perpetual.isBankrupt.call(tokenizer.address)));
        await perp.perpetual.liquidate(tokenizer.address, toWad(7000), { from: u1 })
        assert.ok(await perp.perpetual.isSafe.call(tokenizer.address));
        const poolPosition = new BigNumber(await perp.positionSize(tokenizer.address));
        assert.ok(poolPosition.gt(0), poolPosition.toFixed());

        // await printFunding(perp.amm, perp.perpetual);
        // await inspect(u2, perp.perpetual, perp.proxy, perp.amm);
        // await inspect(tokenizer.address, perp.perpetual, perp.proxy, perp.amm);

        await shouldThrows(tokenizer.mint(toWad(1), { from: u2 }), "consistent");
        await shouldThrows(tokenizer.settle({ from: u2 }), "wrong perpetual status");
        await tokenizer.transfer(u3, toWad(1), { from: u2 });
        await tokenizer.transfer(u2, toWad(1), { from: u3 });
        await tokenizer.approve(u2, infinity, { from: u2 });
        await tokenizer.transferFrom(u2, u3, toWad(1), { from: u2 });
        await tokenizer.approve(u3, infinity, { from: u3 });
        await tokenizer.transferFrom(u3, u2, toWad(1), { from: u3 });

        // redeem is ok
        // at this moment, 1 TP = $703.5, markPrice = 7035
        // await inspect(u2, perp.perpetual, perp.proxy, perp.amm);
        // await inspect(tokenizer.address, perp.perpetual, perp.proxy, perp.amm);
        assertApproximate(assert, fromWad(await perp.cashBalanceOf(u2)), 7000, '0.1');
        assertApproximate(assert, fromWad(await perp.positionSize(u2)), 1, '0.1');
        assertApproximate(assert, fromWad(await perp.perpetual.marginBalance.call(u2)), 7000 + 6863.49, '0.1');
        assertApproximate(assert, fromWad(await perp.cashBalanceOf(tokenizer.address)), 790.63, '0.1');
        assertApproximate(assert, fromWad(await perp.positionSize(tokenizer.address)), 0.104, '0.1');
        assertApproximate(assert, fromWad(await perp.perpetual.marginBalance.call(tokenizer.address)), 73.505, '0.1');
        
        await tokenizer.redeem(toWad(1), { from: u2 });

        // await inspect(u2, perp.perpetual, perp.proxy, perp.amm);
        // await inspect(tokenizer.address, perp.perpetual, perp.proxy, perp.amm);
        assertApproximate(assert, fromWad(await perp.cashBalanceOf(u2)), 7000 + 790.63, '0.1');
        assertApproximate(assert, fromWad(await perp.positionSize(u2)), 1 - 0.104, '0.1');
        assertApproximate(assert, fromWad(await perp.perpetual.marginBalance.call(u2)), 7000 + 6863.49 + 73.505, '0.1');
        assertApproximate(assert, fromWad(await perp.cashBalanceOf(tokenizer.address)), 0, '0.1');
        assertApproximate(assert, fromWad(await perp.positionSize(tokenizer.address)), 0, '0.1');
        assertApproximate(assert, fromWad(await perp.perpetual.marginBalance.call(tokenizer.address)), 0, '0.1');
    });

    it("position (= 0) inconsistent - can transfer, the others failed", async () => {
        await perp.amm.setGovernanceParameter(toBytes32("poolFeeRate"), 0);
        await perp.amm.setGovernanceParameter(toBytes32("poolDevFeeRate"), 0);
        await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
        
        // make tp unsafe
        await perp.amm.buy(toWad(0.1), infinity, infinity, { from: u1 });
        await perp.amm.setBlockTimestamp((await perp.amm.mockBlockTimestamp()).toNumber() + 86400 * 75);
        assert.ok(!(await perp.perpetual.isSafe.call(tokenizer.address)));
        assert.ok(await perp.perpetual.isBankrupt.call(tokenizer.address));
        await perp.perpetual.liquidate(tokenizer.address, toWad(7000), { from: u1 })
        assert.ok(await perp.perpetual.isSafe.call(tokenizer.address));
        assert.equal(fromWad(await perp.positionSize(tokenizer.address)), 0);

        // await printFunding(perp.amm, perp.perpetual);
        // await inspect(u2, perp.perpetual, perp.proxy, perp.amm);
        // await inspect(tokenizer.address, perp.perpetual, perp.proxy, perp.amm);
        
        await shouldThrows(tokenizer.mint(toWad(1), { from: u2 }), "consistent");
        await shouldThrows(tokenizer.redeem(toWad(1), { from: u2 }), "zero margin balance");
        await shouldThrows(tokenizer.settle({ from: u2 }), "wrong perpetual status");
        await tokenizer.transfer(u3, toWad(1), { from: u2 });
        await tokenizer.transfer(u2, toWad(1), { from: u3 });
        await tokenizer.approve(u2, infinity, { from: u2 });
        await tokenizer.transferFrom(u2, u3, toWad(1), { from: u2 });
        await tokenizer.approve(u3, infinity, { from: u3 });
        await tokenizer.transferFrom(u3, u2, toWad(1), { from: u3 });
    });

    context('tp pause', function () {
        beforeEach(async function () {
            await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
            await tokenizer.pause();
        });

        it('paused', async function () {
            await shouldThrows(tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 }), ": paused");
            await shouldThrows(tokenizer.redeem(toWad(1), { from: u2 }), ": paused");
            await shouldThrows(tokenizer.transfer(u3, toWad(1), { from: u2 }), ": paused");
            await tokenizer.approve(u2, infinity, { from: u2 });
            await shouldThrows(tokenizer.transferFrom(u2, u3, toWad(1), { from: u2 }), ": paused");
            await shouldThrows(tokenizer.settle({ from: u2 }), ": paused");
        });

        it('unpause', async function () {
            await tokenizer.unpause();
            await tokenizer.approve(u2, infinity, { from: u2 });
            await tokenizer.transfer(u3, toWad(1), { from: u2 });
            await tokenizer.approve(u3, infinity, { from: u3 });
            await tokenizer.transferFrom(u3, u2, toWad(1), { from: u3 });
            await shouldThrows(tokenizer.settle({ from: u2 }), "wrong perpetual status");
            await tokenizer.redeem(toWad(1), { from: u2 });
            await tokenizer.mint(toWad(1), { from: u2 });
        });
    });

    it("tp shutdown", async () => {
        await tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 });
        await tokenizer.shutdown();
        await shouldThrows(tokenizer.depositAndMint(toWad(7000 * 2), toWad(1), { from: u2 }), ": stopped");
        await tokenizer.approve(u2, infinity, { from: u2 });
        await tokenizer.transferFrom(u2, u3, toWad(1), { from: u2 });
        await tokenizer.transfer(u2, toWad(1), { from: u3 });
        await tokenizer.redeem(toWad(1), { from: u2 });
        await shouldThrows(tokenizer.settle({ from: u2 }), "wrong perpetual status");
        assertApproximate(assert, fromWad(await perp.perpetual.marginBalance.call(tokenizer.address)), 0);
    });
});
