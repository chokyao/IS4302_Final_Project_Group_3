// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import './VoteToken.sol';
import './ProjectHandler.sol';

contract VotingHandler {

    enum Statuses {
        Voting,
        Standby
    }

    VoteToken voteTokenContract;
    ProjectHandler projectContract;

    Statuses public status; // whether voting is currently underway
    uint256 startTime; // starting time of a voting round
    uint256 totalVTs; // total amount of VTs in voting pool
    uint256 winner; // project ID of winner of current voting round

    address[] voterList; // list of addresses that voted in this round
    uint256[] tieProjs; // tracks the projects that are tied
    mapping(uint256 => uint256) projTokenWeights; // projId -> tokenAmt, tracks how many votes each project has(num of tokens)
    mapping(address => uint256) voterTokenWeights; // voter -> tokenAmt, tracks how many votes each voter gave(num of tokens)
    mapping(address => uint256) votingChoice; // voter -> projId, tracks which project each user voted for
    mapping(uint256 => uint256) numOfVoters; // projId -> numOfVoters, tracks the number of voters for each project

    constructor(VoteToken _voteTokenContract) {
        voteTokenContract = _voteTokenContract;
        projectContract = new ProjectHandler(_voteTokenContract);
        status = Statuses.Standby;
        totalVTs = 0;
        winner = 0;
    }

    event VotingStarted(uint256 timestamp); // event where a voting round has started
    event GetVT(address to, uint256 amount); // event where an address obtains VT with Eth
    event ProjRegistered(address projOwner, uint256 projId); // event where a user has registered a proj for voting
    event Voted(uint256 projId); // event where someone voted for projId
    event VoteWon(uint256 projId); // event where projId won the voting
    event VoteVoided(); // event of voiding whole round of the voting
    event VoteDrawn(uint256 projId1, uint256 projId2); // event of a tie between the top 2 projects
    event VotingEnded(); // event where a voting round has ended
    event ExchangeVT(address exchanger, uint256 tokenAmt, uint256 weiAmt); // event where user exchanged VT for eth
    event DepositRefunded(address projOwner); // event where owner of project receives deposit refund

    modifier checkTime() {
        if (status == Statuses.Voting && block.timestamp >= startTime + 1 days) {
            endVoting();
        }
        _;
    }

    // exchange eth for VT
    function getVT() public payable { 
        require(msg.value >= 0.01 ether, "At least 0.01ETH needed to get VT");
        uint256 val = voteTokenContract.getToken(msg.sender, msg.value);
        
        emit GetVT(msg.sender, val);
    }
    
    // Exchange VT for eth
    function exchangeVT(uint256 tokenAmt) public {
        require(tokenAmt <= voteTokenContract.checkToken(msg.sender), "User does not have enough VT to exchange");
        
        voteTokenContract.destroyToken(msg.sender, tokenAmt); // destroy exchanged VT
        uint256 weiAmt = tokenAmt * 0.009 ether; // only 90% refunded in terms of eth
        address payable recipient = payable(msg.sender);
        recipient.transfer(weiAmt);

        emit ExchangeVT(msg.sender, tokenAmt, weiAmt);
    }

    function startVoting() internal { 
        status = Statuses.Voting;
        startTime = block.timestamp - 1 + 1;

        emit VotingStarted(startTime);
    }

    function registerProj(string memory title) public checkTime() { // register project for voting
        require(status == Statuses.Standby, "Please wait for current voting round to end before registering");

        uint256 projId = projectContract.addProj(title);
        emit ProjRegistered(msg.sender, projId);

        if (projId == 3) {
            startVoting();
        }
    }
  
    function vote(uint256 id, uint256 tokenAmt) public { // vote for a project
        require(status == Statuses.Voting, "Voting has not started");
        require(id > 0 && id < 4, "Invalid project id");
        require(msg.sender != projectContract.getProjOwner(id), "Cannot vote for your own project");
        require(votingChoice[msg.sender] == 0, "Cannot vote twice!");
        require(voteTokenContract.checkToken(msg.sender) >= tokenAmt, "User does not have enough tokens for voting");
        
        voterList.push(msg.sender);
        votingChoice[msg.sender] = id;
        voterTokenWeights[msg.sender] = tokenAmt;
        projTokenWeights[id] += tokenAmt;
        numOfVoters[id] += 1;
        voteTokenContract.transferToken(address(this), tokenAmt);
        totalVTs += tokenAmt;

        emit Voted(id);
    }

    // reward voter of winning project with 20% of their voted VTs
    function rewardWinningVoter(address voter) internal {
        uint256 amt = voterTokenWeights[voter];
        if (amt >= 5) { // 5 is min amt required to receive at least 1 token as reward 
            uint256 rewardAmt = amt / 5;
            voteTokenContract.transferTokenFrom(address(this), voter, rewardAmt);
            projTokenWeights[winner] -= rewardAmt;
        }
    }

    // refund voter of losing project with 40% of their voted VTs
    function refundLosingVoter(address voter) internal {
        uint256 amt = voterTokenWeights[voter];
        uint256 refundAmt = (amt * 2) / 5;
        if (amt >= 3) { // 3 is min amt required to receive at least 1 token as refund
            voteTokenContract.transferTokenFrom(address(this), voter, refundAmt);
        }
        uint256 burnAmt = amt - refundAmt;
        voteTokenContract.destroyToken(address(this), burnAmt);
    }

    function fullRefundVoter(address voter) internal {
        uint256 refundAmt = voterTokenWeights[voter];
        voteTokenContract.transferTokenFrom(address(this), voter, refundAmt);
    }

    function rewardProjWinner() internal {
        address winnerAdd = projectContract.getProjOwner(winner);
        voteTokenContract.transferTokenFrom(address(this), winnerAdd, projTokenWeights[winner]);
    }   

    // distribute tokens to voters when there is 1 winner
    function distributeTokens() internal {
        for (uint256 k = 0; k < voterList.length; k++) {
            if (votingChoice[voterList[k]] == winner) { // winning voters
                rewardWinningVoter(voterList[k]);
            } else { // losing voters
                refundLosingVoter(voterList[k]);
            }
        }
    }

    // distribute tokens to voters when 2 projects are tied
    function distributeTokensOnTie(uint256 projId1, uint256 projId2) internal {
        for (uint256 k = 0; k < voterList.length; k++) {
            if (votingChoice[voterList[k]] == projId1 || votingChoice[voterList[k]] == projId2) { // winning voters
                fullRefundVoter(voterList[k]);
            } else { // losing voters
                refundLosingVoter(voterList[k]);
            }
        }
    }

    // distribute tokens to voters when all 3 projects are tied and voting round is voided
    function distributeTokensOnVoid() internal {
        for (uint256 k = 0; k < voterList.length; k++) {
            fullRefundVoter(voterList[k]);
        }
    }
    
    function endVoting() public {
        require(status == Statuses.Voting, "Voting is not underway");
        
        uint256 minVotes = totalVTs / 10; // required votes for refund of deposit (10% of totalVTs)
        uint256 maxProjWeight = 0;
        uint256 countOfMaxWeight = 0; // tracks the number of projects with the highest votes (for ties)
        
        // get max proj weight (highest num of votes for a proj)
        for (uint256 i = 1; i <= 3; i++) { // loop through the 3 projects
            if (projTokenWeights[i] > maxProjWeight) {
                maxProjWeight = projTokenWeights[i];
                winner = i;
            } 
        }

        // check for the number of ties
        for (uint256 i = 1; i <= 3; i++) { // loop through the 3 projects
            if (projTokenWeights[i] == maxProjWeight) {
                countOfMaxWeight += 1;
                tieProjs.push(i);
            } 
        }

        // refund deposits if viable
        for (uint256 j = 1; j <= 3; j++) {
            if (projTokenWeights[j] >= minVotes) {
                address projOwner = projectContract.getProjOwner(j);
                voteTokenContract.transferTokenFrom(address(this), projOwner, 100);
                emit DepositRefunded(projOwner);
            }
        }

        // determine outcome of voting
        if (countOfMaxWeight == 1) { // 1 winner
            distributeTokens();
            rewardProjWinner(); 
            emit VoteWon(winner);

        } else if (countOfMaxWeight == 2) { // 2 winners so proceed to tiebreaker 
            bool hasDrawn = true;
            if (numOfVoters[tieProjs[0]] > numOfVoters[tieProjs[1]]) {
                winner = tieProjs[0];              
                hasDrawn = false;  
            } else if (numOfVoters[tieProjs[0]] < numOfVoters[tieProjs[1]]) {
                winner = tieProjs[1];
                hasDrawn = false;
            } 
            
            if (hasDrawn) { // tiebreaker draws again
                distributeTokensOnTie(tieProjs[0], tieProjs[1]);
                emit VoteDrawn(tieProjs[0], tieProjs[1]);
            } else { // a winner is decided
                distributeTokens(); 
                rewardProjWinner(); 
                emit VoteWon(winner);
            }

        } else { // 3 projects all tied, void the round and fully refund all votes
            distributeTokensOnVoid();
            emit VoteVoided();
        }

        // Reset all variables to allow for next round of voting
        status = Statuses.Standby;
        startTime = 0;
        totalVTs = 0;
        winner = 0;
        
        for (uint256 i = 0; i < voterList.length; i++) {
            address voter = voterList[i];
            delete voterTokenWeights[voter];
            delete votingChoice[voter];
        }

        delete voterList;
        delete tieProjs;

        for (uint256 i = 1; i <= 3; i++) {
            delete projTokenWeights[i];
            delete numOfVoters[i];
        }

        projectContract.resetProjs();
        emit VotingEnded();
    }


    // getter functions for testing
    function getProjTitle(uint256 id) public view returns(string memory) {
        return projectContract.getProjTitle(id);
    }

    function getNumOfProj() public view returns(uint256 count) {
        return projectContract.getNumOfProj();
    }

    function getTokenBalance(address user) public view returns(uint256) {
        return voteTokenContract.checkToken(user);
    }

    function getVoterListLength() public view returns (uint256) {
        return voterList.length;
    }

    function checkStatus() public view returns (uint256) {
        if (status == Statuses.Standby) {
            return 0;
        } else {
            return 1;
        }
    }

    function getCurrTime() public view returns (uint256) {
        return block.timestamp;
    }

    function getStartTime() public view returns (uint256) {
        return startTime;
    }
}