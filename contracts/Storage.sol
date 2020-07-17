// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

interface IPerpetual {
    function status() external view returns (LibTypes.Status);
    function settle() external;
}

interface IAMM {

    function depositAndSell(
        uint256 depositAmount,
        uint256 tradeAmount,
        uint256 limitPrice,
        uint256 deadline
    ) external payable;

    function buyAndWithdraw(
        uint256 tradeAmount,
        uint256 limitPrice,
        uint256 deadline,
        uint256 withdrawAmount
    ) external;
}



contract Storage {
    // ERC20
    string internal _name;
    string internal _symbol;
    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;
    mapping(address => mapping (address => uint256)) internal _allowances;

    // perpetual context
    address internal _perpetual;
    address internal _amm;
}