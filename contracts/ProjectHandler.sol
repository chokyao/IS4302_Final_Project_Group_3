// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import './VoteToken.sol';

contract ProjectHandler {

    VoteToken voteTokenContract;
    address public admin;

    string[] projList;
    mapping(uint256 => address) projOwnerList; // projId -> owner, tracks addresses of the owner of projects in this round
    
    event VoterRegistered(address voter);

    constructor(VoteToken tokenContractAddress) {
        voteTokenContract = tokenContractAddress;
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    function getNumOfProj() public view returns(uint256) {
        return projList.length;
    }

    function resetProjs() public onlyAdmin() {
        delete projList;
        for (uint256 i = 0; i < 3; i++) {
            delete projOwnerList[i];
        }
    }

    // register project for voting, returns projId
    function addProj(string memory title) public onlyAdmin() returns(uint256) { 
        require(voteTokenContract.checkToken(tx.origin) >= 100, "User does not have enough tokens for deposit");
        for (uint256 i = 0; i < projList.length; i++) {
            require(tx.origin != projOwnerList[i + 1], "User cannot register more than 1 project in the same round");
        }

        projList.push(title);
        uint256 projId = projList.length;
        voteTokenContract.transferToken(msg.sender, 100); 
        projOwnerList[projId] = tx.origin;
        return projId;
    }

    function getProjOwner(uint256 projId) public view returns(address) {
        return projOwnerList[projId];
    }


    //getter functions for testing
    function getProjTitle(uint256 id) public view returns(string memory) {
        return projList[id - 1];
    }

}