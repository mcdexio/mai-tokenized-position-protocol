// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "./ERC20.sol";
import "./TokenizerStorage.sol";

/**
 * @dev Extension of {ERC20} that adds a cap to the supply of tokens.
 */
contract ERC20Capped is TokenizerStorage, ERC20 {
    /**
     * @dev See {ERC20-_beforeTokenTransfer}.
     *
     * Requirements:
     *
     * - minted tokens must not cause the total supply to go over the cap.
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        if (from == address(0)) { // When minting tokens
            require(totalSupply().add(amount) <= _cap, "ERC20Capped: cap exceeded");
        }
    }
}
