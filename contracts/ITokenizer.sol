// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

interface ITokenizer {
    function mint(uint256 amount) external;
    function burn(uint256 amount) external;
    function settle() external;
    function depositAndMint(uint256 depositAmount, uint256 mintAmount) external payable;
    function burnAndWithdraw(uint256 burnAmount, uint256 withdrawAmount) external;
}