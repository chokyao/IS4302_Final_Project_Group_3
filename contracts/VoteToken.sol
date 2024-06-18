// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import "./ERC20.sol";
//im adding comment
contract VoteToken {
    ERC20 erc20Contract;
    address owner;

    constructor() {
        ERC20 e = new ERC20();
        erc20Contract = e;
        owner = msg.sender;
    }
    // TESTTEST
    /**
    * @dev Function to give VT to the recipient for a given wei amount
    * @param recipient address of the recipient that wants to buy the VT
    * @param weiAmt uint256 amount indicating the amount of wei that was passed
    * @return a uint256 representing the amount of VT bought by the msg.sender.
    */
    function getToken(address recipient, uint256 weiAmt) public returns(uint256) {
        uint256 amt = weiAmt / 10000000000000000; // Get number of VT using 0.01 eth = 1 VT
        erc20Contract.mint(recipient, amt);
        return amt;
    }

    /**
    * @dev Function to destroy a certain amount of VT from an owner
    * @param tokenOwner address of the account whose VT will be destroyed
    * @param tokenAmount uint256 amount indicating the number of tokens to be destroyed
    * @return a uint256 representing the number of VT belonging to tokenOwner that was destroyed
    */
    function destroyToken(address tokenOwner, uint256 tokenAmount) public returns(uint256) {
        require(checkToken(tokenOwner) >= tokenAmount, "Insufficient VT to burn");
        erc20Contract.burn(tokenOwner, tokenAmount);
        return tokenAmount;
    }

    /**
    * @dev Function to check the amount of VT the ad has
    * @param ad address of the recipient that wants to check their VT
    * @return A uint256 representing the amount of VT owned by the msg.sender.
    */
    function checkToken(address ad) public view returns(uint256) {
        uint256 credit = erc20Contract.balanceOf(ad);
        return credit; 
    }

    /**
    * @dev Function to transfer the credit from tx.origin to the recipient
    * @param recipient address of the recipient that will gain in VT
    * @param amt uint256 aount of VT to transfer
    */
    function transferToken(address recipient, uint256 amt) public {
        require(amt > 0, "Must send at least 1 token");
        erc20Contract.transfer(recipient, amt);
    }

    /**
    * @dev Function to transfer the credit from specified owner to the recipient
    * @param from address of the owner that is giving out token
    * @param recipient address of the recipient that will gain in VT
    * @param amt uint256 aount of VT to transfer
    */
    function transferTokenFrom(address from, address recipient, uint256 amt) public {
        require(amt > 0, "Must send at least 1 token");
        erc20Contract.transferFrom(from, recipient, amt);
    }

}
