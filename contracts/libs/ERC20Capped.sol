pragma solidity ^0.6.0;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

/**
 * @dev Almost the same as @openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Capped.sol
 *      except that we can modify the cap.
 */
abstract contract ERC20CappedUpgradeSafe is Initializable, ERC20UpgradeSafe {
    uint256 internal _cap;

    function __ERC20Capped_init_unchained(uint256 newCap) internal initializer {
        require(newCap > 0, "ERC20Capped: cap is 0");
        _cap = newCap;
    }

    /**
     * @dev Returns the cap on the token's total supply.
     */
    function cap() public view returns (uint256) {
        return _cap;
    }

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

    /**
     * @dev Sets the value of the `cap`.
     */
    function _setCap(uint256 newCap) internal virtual {
        require(newCap > 0, "ERC20Capped: cap is 0");
        _cap = newCap;
    }

    uint256[49] private __gap;
}
