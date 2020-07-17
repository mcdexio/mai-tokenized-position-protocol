// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

interface ITokenizer {
    function mint(uint256 amount) external virtual;
    function burn(uint256 amount) external virtual;
    function settle() external virtual;
}