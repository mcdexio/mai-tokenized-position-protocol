// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../Stoppable.sol";

contract TestStoppable is
    Stoppable
{
    bool public drasticMeasureTaken;
    uint256 public count;

    constructor () public {
        drasticMeasureTaken = false;
        count = 0;
    }

    function normalProcess() external whenNotStopped {
        count++;
    }

    function drasticMeasure() external whenStopped {
        drasticMeasureTaken = true;
    }

    function stop() external {
        _stop();
    }
}
