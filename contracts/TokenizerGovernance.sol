// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "./TokenizerStorage.sol";

contract TokenizerGovernance is
    TokenizerStorage
{
    event UpdateMintFeeRate(uint256 value);
    event UpdateDevAddress(address value);

    // Check if sender is owner.
    modifier onlyAdministrator() {
        IGlobalConfig globalConfig = IGlobalConfig(_perpetual.globalConfig());
        require(globalConfig.owner() == msg.sender, "not owner");
        _;
    }

    /**
     * @dev Get perpetual
     */
    function getPerpetualAddress() public view returns (address) { return address(_perpetual); }

    /**
     * @dev Get mintFeeRate
     */
    function getMintFeeRate() public view returns (uint256) { return _mintFeeRate; }

    /**
     * @dev Get dev
     */
    function getDevAddress() public view returns (address) { return _devAddress; }

    // A batch reader in order to reduce calling consumption
    function dumpGov() external view virtual returns (
        address, address, uint256, uint256, bool, bool
    ) {
        return (
            getPerpetualAddress(),
            getDevAddress(),
            getMintFeeRate(),
            cap(),
            paused(),
            stopped()
        );
    }

    /**
     * @dev Set mintFeeRate
     */
    function setMintFeeRate(uint256 value) public virtual onlyAdministrator {
        _mintFeeRate = value;
        emit UpdateMintFeeRate(value);
    }

    /**
     * @dev Set dev
     */
    function setDevAddress(address value) public virtual onlyAdministrator {
        _devAddress = value;
        emit UpdateDevAddress(value);
    }

    /**
     * @dev Pause the Tokenizer. Call by admin or pauser.
     */
    function pause() public virtual {
        IGlobalConfig globalConfig = IGlobalConfig(_perpetual.globalConfig());
        require(
            globalConfig.pauseControllers(msg.sender) || globalConfig.owner() == msg.sender,
            "unauthorized caller"
        );
        _pause();
    }

    /**
     * @dev Unpause the Tokenizer. Call by admin or pauser.
     */
    function unpause() public virtual {
        IGlobalConfig globalConfig = IGlobalConfig(_perpetual.globalConfig());
        require(
            globalConfig.pauseControllers(msg.sender) || globalConfig.owner() == msg.sender,
            "unauthorized caller"
        );
        _unpause();
    }

    /**
     * @dev Shutdown the Tokenizer. Only call by admin.
     */
    function shutdown() public virtual onlyAdministrator {
        _stop();
    }

    /**
     * @dev Sets the value of the `cap`. This value is immutable, it can only be
     * set once during construction.
     */
    function setCap(uint256 cap) public virtual onlyAdministrator {
        _setCap(cap);
    }
}
