// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

library LibTypes {
    enum Status {NORMAL, EMERGENCY, SETTLED}
}

interface IPerpetual {
    function markPrice() external returns (uint256);
    function status() external view returns (LibTypes.Status);
    function isSafeWithPrice(address trader, uint256 currentMarkPrice) external returns (bool);
    function isIMSafeWithPrice(address trader, uint256 currentMarkPrice) external returns (bool);
    function collateral() external returns (address);
    function depositFor(address trader, uint256 rawAmount) external payable;
    function withdrawFor(address payable trader, uint256 rawAmount) external;
    function tradePosition(
        address taker,
        address maker,
        LibTypes.Side side,
        uint256 price,
        uint256 amount
    ) external returns (uint256, uint256);
    function settle() external;
}

contract Storage {
    // ERC20
    string internal _name;
    string internal _symbol;
    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;
    mapping(address => mapping (address => uint256)) internal _allowances;

    // Perpetual context
    address internal _perpetual;

    // Scaler helps to convert decimals
    uint256 internal _collateralScaler;
}