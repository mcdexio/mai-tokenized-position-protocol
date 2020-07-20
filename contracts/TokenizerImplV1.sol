// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "@openzeppelin/openzeppelin-upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./LibPerpetualMath.sol";
import "./Storage.sol";
import "./ERC20Impl.sol";
import "./ITokenizer.sol";

contract TokenizerImplV1 is
    Storage,
    ERC20Impl,
    ITokenizer,
    Initializable
{
    using LibPerpetualMathUnsigned for uint256;
    using SafeERC20 for IERC20;

    // Available decimals should be within [0, 18]
    uint256 private constant MAX_DECIMALS = 18;

    event Mint(address indexed minter, uint256 amount);
    event Burn(address indexed minter, uint256 amount);

    function initialize(
        string calldata name,
        string calldata symbol,
        address perpetual,
        uint256 collateralDecimals
    )
        external
        initializer
    {
        _name = name;
        _symbol = symbol;
        _perpetual = IPerpetual(perpetual);

        // This statement will cause a 'InternalCompilerError: Assembly exception for bytecode'
        // scaler = (_decimals == MAX_DECIMALS ? 1 : 10**(MAX_DECIMALS.sub(_decimals))).toInt256();
        // But this will not.
        require(_decimals <= MAX_DECIMALS, "decimals out of range");
        _collateralScaler = 10**(MAX_DECIMALS - collateralDecimals);
    }

    function mint(uint256 amount)
        external
        virtual
        override
    {
        require(_perpetual.status() == LibTypes.Status.NORMAL, "wrong perpetual status");
        address takerAddress = msg.sender;
        address makerAddress = address(self);
        uint256 markPrice = perpetual.markPrice();

        // collateral = markPrice * amount
        uint256 collateral = markPrice.wmul(amount) + 1;
        perpetual.transferCashBalance(takerAddress, makerAddress, collateral);

        // trade
        (uint256 takerOpened, ) = perpetual.tradePosition(
            takerAddress
            makerAddress,
            LibTypes.Side.SHORT, // taker side
            markPrice,
            amount
        );

        // is safe
        if (takerOpened > 0) {
            require(perpetual.isIMSafeWithPrice(takerAddress, markPrice), "taker IM unsafe");
        } else {
            require(perpetual.isSafeWithPrice(takerAddress, markPrice), "taker unsafe");
        }
        require(perpetual.isSafeWithPrice(makerAddress, markPrice), "broker unsafe");

        // mint
        ERC20Impl._mint(takerAddress, amount);
        emit Mint(takerAddress, amount);
    }

    function burn(uint256 amount)
        external
        virtual
        override
    {
        require(_perpetual.status() == LibTypes.Status.NORMAL, "wrong perpetual status");
        address takerAddress = msg.sender;
        address makerAddress = address(self);
        uint256 markPrice = perpetual.markPrice();
        
        // trade
        (uint256 takerOpened, ) = perpetual.tradePosition(
            takerAddress
            makerAddress,
            LibTypes.Side.LONG, // taker side
            markPrice,
            amount
        );

        // collateral = marginBalance * amount / totalSupply
        uint256 marginBalance = perpetual.marginBalance(makerAddress);
        uint256 collateral = marginBalance.wfrac(amount, totalSupply());
        perpetual.transferCashBalance(makerAddress, takerAddress, collateral);

        // is safe
        if (takerOpened > 0) {
            require(perpetual.isIMSafeWithPrice(takerAddress, markPrice), "taker IM unsafe");
        } else {
            require(perpetual.isSafeWithPrice(takerAddress, markPrice), "taker unsafe");
        }
        require(perpetual.isSafeWithPrice(makerAddress, markPrice), "broker unsafe");

        // burn
        ERC20Impl._burn(takerAddress, amount);
        emit Redeem(takerAddress, amount);
    }

    function settle()
        external
        virtual
        override
    {
        require(_perpetual.status() == SETTLED, "wrong perpetual status");
        _perpetual.settle();
        address takerAddress = msg.sender;
        uint256 markPrice = perpetual.markPrice();
        uint256 amount = balanceOf(takerAddress);

        // collateral = my collateral * amount / totalSupply
        uint256 collateral = amount.wfrac(amount, totalSupply());
        uint256 rawCollateral = collateral.div(_collateralScaler);
        IERC20 ctk = IERC20(_perpetual.collateral());
        if (address(collateral) != address(0)) {
            // erc20
            ctk.safeTransfer(takerAddress, rawCollateral);
        } else {
            // eth
            Address.sendValue(takerAddress, rawCollateral);
        }

        // burn
        ERC20Impl._burn(msg.sender, amount);
        emit Redeem(msg.sender, amount);
    }

    /**
     * @notice This is a composite function of perp.deposit + tp.mint.
     *
     * Composite functions accept amount = 0.
     *
     * @param depositAmount The collateral amount. Note: The actual token.decimals should be filled in and not necessarily 18.
     * @param mintAmount Mint amount.
     */
    function depositAndMint(
        uint256 depositAmount,
        uint256 mintAmount
    )
        public
        payable
    {
        if (depositAmount > 0) {
            perpetual.depositFor.value(msg.value)(msg.sender, depositAmount);
        }
        if (mintAmount > 0) {
            mint(mintAmount);
        }
    }

    /**
     * @notice This is a composite function of perp.deposit + tp.mint.
     *
     * Composite functions accept amount = 0.
     *
     * @param burnAmount Burn amount.
     * @param withdrawAmount The collateral amount. Note: The actual token.decimals should be filled in and not necessarily 18.
     */
    function burnAndWithdraw(
        uint256 burnAmount,
        uint256 withdrawAmount
    )
        public
        payable
    {
        if (burnAmount > 0) {
            burn(burnAmount);
        }
        if (withdrawAmount > 0) {
            perpetual.withdrawFor(msg.sender, withdrawAmount);
        }
    }
}
