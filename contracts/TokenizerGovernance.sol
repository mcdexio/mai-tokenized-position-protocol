// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "./TokenizerStorage.sol";

contract TokenizerGovernance is
    TokenizerStorage
{
    event SetConfigurationEntry(bytes32 key, int256 value);

    // Check if sender is owner.
    modifier onlyAdministrator() {
        IGlobalConfig globalConfig = IGlobalConfig(_perpetual.globalConfig());
        require(globalConfig.owner() == msg.sender, "not owner");
        _;
    }

    /**
     * @dev Get mintFeeRate
     */
    function getMintFeeRate() external view uint256 { return _mintFeeRate; }

    /**
     * @dev Set value of configuration entry.
     * @param key   Name string of entry to set.
     * @param value Value of entry to set.
     */
    function setConfigurationEntry(bytes32 key, int256 value) external onlyAdministrator {
        if (key == "mintFeeRate") {
            _mintFeeRate = uint256(value);
        } else {
            revert("unrecognized key");
        }
        emit SetConfigurationEntry(key, value);
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
}
