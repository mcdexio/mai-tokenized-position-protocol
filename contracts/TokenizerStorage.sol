// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2; // to enable structure-type parameter

import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IPerpetual.sol";
import "./Stoppable.sol";

// Tokenizer storage
contract TokenizerStorage is
    Pausable,
    Stoppable
 {
    // ERC20
    string internal _name;
    string internal _symbol;
    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;
    mapping(address => mapping (address => uint256)) internal _allowances;

    // Perpetual context
    IPerpetual internal _perpetual;

    // Scaler helps to convert decimals
    uint256 internal _collateralScaler;

    // Governance
    uint256 internal _mintFeeRate;
    address internal _devAddress;
    uint256 internal _cap;
}