// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

// This file is copied from
// https://github.com/mcdexio/mai-protocol-v2/blob/master/contracts/lib/LibMath.sol
// which has already been audit by openzeppelin.
library LibPerpetualMathUnsigned {
    uint256 private constant _WAD = 10**18;

    function WAD() internal pure returns (uint256) {
        return _WAD;
    }

    // 0.000...1 * 0.1 = 0
    function wmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = SafeMath.mul(x, y) / _WAD;
    }

    // 0.000...1 * 0.1 = 0.000...1
    function wmulCeil(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = divCeil(SafeMath.mul(x, y), _WAD);
    }

    // 1 / 3 = 0.333...3
    function wdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = SafeMath.mul(x, _WAD) / y;
    }

    // 1 / 3 = 0.333...4
    function wdivCeil(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = divCeil(SafeMath.mul(x, _WAD), y);
    }

    function wfrac(uint256 x, uint256 y, uint256 z) internal pure returns (uint256 r) {
        r = SafeMath.mul(x, y) / z;
    }

    function wfracCeil(uint256 x, uint256 y, uint256 z) internal pure returns (uint256 r) {
        r = divCeil(SafeMath.mul(x, y), z);
    }

    // 1 / 2 = 1, 2 / 2 = 1, 3 / 2 = 2
    function divCeil(uint256 x, uint256 m) internal pure returns (uint256 r) {
        require(m > 0, "ceil need m > 0");
        r = SafeMath.div(x, m);
        uint256 re = x % m;
        if (re > 0) {
            r = r + 1;
        }
    }
}
