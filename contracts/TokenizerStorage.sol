// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2; // to enable structure-type parameter

import "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";

import "./libs/IPerpetual.sol";
import "./libs/Stoppable.sol";
import "./libs/ERC20Capped.sol";

// Tokenizer storage
contract TokenizerStorage is
    PausableUpgradeSafe,
    Stoppable,
    ERC20CappedUpgradeSafe
 {
    // Perpetual context
    IPerpetual internal _perpetual;

    // Scaler helps to convert decimals
    uint256 internal _collateralScaler;

    // Governance
    uint256 internal _mintFeeRate;
    address internal _devAddress;

    uint256[46] private __gap;
}
