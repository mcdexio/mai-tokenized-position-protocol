// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

interface ITokenizer {
    function mint(uint256 amount) external;
    function redeem(uint256 amount) external;
    function settle() external;
    function depositAndMint(uint256 depositAmount, uint256 mintAmount) external payable;
    function redeemAndWithdraw(uint256 redeemAmount, uint256 withdrawAmount) external;
}