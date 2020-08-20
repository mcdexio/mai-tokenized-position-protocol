// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../ERC20.sol";

contract TestERC20 is ERC20 {
    address private _owner;

    constructor(string memory name, string memory symbol) public {
        _name = name;
        _symbol = symbol;
        _owner = msg.sender;
    }

    
    function mint(address account, uint256 amount) public virtual {
        require(msg.sender == _owner, "not owner");
        _mint(account, amount);
    }
}
