const assert = require('assert');
const BigNumber = require('bignumber.js');
const { increaseEvmBlock, increaseEvmTime, createEVMSnapshot, restoreEVMSnapshot, toBytes32, assertApproximate } = require('./funcs');
const { toWei, fromWei, toWad, fromWad, infinity, Side } = require('./constants');
const { inspect, printFunding } = require('./funcs')

const { typicalPerp } = require('./perp.js')

// const fs = require('fs')
// let TestToken = JSON.parse(fs.readFileSync('./mai-protocol-v2/build/contracts/TestToken.json', 'utf-8'));
// const TestToken = artifacts.require('test/TestToken.sol');
// const PriceFeeder = artifacts.require('test/TestPriceFeeder.sol');
// const GlobalConfig = artifacts.require('perpetual/GlobalConfig.sol');
// const Perpetual = artifacts.require('test/TestPerpetual.sol');
// const AMM = artifacts.require('test/TestAMM.sol');
// const Proxy = artifacts.require('proxy/Proxy.sol');
// const ShareToken = artifacts.require('token/ShareToken.sol');

const Tokenizer = artifacts.require('TokenizerImplV1.sol');

const gasLimit = 8000000;

contract('amm-eth', accounts => {
    let tokenizer;
    let perp;
   
    const broker = accounts[9];
    const admin = accounts[0];
    const dev = accounts[1];

    const u1 = accounts[4];
    const u2 = accounts[5];
    const u3 = accounts[6];

    let snapshotId;

    const deploy = async () => {
        tokenizer = await Tokenizer.new();
        console.log(tokenizer.address, "tokenizer.address");

        perp = typicalPerp(accounts, false);
        await perp.deploy();
    };


    beforeEach(async () => {
        snapshotId = await createEVMSnapshot();
            
        await deploy();
        await perp.useDefaultGovParameters();
        await perp.usePoolDefaultParameters();
    });

    afterEach(async function () {
        await restoreEVMSnapshot(snapshotId);
    });

    describe("composite helper", async () => {
        beforeEach(async () => {
            // index
            await perp.setIndexPrice(7000);
            const indexPrice = await perp.amm.indexPrice();
            assert.equal(fromWad(indexPrice.price), 7000);
            
            // approve
            await perp.collateral.transfer(u1, toWad(7000 * 10 * 2.1));
            await perp.collateral.transfer(u2, toWad(7000 * 3));
            await perp.collateral.transfer(u3, toWad(7000 * 3));
            await perp.collateral.transfer(dev, toWad(7000 * 3));
            await perp.collateral.approve(perp.perpetual.address, infinity, { from: u1 });
            await perp.collateral.approve(perp.perpetual.address, infinity, { from: u2 });
            await perp.collateral.approve(perp.perpetual.address, infinity, { from: u3 });
            await perp.collateral.approve(perp.perpetual.address, infinity, { from: dev });
            
            // create amm
            await perp.perpetual.deposit(toWad(7000 * 10 * 2.1), { from: u1 });
            await perp.amm.createPool(toWad(10), { from: u1 });
        });

        it("depositAndBuy - success", async () => {
            await perp.amm.depositAndBuy(toWad(7000 * 1), toWad(1), toWad('10000'), infinity, { from: u2 });

            assert.equal(fromWad(await perp.amm.positionSize()), 9);
            // assert.equal(fromWad(await positionSize(proxy.address)), 9);
            // assert.equal(fromWad(await positionSize(u1)), 10);
            // assert.equal(fromWad(await positionSize(u2)), 1);
            // assert.equal(await positionSide(proxy.address), Side.LONG);
            // assert.equal(await positionSide(u1), Side.SHORT);
            // assert.equal(await positionSide(u2), Side.LONG);

            // assert.equal(fromWad(await cashBalanceOf(u2)), '6883.333333333333333333');
            // assert.equal(fromWad(await share.balanceOf(u2)), 0);
            // assert.equal(fromWad(await positionEntryValue(u2)), '7777.777777777777777778'); // trade price * position
            // assert.equal(fromWad(await perpetual.pnl.call(u2)), '-777.777777777777777779');

            // assert.equal(fromWad(await amm.currentAvailableMargin.call()), '77855.555555555555555555'); // amm.x
            // assert.equal(fromWad(await cashBalanceOf(proxy.address)), '140855.555555555555555555');
            // assert.equal(fromWad(await positionEntryValue(proxy.address)), '63000');
            // assert.equal(fromWad(await amm.currentFairPrice.call()), '8650.617283950617283951');
        });
    });

});
