// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {LibPerpetualMathUnsigned} from "../LibPerpetualMath.sol";

contract TestPerpetualMathUnsigned {
    using LibPerpetualMathUnsigned for uint256;

    function WAD() public pure returns (uint256) {
        return LibPerpetualMathUnsigned.WAD();
    }

    function wfrac(uint256 a, uint256 b, uint256 c) public pure returns (uint256) {
        return a.wfrac(b, c);
    }

    function wmul(uint256 a, uint256 b) public pure returns (uint256) {
        return a.wmul(b);
    }

    function wdiv(uint256 a, uint256 b) public pure returns (uint256) {
        return a.wdiv(b);
    }
}
