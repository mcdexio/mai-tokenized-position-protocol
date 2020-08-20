const assert = require('assert');
const BigNumber = require('bignumber.js');
const { shouldThrows, createEVMSnapshot, restoreEVMSnapshot, toBytes32, assertApproximate } = require('./funcs');
const { toWad, fromWad, Side } = require('./constants');
const { inspect, printFunding } = require('./funcs')
const { typicalPerp } = require('./perp.js')
const Tokenizer = artifacts.require('TokenizerImplV1.sol');

contract('inversed', accounts => {
    let tokenizer;
    let perp;
   
    const broker = accounts[9];
    const admin = accounts[0];
    const dev = accounts[1];

    const u1 = accounts[4];
    const u2 = accounts[5];
    const u3 = accounts[6];
    let u1Balance;
    let u2Balance;
    let u3Balance;

    let snapshotId;

    beforeEach(async () => {
        snapshotId = await createEVMSnapshot();

        perp = typicalPerp(accounts, true);
        await perp.deploy();
        await perp.useDefaultGovParameters();
        await perp.usePoolDefaultParameters();
        tokenizer = await Tokenizer.new();
        await perp.globalConfig.addComponent(perp.perpetual.address, tokenizer.address);
        await tokenizer.initialize("ETH -> USD", "eUSD", perp.perpetual.address, 18, dev, toWad('1000000'));

        // index
        await perp.setIndexPrice(1/200);
        const indexPrice = await perp.amm.indexPrice();
       
        // create amm
        await perp.perpetual.deposit(toWad(1/200 * 1 * 3), { from: u1, value: toWad(1/200 * 1 * 3) });
        await perp.amm.createPool(toWad(1), { from: u1 });

        // insurance
        await perp.perpetual.depositToInsuranceFund(toWad(1), { from: u1, value: toWad(1) });

        u1Balance = new BigNumber(await web3.eth.getBalance(u1));
        u2Balance = new BigNumber(await web3.eth.getBalance(u2));
        u3Balance = new BigNumber(await web3.eth.getBalance(u3));
    });

    afterEach(async function () {
        await restoreEVMSnapshot(snapshotId);
    });

    it("the 2nd mint if price keeps", async () => {
        await tokenizer.depositAndMint(toWad(1/200 * 2), toWad(1), { from: u2, value: toWad(1/200 * 2), gasPrice: 1 });

        let u2Balance2 = new BigNumber(await web3.eth.getBalance(u2));
        assertApproximate(assert, fromWad(u2Balance.minus(u2Balance2)), 1/200 * 2);
        const u2Margin1 = new BigNumber(await perp.perpetual.marginBalance.call(u2));
        assert.ok(u2Margin1.lte(toWad(1/200)), u2Margin1.toFixed());
        const tpMargin1 = new BigNumber(await perp.perpetual.marginBalance.call(tokenizer.address));
        assert.ok(tpMargin1.gte(toWad(1/200)), tpMargin1.toFixed());
        assert.equal(fromWad(await tokenizer.balanceOf(u2)), 1);
        assert.equal(fromWad(await tokenizer.balanceOf(tokenizer.address)), 0);
        assert.equal(fromWad(await tokenizer.totalSupply()), 1);
        assert.equal(fromWad(await perp.positionSize(u2)), 1);
        assert.equal(fromWad(await perp.positionSize(tokenizer.address)), 1);
        assert.equal(await perp.positionSide(u2), Side.SHORT);
        assert.equal(await perp.positionSide(tokenizer.address), Side.LONG);

        await tokenizer.depositAndMint(toWad(1/200 * 2), toWad(1), { from: u3, value: toWad(1/200 * 2), gasPrice: 1 });

        let u3Balance2 = new BigNumber(await web3.eth.getBalance(u3));
        assertApproximate(assert, fromWad(u3Balance.minus(u3Balance2)), 1/200 * 2);
        const u3Margin2 = new BigNumber(await perp.perpetual.marginBalance.call(u3));
        assert.ok(u3Margin2.lte(toWad(1/200)), u3Margin2.toFixed());
        const tpMargin2 = new BigNumber(await perp.perpetual.marginBalance.call(tokenizer.address));
        assert.ok(tpMargin2.gte(toWad(1/200 * 2)), tpMargin2.toFixed());
        assert.equal(fromWad(await tokenizer.balanceOf(u3)), 1);
        assert.equal(fromWad(await tokenizer.balanceOf(tokenizer.address)), 0);
        assert.equal(fromWad(await tokenizer.totalSupply()), 2);
        assert.equal(fromWad(await perp.positionSize(u3)), 1);
        assert.equal(fromWad(await perp.positionSize(tokenizer.address)), 2);
        assert.equal(await perp.positionSide(u3), Side.SHORT);
        assert.equal(await perp.positionSide(tokenizer.address), Side.LONG);

        let u2Balance3 = new BigNumber(await web3.eth.getBalance(u2));
        let u3Balance3 = new BigNumber(await web3.eth.getBalance(u3));
        await tokenizer.redeem(toWad(1), { from: u3, gasPrice: 1 });
        await perp.perpetual.withdraw(toWad('0.0099999999999999'), { from: u3, gasPrice: 1 });
        await tokenizer.redeemAndWithdraw(toWad(1), toWad('0.0099999999999999'), { from: u2, gasPrice: 1 });
        let u2Balance4 = new BigNumber(await web3.eth.getBalance(u2));
        let u3Balance4 = new BigNumber(await web3.eth.getBalance(u3));
        assertApproximate(assert, fromWad(u2Balance4.minus(u2Balance3)), '0.0099999999999999');
        assertApproximate(assert, fromWad(u3Balance4.minus(u3Balance3)), '0.0099999999999999');
        assertApproximate(assert, fromWad(await web3.eth.getBalance(perp.perpetual.address)), 1 /* insurance */ + 1/200 * 3);
    });

    it("perp settled - success", async () => {
        await tokenizer.depositAndMint(toWad(1/200 * 2), toWad(1), { from: u2, value: toWad(1/200 * 2) });
        await tokenizer.depositAndMint(toWad(1/200 * 2), toWad(1), { from: u3, value: toWad(1/200 * 2) });
        await perp.perpetual.beginGlobalSettlement(toWad(1/200));
        await perp.perpetual.endGlobalSettlement();
        await shouldThrows(tokenizer.depositAndMint(toWad(1/200 * 2), toWad(1), { from: u2, value: toWad(1/200 * 2) }), "wrong perpetual status");
        await shouldThrows(tokenizer.redeemAndWithdraw(toWad(1), toWad('13999.9999999999999999'), { from: u2 }), "wrong perpetual status");

        let u2Balance2 = new BigNumber(await web3.eth.getBalance(u2));
        let u3Balance2 = new BigNumber(await web3.eth.getBalance(u3));
        await tokenizer.settle({ from: u2, gasPrice: 1 });
        await tokenizer.settle({ from: u3, gasPrice: 1 });
        let u2Balance3 = new BigNumber(await web3.eth.getBalance(u2));
        let u3Balance3 = new BigNumber(await web3.eth.getBalance(u3));
        assertApproximate(assert, fromWad(u3Balance3.minus(u3Balance2)), 1/200 * 1 /* short pos is not settled yet */);
        assertApproximate(assert, fromWad(u2Balance3.minus(u2Balance2)), 1/200 * 1 /* short pos is not settled yet */);
        assertApproximate(assert, fromWad(await web3.eth.getBalance(perp.perpetual.address)), 1 /* insurance */ + 1/200 * 1 * 3 /* amm */ + 1/200 * 2);
        assert.equal(fromWad(await perp.perpetual.marginBalance.call(tokenizer.address)), 0);
    });
});
