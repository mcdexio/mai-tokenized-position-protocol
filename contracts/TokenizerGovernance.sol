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
     * @dev Get mintFeeRate
     */
    function getMintFeeRate() external view returns (uint256) { return _mintFeeRate; }

    /**
     * @dev Set mintFeeRate
     */
    function setMintFeeRate(uint256 value) external onlyAdministrator {
        _mintFeeRate = value;
        UpdateMintFeeRate(value);
    }

    /**
     * @dev Get mintFeeRate
     */
    function getDevAddress() external view returns (address) { return _devAddress; }

    /**
     * @dev Set mintFeeRate
     */
    function setDevAddress(address value) external onlyAdministrator {
        _devAddress = value;
        emit UpdateDevAddress(value);
    }

    /**
     * @dev Pause the Tokenizer. Call by admin or pauser.
     */
    function pause() external {
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
    function unpause() external {
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
    function shutdown()
        external
        whenNotStopped
        onlyAdministrator
    {
        _stop();
    }

    /**
     * @dev Sets the value of the `cap`. This value is immutable, it can only be
     * set once during construction.
     */
    function setCap(uint256 cap) external onlyAdministrator {
        _setCap(cap);
    }
}
