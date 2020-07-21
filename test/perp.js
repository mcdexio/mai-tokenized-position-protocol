const truffleContract = require('truffle-contract');
const { toBytes32 } = require('./funcs');
const { toWad } = require('./constants');

const TestToken = truffleContract(require('@mcdex/mai-protocol-v2-build/build/contracts/TestToken.json'));
const PriceFeeder = truffleContract(require('@mcdex/mai-protocol-v2-build/build/contracts/TestPriceFeeder.json'));
const GlobalConfig = truffleContract(require('@mcdex/mai-protocol-v2-build/build/contracts/GlobalConfig.json'));
const Perpetual = truffleContract(require('@mcdex/mai-protocol-v2-build/build/contracts/TestPerpetual.json'));
const AMM = truffleContract(require('@mcdex/mai-protocol-v2-build/build/contracts/TestAMM.json'));
const Proxy = truffleContract(require('@mcdex/mai-protocol-v2-build/build/contracts/Proxy.json'));
const ShareToken = truffleContract(require('@mcdex/mai-protocol-v2-build/build/contracts/ShareToken.json'));

const typicalPerp = (accounts, isInversedContract) => {
    TestToken.setProvider(web3.currentProvider);
    PriceFeeder.setProvider(web3.currentProvider);
    GlobalConfig.setProvider(web3.currentProvider);
    Perpetual.setProvider(web3.currentProvider);
    AMM.setProvider(web3.currentProvider);
    Proxy.setProvider(web3.currentProvider);
    ShareToken.setProvider(web3.currentProvider);

    const broker = accounts[9];
    const admin = accounts[0];
    const dev = accounts[1];
    
    TestToken.defaults({ from: admin });
    PriceFeeder.defaults({ from: admin });
    GlobalConfig.defaults({ from: admin });
    Perpetual.defaults({ from: admin });
    AMM.defaults({ from: admin });
    Proxy.defaults({ from: admin });
    ShareToken.defaults({ from: admin });

    return {
        priceFeeder: null,
        collateral: null,
        globalConfig: null,
        perpetual: null,
        proxy: null,
        amm: null,
        share: null,

        deploy: async function(decimals = 18) {
            this.priceFeeder = await PriceFeeder.new();
            
            let collateralAddress = "0x0000000000000000000000000000000000000000";
            if (!isInversedContract) {
                this.collateral = await TestToken.new("TT", "TestToken", 18);
                collateralAddress = this.collateral.address;
            }
            this.globalConfig = await GlobalConfig.new();
            this.share = await ShareToken.new("ST", "STK", 18);
            this.perpetual = await Perpetual.new(
                this.globalConfig.address,
                dev,
                collateralAddress,
                decimals
            );
            this.proxy = await Proxy.new(this.perpetual.address);

            this.amm = await AMM.new(this.globalConfig.address, this.proxy.address, this.priceFeeder.address, this.share.address);
            await this.share.addMinter(this.amm.address);
            await this.share.renounceMinter();

            await this.perpetual.setGovernanceAddress(toBytes32("amm"), this.amm.address);
            await this.globalConfig.addComponent(this.perpetual.address, this.proxy.address);
        },

        useDefaultGovParameters: async function() {
            await this.perpetual.setGovernanceParameter(toBytes32("initialMarginRate"), toWad(0.1));
            await this.perpetual.setGovernanceParameter(toBytes32("maintenanceMarginRate"), toWad(0.05));
            await this.perpetual.setGovernanceParameter(toBytes32("liquidationPenaltyRate"), toWad(0.005));
            await this.perpetual.setGovernanceParameter(toBytes32("penaltyFundRate"), toWad(0.005));
            await this.perpetual.setGovernanceParameter(toBytes32("takerDevFeeRate"), toWad(0.01));
            await this.perpetual.setGovernanceParameter(toBytes32("makerDevFeeRate"), toWad(0.01));
            await this.perpetual.setGovernanceParameter(toBytes32("lotSize"), 1);
            await this.perpetual.setGovernanceParameter(toBytes32("tradingLotSize"), 1);
        },

        usePoolDefaultParameters: async function() {
            await this.amm.setGovernanceParameter(toBytes32("poolFeeRate"), toWad(0.01));
            await this.amm.setGovernanceParameter(toBytes32("poolDevFeeRate"), toWad(0.005));
            await this.amm.setGovernanceParameter(toBytes32("updatePremiumPrize"), toWad(1));
            await this.amm.setGovernanceParameter(toBytes32('emaAlpha'), '3327787021630616'); // 2 / (600 + 1)
            await this.amm.setGovernanceParameter(toBytes32('markPremiumLimit'), toWad(0.005));
            await this.amm.setGovernanceParameter(toBytes32('fundingDampener'), toWad(0.0005));
        },

        setIndexPrice: async function(price) {
            await this.priceFeeder.setPrice(toWad(price));

            // priceFeeder will modify index.timestamp, amm.timestamp should >= index.timestamp
            const index = await this.amm.indexPrice();
            await this.amm.setBlockTimestamp(index.timestamp);
        },

        positionSize: async function(user) {
            const positionAccount = await perpetual.getMarginAccount(user);
            return positionAccount.size;
        },

        positionSide: async function(user) {
            const positionAccount = await perpetual.getMarginAccount(user);
            return positionAccount.side;
        },

        positionEntryValue: async function(user) {
            const positionAccount = await perpetual.getMarginAccount(user);
            return positionAccount.entryValue;
        },
        
        cashBalanceOf: async function(user) {
            const cashAccount = await perpetual.getMarginAccount(user);
            return cashAccount.cashBalance;
        },
    };
};
    
module.exports = {
    TestToken,
    PriceFeeder,
    GlobalConfig,
    Perpetual,
    AMM,
    Proxy,
    ShareToken,
    typicalPerp
};
