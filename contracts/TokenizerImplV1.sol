// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2; // to enable structure-type parameter

import "@openzeppelin/contracts/utils/SafeCast.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
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
    using SafeCast for int256;
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
        require(collateralDecimals <= MAX_DECIMALS, "decimals out of range");
        _collateralScaler = 10**(MAX_DECIMALS - collateralDecimals);
    }

    /**
     * @dev Mint some Tokenized Positions (tp) and get short positions in the margin account.
     *
     * @param tpAmount Mint amount. The unit is the same as position.
     */
    function mint(uint256 tpAmount)
        public
        virtual
        override
        positionMustBeConsistent
    {
        require(_perpetual.status() == LibTypes.Status.NORMAL, "wrong perpetual status");
        require(_perpetual.isValidTradingLotSize(tpAmount), "tpAmount must be divisible by tradingLotSize");
        address takerAddress = msg.sender;
        address makerAddress = address(this);

        // price and collateral required
        uint256 collateral;
        uint256 price;
        if (totalSupply() > 0) {
            uint256 marginBalance = _perpetual.marginBalance(makerAddress).toUint256();
            require(marginBalance > 0, "no margin balance");
            // collateral = marginBalance * tpAmount / totalSupply
            collateral = marginBalance.wfrac(tpAmount, totalSupply()) + 1;
            price = marginBalance.wdiv(totalSupply());
        } else {
            uint256 markPrice = _perpetual.markPrice();
            require(markPrice > 0, "zero markPrice");
            // collateral = markPrice * tpAmount
            collateral = markPrice.wmul(tpAmount) + 1;
            price = markPrice;
        }
        _perpetual.transferCashBalance(takerAddress, makerAddress, collateral);

        // trade
        require(price > 0, "zero price");
        (uint256 takerOpened, ) = _perpetual.tradePosition(
            takerAddress,
            makerAddress,
            LibTypes.Side.SHORT, // taker side
            price,
            tpAmount
        );

        // is safe
        if (takerOpened > 0) {
            require(_perpetual.isIMSafe(takerAddress), "taker IM unsafe");
        } else {
            require(_perpetual.isSafe(takerAddress), "taker unsafe");
        }
        require(_perpetual.isSafe(makerAddress), "broker unsafe");

        // mint
        ERC20Impl._mint(takerAddress, tpAmount);
        emit Mint(takerAddress, tpAmount);
    }

    /**
     * @dev Burn some Tokenized Positions (tp) and get long positions (also close your current short positions)
     *      in the margin account.
     *
     * @param tpAmount Burn amount. The unit is the same as position.
     */
    function redeem(uint256 tpAmount)
        public
        virtual
        override
        positionMustBeConsistent
    {
        require(_perpetual.status() == LibTypes.Status.NORMAL, "wrong perpetual status");
        require(_perpetual.isValidTradingLotSize(tpAmount), "tpAmount must be divisible by tradingLotSize");
        address takerAddress = msg.sender;
        address makerAddress = address(this);

        // price and collateral returned
        uint256 marginBalance = _perpetual.marginBalance(makerAddress).toUint256();
        require(marginBalance > 0, "no margin balance");
        // collateral = marginBalance * tpAmount / totalSupply
        require(totalSupply() > 0, "zero supply");
        uint256 collateral = marginBalance.wfrac(tpAmount, totalSupply());
        uint256 price = marginBalance.wdiv(totalSupply());
        
        // trade
        require(price > 0, "zero price");
        (uint256 takerOpened, ) = _perpetual.tradePosition(
            takerAddress,
            makerAddress,
            LibTypes.Side.LONG, // taker side
            price,
            tpAmount
        );
        _perpetual.transferCashBalance(makerAddress, takerAddress, collateral);

        // is safe
        if (takerOpened > 0) {
            require(_perpetual.isIMSafe(takerAddress), "taker IM unsafe");
        } else {
            require(_perpetual.isSafe(takerAddress), "taker unsafe");
        }
        require(_perpetual.isSafe(makerAddress), "broker unsafe");

        // burn
        ERC20Impl._burn(takerAddress, tpAmount);
        emit Burn(takerAddress, tpAmount);
    }

    /**
     * @dev Burn all Tokenized Positions (tp). This function can only be called after the Perpetual
     *      is in SETTLED status.
     */
    function settle()
        public
        virtual
        override
    {
        require(_perpetual.status() == LibTypes.Status.SETTLED, "wrong perpetual status");
        _perpetual.settle(); // do nothing if already settled
        address payable takerAddress = msg.sender;
        address makerAddress = address(this);
        uint256 tpAmount = balanceOf(takerAddress);
        
        // collateral returned
        IERC20 ctk = IERC20(_perpetual.collateral());
        uint256 marginBalance;
        if (address(ctk) != address(0)) {
            // erc20
            marginBalance = ctk.balanceOf(makerAddress);
        } else {
            // eth
            marginBalance = makerAddress.balance;
        }
        require(marginBalance > 0, "no margin balance");
        // collateral = my collateral * tpAmount / totalSupply
        require(totalSupply() > 0, "zero supply");
        uint256 collateral = marginBalance.wfrac(tpAmount, totalSupply());
        uint256 rawCollateral = collateral.div(_collateralScaler);
        if (address(ctk) != address(0)) {
            // erc20
            ctk.safeTransfer(takerAddress, rawCollateral);
        } else {
            // eth
            Address.sendValue(takerAddress, rawCollateral);
        }

        // burn
        ERC20Impl._burn(takerAddress, tpAmount);
        emit Burn(takerAddress, tpAmount);
    }

    /**
     * @dev This is a composite function of perp.deposit + tp.mint.
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
        virtual
        override
    {
        if (depositAmount > 0) {
            _perpetual.depositFor{value: msg.value}(msg.sender, depositAmount);
        }
        if (mintAmount > 0) {
            mint(mintAmount);
        }
    }

    /**
     * @dev This is a composite function of perp.deposit + tp.mint.
     *
     * Composite functions accept amount = 0.
     *
     * @param redeemAmount Redeem amount.
     * @param withdrawAmount The collateral amount. Note: The actual token.decimals should be filled in and not necessarily 18.
     */
    function redeemAndWithdraw(
        uint256 redeemAmount,
        uint256 withdrawAmount
    )
        public
        virtual
        override
    {
        if (redeemAmount > 0) {
            redeem(redeemAmount);
        }
        if (withdrawAmount > 0) {
            _perpetual.withdrawFor(msg.sender, withdrawAmount);
        }
    }

    // It's safe if perpetual.positionSize == tp.totalSupply. Otherwise the Tokenizer is dangerous.
    modifier positionMustBeConsistent() {
        address makerAddress = address(this);
        LibTypes.MarginAccount memory maker = _perpetual.getMarginAccount(makerAddress);
        require (totalSupply() == maker.size, "position must be consistent");

        _;
    }
}
