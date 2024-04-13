const ERC20 = artifacts.require("ERC20");
const ProjectHandler = artifacts.require("ProjectHandler");
const VoteToken = artifacts.require("VoteToken");
const VoteHandler = artifacts.require("VotingHandler");

module.exports = (deployer, network, accounts) => {
  deployer
    .deploy(VoteToken)
    .then(function() {
      return deployer.deploy(VoteHandler, VoteToken.address);
    });
};
