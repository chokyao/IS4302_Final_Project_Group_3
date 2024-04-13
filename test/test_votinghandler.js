const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require("truffle-assertions"); // npm truffle-assertions
const BigNumber = require("bignumber.js"); // npm install bignumber.js
const {time, expectRevert} = require('@openzeppelin/test-helpers'); // npm install @openzeppelin/test-helpers
const Web3 = require('web3'); // npm install web3
var assert = require("assert");

var VoteToken = artifacts.require("../contracts/VoteToken.sol");
var VotingHandler = artifacts.require("../contracts/VotingHandler.sol");

const oneEth = new BigNumber(1000000000000000000); // 1 eth
const zeroPointOneEth = new BigNumber(100000000000000000); // 0.1 eth

contract("VotingHandler", function (accounts) {
    let voteTokenInstance, votingHandlerInstance;
 
    beforeEach(async () => {
        // resets the contracts after each test case
        voteTokenInstance = await VoteToken.new();
        votingHandlerInstance = await VotingHandler.new(voteTokenInstance.address);
    });

    console.log("Testing VotingHandler contract");

    it("Obtain Vote Token", async() => {
        let t1 = await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3});
        truffleAssert.eventEmitted(t1, 'GetVT');
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[1])).toString(), "300", "Wrong amount of Vote Tokens obtained");
    });
    
    it("Exchange VT for eth", async() => {
        await votingHandlerInstance.getVT({from: accounts[4], value: oneEth * 3});
        
        // exchange VT
        let t1 = await votingHandlerInstance.exchangeVT(300, {from: accounts[4]});
        
        // check that account no longer holds any VT
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[4])).toString(), "0", "Not all VT were exchanged");
        
        // check event to verify the correct amount of eth returned
        truffleAssert.eventEmitted(t1, 'ExchangeVT', (ev) => {
            return ev.exchanger === accounts[4]
                && ev.tokenAmt == 300
                && ev.weiAmt == zeroPointOneEth * 27;
        }, "ExchangeVT event should be emitted with correct parameters");
    });

    it("Register Project without starting Voting Round", async() => {
        
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); // obtain VTs
        let t1 = await votingHandlerInstance.registerProj("p1", {from: accounts[1]});  
        truffleAssert.eventEmitted(t1, 'ProjRegistered', (ev) => {
            return ev.projOwner == accounts[1] 
                && ev.projId == 1;
        }, "ProjRegistered should be emitted with correct parameters");

        // check that proj is registered properly
        assert.strictEqual((await votingHandlerInstance.getProjTitle(1)).toString(), "p1", "Title of registered project and recorded title does not match");
        assert.strictEqual((await votingHandlerInstance.getNumOfProj()).toString(), "1", "Project not added to ProjectHandler contract properly");

        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); // obtain VTs
        let t2 = await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        truffleAssert.eventEmitted(t2, 'ProjRegistered', (ev) => {
            return ev.projOwner == accounts[2] 
                && ev.projId == 2;
        }, "ProjRegistered should be emitted with correct parameters");

        // check that proj is registered properly
        assert.strictEqual((await votingHandlerInstance.getProjTitle(2)).toString(), "p2", "Title of registered project and recorded title does not match");
        assert.strictEqual((await votingHandlerInstance.getNumOfProj()).toString(), "2", "Project not added to ProjectHandler contract properly");
        
    });

    it("Check Start Voting Round", async() => {
        // obtain VTs
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});

        let t1 = await votingHandlerInstance.registerProj("p3", {from: accounts[3]});
        truffleAssert.eventEmitted(t1, 'VotingStarted');

        // check that status has been updated to voting (1 = Voting, 0 = Standby)
        assert.strictEqual((await votingHandlerInstance.checkStatus()).toString(), "1", "Status is still Standby");

    });

    it("Check End Voting Round After 1 Day", async() => {
        // obtain VTs
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[4], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});

        await time.increase(time.duration.days(1));
        await votingHandlerInstance.registerProj("p4", {from: accounts[4]}); // used to end voting to check time

        // check that status has been updated to standby (1 = Voting, 0 = Standby)
        assert.strictEqual((await votingHandlerInstance.checkStatus()).toString(), "0", "Status is still Voting");

    });

    it("Check Voting", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});

        // vote
        let t1 = await votingHandlerInstance.vote(2, 50, {from: accounts[1]});
        truffleAssert.eventEmitted(t1, 'Voted', (ev) => {
            return ev.projId == 2;
        }, "Voted should be emitted with correct parameters");

        let t2 = await votingHandlerInstance.vote(3, 50, {from: accounts[2]});
        truffleAssert.eventEmitted(t2, 'Voted', (ev) => {
            return ev.projId == 3;
        }, "Voted should be emitted with correct parameters");

        assert.strictEqual((await votingHandlerInstance.getVoterListLength()).toString(), "2", "Number of voters are not tracked correctly");
    });


    it("Check 1 Clear Winner", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});

        // vote
        await votingHandlerInstance.vote(2, 50, {from: accounts[1]});
        await votingHandlerInstance.vote(3, 60, {from: accounts[2]});
        await votingHandlerInstance.vote(1, 70, {from: accounts[3]});
        
        let t1 = await votingHandlerInstance.endVoting({from: accounts[0]});

        truffleAssert.eventEmitted(t1, 'VoteWon', (ev) => {
            return ev.projId == 1;
        }, "VoteWon should be emitted with correct parameters");
        
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[1])).toString(), "326", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[2])).toString(), "264", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[3])).toString(), "244", "Wrong amount of Vote Tokens after voting");
    });

    it("Check Winner from Tiebreaker", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});

        // vote
        await votingHandlerInstance.vote(2, 30, {from: accounts[1]});
        await votingHandlerInstance.vote(3, 60, {from: accounts[2]});
        await votingHandlerInstance.vote(2, 30, {from: accounts[3]});
        
        let t1 = await votingHandlerInstance.endVoting({from: accounts[0]});
        
        truffleAssert.eventEmitted(t1, 'VoteWon', (ev) => {
            return ev.projId == 2;
        }, "VoteWon should be emitted with correct parameters");
        
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[1])).toString(), "176", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[2])).toString(), "312", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[3])).toString(), "276", "Wrong amount of Vote Tokens after voting");
    });

    it("Check Tie from Tiebreaker", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});

        // vote
        await votingHandlerInstance.vote(2, 50, {from: accounts[1]});
        await votingHandlerInstance.vote(3, 50, {from: accounts[2]});
        
        let t1 = await votingHandlerInstance.endVoting({from: accounts[0]});
        
        truffleAssert.eventEmitted(t1, 'VoteDrawn', (ev) => {
            return ev.projId1 == 2
            && ev.projId2 == 3;
        }, "VoteDrawn should be emitted with correct parameters");
        
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[1])).toString(), "200", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[2])).toString(), "300", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[3])).toString(), "300", "Wrong amount of Vote Tokens after voting");
    });

    it("Check Void Voting Round", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});

        // vote
        await votingHandlerInstance.vote(2, 50, {from: accounts[1]});
        await votingHandlerInstance.vote(3, 50, {from: accounts[2]});
        await votingHandlerInstance.vote(1, 50, {from: accounts[3]});
        
        let t1 = await votingHandlerInstance.endVoting({from: accounts[0]});

        truffleAssert.eventEmitted(t1, 'VoteVoided');
        
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[1])).toString(), "300", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[2])).toString(), "300", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[3])).toString(), "300", "Wrong amount of Vote Tokens after voting");
    });

    it("Check Deposit Refund", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});

        // vote equal amount to create a double tie
        await votingHandlerInstance.vote(2, 50, {from: accounts[1]});
        await votingHandlerInstance.vote(3, 50, {from: accounts[2]});
        
        let t1 = await votingHandlerInstance.endVoting({from: accounts[0]});
        
        truffleAssert.eventEmitted(t1, 'DepositRefunded', (ev) => {
            return ev.projOwner == accounts[2];
        }, "DepositRefunded should be emitted with correct parameters");

        truffleAssert.eventEmitted(t1, 'DepositRefunded', (ev) => {
            return ev.projOwner == accounts[3];
        }, "DepositRefunded should be emitted with correct parameters");
        
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[1])).toString(), "200", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[2])).toString(), "300", "Wrong amount of Vote Tokens after voting");
        assert.strictEqual((await voteTokenInstance.checkToken(accounts[3])).toString(), "300", "Wrong amount of Vote Tokens after voting");
    });
    
    it("Insufficient Eth for Vote Token", async() => {
        // attempt to buy a VoteToken with insufficient amount of Ether sent
        await truffleAssert.reverts(votingHandlerInstance.getVT({from: accounts[1], value: 100}), "At least 0.01ETH needed to get VT");
    });

    it("Insufficient Vote Tokens to Register Project", async() => {
        // attempt to register project with < 100 tokens
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth / 2}); // obtain 50 VTs
        await truffleAssert.reverts(votingHandlerInstance.registerProj("p1", {from: accounts[1]}), "User does not have enough tokens for deposit");
    });

    it("Register Project during voting round", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});
        // Register another project
        await truffleAssert.reverts(votingHandlerInstance.registerProj("p4", {from: accounts[4]}), "Please wait for current voting round to end before registering");
    });
    
    it("Check if user can register for more than one project", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        
        // accounts 1 tries to register for 2 projects
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await truffleAssert.reverts(votingHandlerInstance.registerProj("p2", {from: accounts[1]}), "User cannot register more than 1 project in the same round");
    });

    it("Check Voter has enough tokens for voting", async() => {
        // account 1 gets 100 VTs
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});

        // account 1 now has 0 VTs after registering project, vote fails
        await truffleAssert.reverts(votingHandlerInstance.vote(2, 50, {from: accounts[1]}), "User does not have enough tokens for voting");
    });

    it("Check Unable to End Vote when not in Voting Phase", async() => {
        // attempt to vote when voting has not started
        await truffleAssert.reverts(votingHandlerInstance.endVoting({from: accounts[0]}), "Voting is not underway");
    });

    it("Vote Project when not in Voting Round", async() => {
        // attempt to vote when voting has not started
        await truffleAssert.reverts(votingHandlerInstance.vote(2, 50, {from: accounts[1]}), "Voting has not started");
    });

    it("Vote Project with Invalid Project Id", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});
        // vote with invalid project id of 0
        await truffleAssert.reverts(votingHandlerInstance.vote(0, 50, {from: accounts[1]}), "Invalid project id");
    });

    it("Voting for Own Project", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});
        // vote for own project with 50 VTs
        await truffleAssert.reverts(votingHandlerInstance.vote(1, 50, {from: accounts[1]}), "Cannot vote for your own project");
    });
    
    it("Check Voters cannot vote twice", async() => {
        await votingHandlerInstance.getVT({from: accounts[1], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[2], value: oneEth * 3}); 
        await votingHandlerInstance.getVT({from: accounts[3], value: oneEth * 3}); 
        
        await votingHandlerInstance.registerProj("p1", {from: accounts[1]});
        await votingHandlerInstance.registerProj("p2", {from: accounts[2]});
        await votingHandlerInstance.registerProj("p3", {from: accounts[3]});
        // account 1 votes for project 2
        await votingHandlerInstance.vote(2, 50, {from: accounts[1]});
        // account 1 tries to vote for project 3 as well
        await truffleAssert.reverts(votingHandlerInstance.vote(3, 50, {from: accounts[1]}), "Cannot vote twice!");
    });

    it("Check Transfer of Zero Tokens", async() => {
        // send 0 tokens from accounts
        await truffleAssert.reverts(voteTokenInstance.transferToken(accounts[2], 0, {from: accounts[1]}), "Must send at least 1 token");
        await truffleAssert.reverts(voteTokenInstance.transferTokenFrom(accounts[2], accounts[3], 0, {from: accounts[2]}), "Must send at least 1 token");
    });
    
    
    // If your accounts run out of Ether, you can restart your Ganache session to refresh the account balances
});