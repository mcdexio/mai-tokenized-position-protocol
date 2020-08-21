// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2; // to enable structure-type parameter

// see https://github.com/mcdexio/mai-protocol-v2/blob/master/contracts/lib/LibTypes.sol
library LibTypes {
    enum Side {FLAT, SHORT, LONG}
    enum Status {NORMAL, EMERGENCY, SETTLED}
    struct MarginAccount {
        LibTypes.Side side;
        uint256 size;
        uint256 entryValue;
        int256 entrySocialLoss;
        int256 entryFundingLoss;
        int256 cashBalance;
    }
    struct PerpGovernanceConfig {
        uint256 initialMarginRate;
        uint256 maintenanceMarginRate;
        uint256 liquidationPenaltyRate;
        uint256 penaltyFundRate;
        int256 takerDevFeeRate;
        int256 makerDevFeeRate;
        uint256 lotSize;
        uint256 tradingLotSize;
    }
}

// see https://github.com/mcdexio/mai-protocol-v2/blob/master/contracts/interface/IPerpetual.sol
interface IPerpetual {
    function collateral() external view returns (address);
    function globalConfig() external view returns (address);
    function getGovernance() external view returns (LibTypes.PerpGovernanceConfig memory);
    function getMarginAccount(address trader) external view returns (LibTypes.MarginAccount memory);
    function markPrice() external returns (uint256);
    function status() external view returns (LibTypes.Status);
    function marginBalance(address trader) external returns (int256);
    function isSafe(address trader) external returns (bool);
    function isIMSafe(address trader) external returns (bool);
    function isValidTradingLotSize(uint256 amount) external view returns (bool);
    function depositFor(address trader, uint256 rawAmount) external payable;
    function withdrawFor(address payable trader, uint256 rawAmount) external;
    function transferCashBalance(
        address from,
        address to,
        uint256 amount
    ) external;
    function tradePosition(
        address taker,
        address maker,
        LibTypes.Side side,
        uint256 price,
        uint256 amount
    ) external returns (uint256, uint256);
    function settle() external;
}

interface IGlobalConfig {
    function owner() external view returns (address);
    function pauseControllers(address broker) external view returns (bool);
}
