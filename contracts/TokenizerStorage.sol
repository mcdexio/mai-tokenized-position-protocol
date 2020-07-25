// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2; // to enable structure-type parameter

import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IPerpetual.sol";
import "./ERC20Storage.sol";
import "./Stoppable.sol";

// Tokenizer storage
contract TokenizerStorage is
    ERC20Storage,
    Pausable,
    Stoppable
 {
    // Perpetual context
    IPerpetual internal _perpetual;

    // Scaler helps to convert decimals
    uint256 internal _collateralScaler;

    // Governance
    uint256 internal _mintFeeRate;
}