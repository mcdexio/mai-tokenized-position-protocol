// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

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

    function mint(uint256 amount)
        public
        virtual
        override
    {
        require(_perpetual.status() == LibTypes.Status.NORMAL, "wrong perpetual status");
        address takerAddress = msg.sender;
        address makerAddress = address(this);

        // price and collateral required
        uint256 collateral;
        uint256 price;
        if (totalSupply() > 0) {
            uint256 marginBalance = _perpetual.marginBalance(makerAddress).toUint256();
            require(marginBalance > 0, "no margin balance");
            // collateral = marginBalance * amount / totalSupply
            collateral = marginBalance.wfrac(amount, totalSupply()) + 1;
            price = marginBalance.wdiv(totalSupply());
        } else {
            uint256 markPrice = _perpetual.markPrice();
            require(markPrice > 0, "zero markPrice");
            // collateral = markPrice * amount
            collateral = markPrice.wmul(amount) + 1;
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
        ERC20Impl._mint(takerAddress, amount);
        emit Mint(takerAddress, amount);
    }

    function burn(uint256 amount)
        public
        virtual
        override
    {
        require(_perpetual.status() == LibTypes.Status.NORMAL, "wrong perpetual status");
        address takerAddress = msg.sender;
        address makerAddress = address(this);

        // price and collateral returned
        uint256 marginBalance = _perpetual.marginBalance(makerAddress).toUint256();
        require(marginBalance > 0, "no margin balance");
        // collateral = marginBalance * amount / totalSupply
        require(totalSupply() > 0, "zero supply");
        uint256 collateral = marginBalance.wfrac(amount, totalSupply());
        uint256 price = marginBalance.wdiv(totalSupply());
        
        // trade
        require(price > 0, "zero price");
        (uint256 takerOpened, ) = _perpetual.tradePosition(
            takerAddress,
            makerAddress,
            LibTypes.Side.LONG, // taker side
            price,
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
        ERC20Impl._burn(takerAddress, amount);
        emit Burn(takerAddress, amount);
    }

    function settle()
        public
        virtual
        override
    {
        require(_perpetual.status() == LibTypes.Status.SETTLED, "wrong perpetual status");
        _perpetual.settle();
        address payable takerAddress = msg.sender;
        address makerAddress = address(this);
        uint256 amount = balanceOf(takerAddress);
        
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
        // collateral = my collateral * amount / totalSupply
        require(totalSupply() > 0, "zero supply");
        uint256 collateral = marginBalance.wfrac(amount, totalSupply());
        uint256 rawCollateral = collateral.div(_collateralScaler);
        if (address(ctk) != address(0)) {
            // erc20
            ctk.safeTransfer(takerAddress, rawCollateral);
        } else {
            // eth
            Address.sendValue(takerAddress, rawCollateral);
        }

        // burn
        ERC20Impl._burn(takerAddress, amount);
        emit Burn(takerAddress, amount);
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
        virtual
        override
    {
        if (burnAmount > 0) {
            burn(burnAmount);
        }
        if (withdrawAmount > 0) {
            _perpetual.withdrawFor(msg.sender, withdrawAmount);
        }
    }
}
