// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2; // to enable structure-type parameter

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Address.sol";

import "./ITokenizer.sol";
import "./LibPerpetualMath.sol";
import "./TokenizerStorage.sol";
import "./TokenizerGovernance.sol";

contract TokenizerImplV1 is
    Initializable,
    TokenizerStorage,
    TokenizerGovernance,
    ITokenizer
{
    using LibPerpetualMathUnsigned for uint256;
    using SafeCast for int256;
    using SafeERC20 for IERC20;

    // available decimals should be within [0, 18]
    uint256 private constant MAX_DECIMALS = 18;

    event Mint(address indexed minter, uint256 amount);
    event Burn(address indexed minter, uint256 amount);

    function initialize(
        string calldata name,
        string calldata symbol,
        address perpetual,
        uint256 collateralDecimals,
        address devAddress,
        uint256 cap
    )
        external
        initializer
    {
        __Pausable_init();
        __Stoppable_init();
        __ERC20_init(name, symbol);
        __ERC20Capped_init(cap);

        _perpetual = IPerpetual(perpetual);
        // this statement will cause a 'InternalCompilerError: Assembly exception for bytecode'
        // scaler = (_decimals == MAX_DECIMALS ? 1 : 10**(MAX_DECIMALS.sub(_decimals))).toInt256();
        // but this will not.
        require(collateralDecimals <= MAX_DECIMALS, "decimals out of range");
        _collateralScaler = 10**(MAX_DECIMALS - collateralDecimals);
        _devAddress = devAddress;
    }

    /**
     * @dev Mint some Tokenized Positions (tp) and get short positions in the margin account.
     * 
     * Require TP.Normal and perpetual.Normal and TP was not liquidated.
     * @param tpAmount Mint amount ERC20 token. The unit is the same as position.
     */
    function mint(uint256 tpAmount)
        public
        virtual
        override
        whenNotPaused
        whenNotStopped
    {
        address takerAddress = msg.sender;
        address makerAddress = address(this);
        require(_perpetual.status() == LibTypes.Status.NORMAL, "wrong perpetual status");
        
        uint256 markPrice = _perpetual.markPrice();
        require(markPrice > 0, "zero markPrice");
        uint256 tradingPrice = markPrice;
        
        LibTypes.MarginAccount memory maker = _perpetual.getMarginAccount(makerAddress);
        require(maker.size == totalSupply(), "position inconsistent");
        require(_perpetual.isValidTradingLotSize(tpAmount), "tpAmount must be divisible by tradingLotSize");
        uint256 amount = tpAmount;
        
        uint256 collateral;
        if (totalSupply() == 0) {
            // DeltaCash:= MarkPrice * Amount
            collateral = markPrice.wmul(amount);
        } else {
            // DeltaCash:= OldMarginBalance * Amount / PositionSize
            uint256 marginBalance = _perpetual.marginBalance(makerAddress).toUint256();
            require(marginBalance > 0, "zero margin balance");
            collateral = marginBalance.wfrac(amount, maker.size);
        }
        collateral = collateral.add(1); // deposit a little more
        _perpetual.transferCashBalance(takerAddress, makerAddress, collateral);

        // fee
        uint256 fee = collateral.wmul(_mintFeeRate);
        _perpetual.transferCashBalance(takerAddress, _devAddress, fee);

        // trade
        (uint256 takerOpened, ) = _perpetual.tradePosition(
            takerAddress,
            makerAddress,
            LibTypes.Side.SHORT, // taker side
            tradingPrice,
            amount
        );

        // is safe
        if (takerOpened > 0) {
            require(_perpetual.isIMSafe(takerAddress), "taker IM unsafe");
        } else {
            require(_perpetual.isSafe(takerAddress), "taker unsafe");
        }
        require(_perpetual.isSafe(makerAddress), "broker unsafe");

        // mint
        ERC20UpgradeSafe._mint(takerAddress, tpAmount);
        emit Mint(takerAddress, tpAmount);
    }

    /**
     * @dev Burn some Tokenized Positions (tp) and get long positions (also close your current short positions)
     *      in the margin account.
     *
     * Require TP.Normal/Stopped and perpetual.Normal.
     * @param tpAmount Burn amount ERC20 token. The unit is the same as position.
     */
    function redeem(uint256 tpAmount)
        public
        virtual
        override
        whenNotPaused
    {
        address takerAddress = msg.sender;
        address makerAddress = address(this);
        require(_perpetual.status() == LibTypes.Status.NORMAL, "wrong perpetual status");
        
        uint256 markPrice = _perpetual.markPrice();
        require(markPrice > 0, "zero markPrice");
        uint256 tradingPrice = markPrice;

        LibTypes.MarginAccount memory maker = _perpetual.getMarginAccount(makerAddress);
        require(totalSupply() >= tpAmount, "tpAmount too large");
        uint256 amount;
        if (maker.size == totalSupply()) {
            // normal
            require(_perpetual.isValidTradingLotSize(tpAmount), "tpAmount must be divisible by tradingLotSize");
            amount = tpAmount;
        } else {
            // liquidated
            // amount = PositionSize * tpAmount / totalSupply
            amount = maker.size.wfrac(tpAmount, totalSupply());
            uint256 lotSize = _perpetual.getGovernance().lotSize;
            amount = amount.sub(amount.mod(lotSize)); // align to lotSize
        }

        // DeltaCash:= OldMarginBalance * Amount / PositionSize
        uint256 marginBalance = _perpetual.marginBalance(makerAddress).toUint256();
        require(marginBalance > 0, "zero margin balance");
        uint256 collateral = marginBalance.wfrac(amount, maker.size);
        collateral = collateral.sub(1); // withdraw a little less

        // trade
        (uint256 takerOpened, ) = _perpetual.tradePosition(
            takerAddress,
            makerAddress,
            LibTypes.Side.LONG, // taker side
            tradingPrice,
            amount
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
        ERC20UpgradeSafe._burn(takerAddress, tpAmount);
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
        whenNotPaused
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
        // collateral = tp.collateral * tpAmount / totalSupply
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
        ERC20UpgradeSafe._burn(takerAddress, tpAmount);
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

    /**
     * @dev See {ERC20-_beforeTokenTransfer}.
     *
     * Requirements:
     *
     * - mint, burn, transfer can not work when paused
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
