// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../external/openzeppelin-upgrades/contracts/Initializable.sol";

import "./storage.sol";
import "./ERC20Impl.sol";
import "./ITokenizer.sol";

contract TokenizerImplV1 is
    Storage,
    ERC20Impl,
    ITokenizer,
    Initializable
{
    using SafeMath for uint256;

    event Mint(address indexed minter, uint256 amount);
    event Burn(address indexed minter, uint256 amount);

    function initialize(
        string calldata name,
        string calldata symbol,
        address perpetual,
        address amm
    )
        external
        initializer
    {
        _name = name;
        _symbol = symbol;
        // do something
        _perpetual = IPerpetual(perpetual);
        _amm = IAMM(amm);
    }

    function mint(uint256 amount)
        external
        virtual
        override
    {
        require(_perpetual.status() == NORMAL, "...");
        // get collateral from user.
        xxxx
        _amm.depositAndSell()
        ERC20Impl._mint(msg.sender, amount);
        emit Mint(msg.sender, amount);
    }

    function burn(uint256 amount)
        external
        virtual
        override
    {
        ERC20Impl._burn(msg.sender, amount);
        if (_perpetual.status() == NORMAL) {
            _amm.buyAndWithdraw();
        } else {
            _perpetual.withdraw();
        }
        // send collateral to user
        xxxx
        emit Redeem(msg.sender, amount);
    }

    function settle()
        external
        virtual
        override
    {
        require(_perpetual.status() == SETTLED, "...");
        _perpetual.settle();
    }
}