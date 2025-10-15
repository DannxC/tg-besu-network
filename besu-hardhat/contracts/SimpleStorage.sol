// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleStorage {
    uint256 public storedData;

    event stored(address _to, uint256 _amount);

    constructor(uint256 initVal) {
        emit stored(msg.sender, initVal);
        storedData = initVal;
    }

    function set(uint256 x) public {
        emit stored(msg.sender, x);
        storedData = x;
    }

    function get() public view returns (uint256 retVal) {
        return storedData;
    }
}
