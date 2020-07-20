// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "@openzeppelin/contracts/math/SafeMath.sol";

// This file is copied from
// https://github.com/mcdexio/mai-protocol-v2/blob/master/contracts/lib/LibMath.sol
// which has already been audit by openzeppelin.
library LibPerpetualMathUnsigned {
    uint256 private constant _WAD = 10**18;

    function WAD() internal pure returns (uint256) {
        return _WAD;
    }

    function wmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = SafeMath.add(SafeMath.mul(x, y), _WAD / 2) / _WAD;
    }

    function wdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = SafeMath.add(SafeMath.mul(x, _WAD), y / 2) / y;
    }

    function wfrac(uint256 x, uint256 y, uint256 z) internal pure returns (uint256 r) {
        r = SafeMath.mul(x, y) / z;
    }
}
