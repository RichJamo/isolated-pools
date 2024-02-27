import { smock } from "@defi-wonderland/smock";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getConfig } from "../helpers/deploymentConfig";
import { getUnderlyingToken, toAddress } from "../helpers/deploymentUtils";
import { convertToUnit } from "../helpers/utils";
import { Comptroller } from "../typechain";

const MIN_AMOUNT_TO_CONVERT = convertToUnit(10, 18);
const MIN_POOL_BAD_DEBT = convertToUnit(1000, 18);
const maxLoopsLimit = 100;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log('got here 0')
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { tokensConfig, preconfiguredAddresses } = await getConfig(hre.network.name);
  const usdt = await getUnderlyingToken("USDT", tokensConfig);
  console.log('got here 1')  
  const poolRegistry = await ethers.getContract("PoolRegistry");
  const deployerSigner = ethers.provider.getSigner(deployer);
  const swapRouterAddress = await toAddress(preconfiguredAddresses.SwapRouter_CorePool || "SwapRouter", hre);
  const accessControlManagerAddress = await toAddress(
    preconfiguredAddresses.AccessControlManager || "AccessControlManager",
    hre,
  );
  const proxyAdmin = await ethers.getContract("DefaultProxyAdmin");
  const owner = await proxyAdmin.owner();

  let corePoolComptrollerAddress = preconfiguredAddresses.Unitroller;
  console.log('got here 2')

  if (!hre.network.live) {
    corePoolComptrollerAddress = (await smock.fake<Comptroller>("Comptroller")).address;
  }
  console.log('got here 3')

  console.log(await deploy("RiskFund", {
    from: deployer,
    contract: "RiskFund",
    proxy: {
      owner: owner,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [swapRouterAddress, MIN_AMOUNT_TO_CONVERT, usdt.address, accessControlManagerAddress, maxLoopsLimit],
      },
      upgradeIndex: 0,
    },
    autoMine: true,
    log: true,
    args: [
      corePoolComptrollerAddress,
      preconfiguredAddresses.VBNB_CorePool || "0x0000000000000000000000000000000000000001",
      preconfiguredAddresses.WBNB || "0x0000000000000000000000000000000000000002",
    ],
  }));
  console.log('got here 4')

  const riskFund = await ethers.getContract("RiskFund");
  console.log(riskFund.address)
  const shortfallDeployment = await deploy("Shortfall", {
    from: deployer,
    contract: "Shortfall",
    proxy: {
      owner: owner,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [riskFund.address, MIN_POOL_BAD_DEBT, accessControlManagerAddress],
      },
      upgradeIndex: 0,
    },
    autoMine: true,
    log: true,
  });
  console.log('got here 5')

  const shortfall = await ethers.getContract("Shortfall");
  if ((await shortfall.poolRegistry()) !== poolRegistry.address) {
    console.log("Setting PoolRegistry address in Shortfall contract");
    const tx = await shortfall.connect(deployerSigner).updatePoolRegistry(poolRegistry.address);
    await tx.wait();
  }
  console.log('got here 5a')

  if ((await riskFund.shortfall()) !== shortfall.address) {
    console.log("Setting Shortfall contract address in RiskFund");
    const tx = await riskFund.setShortfallContractAddress(shortfallDeployment.address);
    await tx.wait(1);
  }
  console.log('got here 5b')

  const contract = await ethers.getContract("RiskFund");
  console.log('got here 5c')
  console.log(contract.address)
  console.log(poolRegistry.address)

  if ((await riskFund.poolRegistry()) !== poolRegistry.address) {
    console.log(`Setting PoolRegistry address in RiskFund contract`);
    const tx = await contract.setPoolRegistry(poolRegistry.address);
    await tx.wait();
  }
  console.log('got here 5d')
  const targetOwner = preconfiguredAddresses.NormalTimelock || deployer;
  console.log('got here 6')
  for (const contractName of ["RiskFund", "Shortfall"]) {
    const contract = await ethers.getContract(contractName);
    if ((await contract.owner()) !== targetOwner && (await contract.pendingOwner()) !== targetOwner) {
      console.log(`Transferring ownership of ${contractName} to ${targetOwner}`);
      const tx = await contract.transferOwnership(targetOwner);
      await tx.wait();
    }
  }
  console.log('got to the end')
};
func.tags = ["RiskFund", "il"];

export default func;
